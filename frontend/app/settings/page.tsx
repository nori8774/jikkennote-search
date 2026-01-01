'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import Button from '@/components/Button';
import { useAuth } from '@/lib/auth-context';

interface SavedPrompt {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function SettingsPage() {
  const { idToken, currentTeamId, loading } = useAuth();
  const [openaiKey, setOpenaiKey] = useState('');
  const [cohereKey, setCohereKey] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [defaultPrompts, setDefaultPrompts] = useState<any>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'api' | 'models' | 'prompts' | 'notes'>('api');
  const [saved, setSaved] = useState(false);

  // プロンプト保存機能用のステート
  const [savedPromptsList, setSavedPromptsList] = useState<SavedPrompt[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [savePromptDescription, setSavePromptDescription] = useState('');
  const [saveError, setSaveError] = useState('');

  // ChromaDB管理用のステート
  const [chromaDBInfo, setChromaDBInfo] = useState<{
    current_embedding_model: string | null;
    created_at: string | null;
    last_updated: string | null;
  } | null>(null);
  const [originalEmbeddingModel, setOriginalEmbeddingModel] = useState<string>('');

  // 保存ボタンクリック時のEmbeddingモデルの値を保持（キャンセル時の復元用）
  const embeddingModelBeforeSave = useRef<string>('');

  // ノート管理用のステート
  const [storageType, setStorageType] = useState<'local' | 'gcs' | 'google_drive'>('local');
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState('');
  const [googleDriveCredentialsPath, setGoogleDriveCredentialsPath] = useState('');

  // ローカルストレージと認証不要APIの読み込み（初回のみ）
  useEffect(() => {
    // localStorageから設定を読み込む
    setOpenaiKey(storage.getOpenAIApiKey() || '');
    setCohereKey(storage.getCohereApiKey() || '');
    const storedEmbeddingModel = storage.getEmbeddingModel() || 'text-embedding-3-small';
    setEmbeddingModel(storedEmbeddingModel);
    setOriginalEmbeddingModel(storedEmbeddingModel);
    setLlmModel(storage.getLLMModel() || 'gpt-4o-mini');
    setCustomPrompts(storage.getCustomPrompts() || {});

    // Google Drive設定を読み込む
    setStorageType(storage.getStorageType() || 'local');
    setGoogleDriveFolderId(storage.getGoogleDriveFolderId() || '');
    setGoogleDriveCredentialsPath(storage.getGoogleDriveCredentialsPath() || '');

    // デフォルトプロンプトを取得（認証不要）
    api.getDefaultPrompts().then((res) => {
      setDefaultPrompts(res.prompts);
    }).catch(console.error);

    // ChromaDB情報を取得（認証不要）
    api.getChromaInfo().then((res) => {
      if (res.success) {
        setChromaDBInfo({
          current_embedding_model: res.current_embedding_model,
          created_at: res.created_at,
          last_updated: res.last_updated
        });
      }
    }).catch(console.error);
  }, []);

  // 認証情報が揃ったらプロンプトリストを取得
  useEffect(() => {
    if (!loading && idToken && currentTeamId) {
      api.listSavedPrompts(idToken, currentTeamId).then((res) => {
        if (res.success) {
          setSavedPromptsList(res.prompts || []);
        }
      }).catch(console.error);
    }
  }, [loading, idToken, currentTeamId]);

  const handleSave = () => {
    // 保存前のEmbeddingモデルの値を保存（localStorageから取得）
    const savedEmbeddingModel = storage.getEmbeddingModel();
    embeddingModelBeforeSave.current = savedEmbeddingModel || embeddingModel;

    // Embeddingモデルが変更されているかチェック
    // 優先順位: 1) ChromaDBの現在のモデル、2) localStorageの値
    const currentModel = chromaDBInfo?.current_embedding_model || savedEmbeddingModel;
    const isModelChanged = currentModel && embeddingModel !== currentModel;

    // Embeddingモデルが変更されている場合、警告を表示
    if (isModelChanged) {
      const confirmMessage = `⚠️ 警告: Embeddingモデルを変更しようとしています\n\n` +
        `現在のモデル: ${currentModel}\n` +
        `変更後: ${embeddingModel}\n\n` +
        `Embeddingモデルを変更すると、既存のベクトルDBとの互換性がなくなります。\n` +
        `検索が正しく動作しなくなるため、ChromaDBをリセットして全ノートを再取り込みする必要があります。\n\n` +
        `本当に変更しますか？`;

      if (!confirm(confirmMessage)) {
        // キャンセルされた場合、保存前の値に戻す
        setEmbeddingModel(embeddingModelBeforeSave.current);
        return;
      }
    }

    storage.setOpenAIApiKey(openaiKey);
    storage.setCohereApiKey(cohereKey);
    storage.setEmbeddingModel(embeddingModel);
    storage.setLLMModel(llmModel);
    storage.setCustomPrompts(customPrompts);

    // Google Drive設定を保存
    storage.setStorageType(storageType);
    storage.setGoogleDriveFolderId(googleDriveFolderId);
    storage.setGoogleDriveCredentialsPath(googleDriveCredentialsPath);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetChromaDB = async () => {
    const confirmMessage = `⚠️ 危険な操作: ChromaDBを完全にリセットします\n\n` +
      `この操作により、以下のデータが削除されます：\n` +
      `- 全ての実験ノートのベクトルデータ\n` +
      `- 検索インデックス\n\n` +
      `リセット後は、全ての実験ノートを再度取り込む必要があります。\n\n` +
      `本当にリセットしますか？`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const result = await api.resetChromaDB();
      if (result.success) {
        alert(`✅ ${result.message}`);
        // ChromaDB情報を再読み込み
        const info = await api.getChromaInfo();
        if (info.success) {
          setChromaDBInfo({
            current_embedding_model: info.current_embedding_model,
            created_at: info.created_at,
            last_updated: info.last_updated
          });
        }
      }
    } catch (error) {
      alert(`❌ ChromaDBリセットエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const handleResetPrompt = (promptType: string) => {
    if (confirm(`${promptType}のプロンプトを初期設定に戻しますか？`)) {
      const newCustomPrompts = { ...customPrompts };
      delete newCustomPrompts[promptType];
      setCustomPrompts(newCustomPrompts);
    }
  };

  const handleResetAllPrompts = () => {
    if (confirm('全てのプロンプトを初期設定に戻しますか？')) {
      setCustomPrompts({});
    }
  };

  // プロンプト保存機能
  const handleOpenSaveDialog = () => {
    setSavePromptName('');
    setSavePromptDescription('');
    setSaveError('');
    setShowSaveDialog(true);
  };

  const handleSavePromptSet = async () => {
    if (!savePromptName.trim()) {
      setSaveError('プロンプト名を入力してください。');
      return;
    }

    // 認証情報の確認
    if (!idToken || !currentTeamId) {
      setSaveError('認証情報が取得できていません。ページを再読み込みしてください。');
      return;
    }

    try {
      // 現在のプロンプトを保存
      const promptsToSave = {
        query_generation: customPrompts['query_generation'] || defaultPrompts?.query_generation?.prompt || '',
        compare: customPrompts['compare'] || defaultPrompts?.compare?.prompt || ''
      };

      const result = await api.savePrompt(savePromptName, promptsToSave, savePromptDescription, idToken, currentTeamId);

      if (!result.success) {
        setSaveError(result.error || '保存に失敗しました。');
        return;
      }

      // 保存成功 - リストを再読み込み
      const listRes = await api.listSavedPrompts(idToken, currentTeamId);
      if (listRes.success) {
        setSavedPromptsList(listRes.prompts || []);
      }
      setShowSaveDialog(false);
      alert(`プロンプト「${savePromptName}」を保存しました。`);
    } catch (error) {
      setSaveError(`保存エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const handleRestorePrompt = async (id: string) => {
    try {
      const result = await api.loadPrompt(id, idToken, currentTeamId);
      console.log('🔍 Load prompt result:', result);

      if (!result.success || !result.prompt) {
        console.error('❌ Prompt not found or invalid response');
        alert('プロンプトが見つかりません。');
        return;
      }

      console.log('✅ Prompt data:', result.prompt);
      console.log('📝 Prompts field:', result.prompt.prompts);

      if (confirm(`プロンプト「${result.prompt.name}」を復元しますか？現在の編集内容は上書きされます。`)) {
        const newPrompts = {
          query_generation: result.prompt.prompts.query_generation || '',
          compare: result.prompt.prompts.compare || ''
        };
        console.log('🔄 Setting custom prompts:', newPrompts);
        setCustomPrompts(newPrompts);
        alert(`プロンプト「${result.prompt.name}」を復元しました。「設定を保存」ボタンをクリックして適用してください。`);
      }
    } catch (error) {
      console.error('❌ Restore error:', error);
      alert(`復元エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const handleDeleteSavedPrompt = async (id: string, name: string) => {
    if (confirm(`プロンプト「${name}」を削除しますか？この操作は元に戻せません。`)) {
      try {
        const result = await api.deletePrompt(id, idToken, currentTeamId);
        if (result.success) {
          // リストを再読み込み
          const listRes = await api.listSavedPrompts(idToken, currentTeamId);
          if (listRes.success) {
            setSavedPromptsList(listRes.prompts || []);
          }
          alert('削除しました。');
        } else {
          alert(result.error || '削除に失敗しました。');
        }
      } catch (error) {
        alert(`削除エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }
    }
  };

  const embeddingModels = [
    'text-embedding-3-small',
    'text-embedding-3-large',
    'text-embedding-ada-002',
  ];

  const llmModels = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">設定</h1>

        {/* タブ */}
        <div className="mb-6 border-b border-gray-300">
          <div className="flex space-x-8">
            {[
              { key: 'api', label: 'APIキー' },
              { key: 'models', label: 'モデル選択' },
              { key: 'prompts', label: 'プロンプト管理' },
              { key: 'notes', label: 'ノート管理' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3 px-2 ${
                  activeTab === tab.key
                    ? 'border-b-2 border-primary font-semibold'
                    : 'text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* APIキータブ */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">OpenAI API Key</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                />
                <p className="text-sm text-gray-600 mt-1">
                  ブラウザのlocalStorageに保存されます。必ず「sk-proj-」で始まるキーを入力してください。
                </p>
                {openaiKey && (
                  <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-300">
                    <p className="text-xs font-mono">
                      現在の値: {openaiKey.substring(0, 10)}...{openaiKey.substring(openaiKey.length - 4)}
                    </p>
                    <p className={`text-xs mt-1 ${openaiKey.startsWith('sk-proj-') ? 'text-green-600' : 'text-red-600'}`}>
                      {openaiKey.startsWith('sk-proj-') ? '✓ 形式が正しいです' : '✗ 「sk-proj-」で始まっていません'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Cohere API Key</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={cohereKey}
                  onChange={(e) => setCohereKey(e.target.value)}
                  placeholder="..."
                />
                <p className="text-sm text-gray-600 mt-1">
                  リランキングに使用されます。
                </p>
                {cohereKey && (
                  <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-300">
                    <p className="text-xs font-mono">
                      現在の値: {cohereKey.substring(0, 8)}...{cohereKey.substring(cohereKey.length - 4)}
                    </p>
                  </div>
                )}
              </div>

              {/* デバッグ情報 */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 className="font-bold text-sm mb-2">保存状態の確認</h3>
                <button
                  onClick={() => {
                    const saved = localStorage.getItem('openai_api_key');
                    alert(`保存されているOpenAI APIキー:\n${saved ? saved.substring(0, 10) + '...' + saved.substring(saved.length - 4) : '未設定'}\n\nsk-proj-で始まっている: ${saved?.startsWith('sk-proj-') ? 'はい' : 'いいえ'}`);
                  }}
                  className="text-sm text-blue-600 underline"
                >
                  localStorageを確認
                </button>
              </div>
            </div>
          )}

          {/* モデル選択タブ */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Embeddingモデル</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                >
                  {embeddingModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  ベクトル検索に使用されます。text-embedding-3-small が推奨です。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">LLMモデル</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                >
                  {llmModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  クエリ生成と比較分析に使用されます。gpt-4o-mini が推奨です。
                </p>
              </div>

              {/* ChromaDB管理 */}
              <div className="border-t border-gray-300 pt-6 mt-6">
                <h3 className="text-lg font-bold mb-4">ChromaDB管理</h3>

                {/* ChromaDB情報 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm mb-2">現在のChromaDB設定</h4>
                  {chromaDBInfo ? (
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Embeddingモデル:</span>{' '}
                        <span className="font-mono">
                          {chromaDBInfo.current_embedding_model || 'まだ設定されていません'}
                        </span>
                      </p>
                      {chromaDBInfo.created_at && (
                        <p>
                          <span className="font-medium">作成日時:</span>{' '}
                          {new Date(chromaDBInfo.created_at).toLocaleString('ja-JP')}
                        </p>
                      )}
                      {chromaDBInfo.last_updated && (
                        <p>
                          <span className="font-medium">最終更新:</span>{' '}
                          {new Date(chromaDBInfo.last_updated).toLocaleString('ja-JP')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">読み込み中...</p>
                  )}
                </div>

                {/* Embedding変更警告 */}
                {(() => {
                  const currentModel = chromaDBInfo?.current_embedding_model || storage.getEmbeddingModel();
                  const isChanged = currentModel && embeddingModel !== currentModel;
                  return isChanged && (
                    <div className="bg-warning/10 border-2 border-warning rounded-lg p-4 mb-4">
                      <h4 className="font-bold text-warning mb-2">⚠️ 警告</h4>
                      <p className="text-sm mb-2">
                        Embeddingモデルを <span className="font-mono">{currentModel}</span> から{' '}
                        <span className="font-mono">{embeddingModel}</span> に変更しようとしています。
                      </p>
                      <p className="text-sm text-gray-700">
                        Embeddingモデルを変更すると、既存のベクトルDBとの互換性がなくなります。
                        変更後は、ChromaDBをリセットして全ての実験ノートを再度取り込む必要があります。
                      </p>
                    </div>
                  );
                })()}

                {/* ChromaDBリセットボタン */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-red-800 mb-2">危険な操作</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    ChromaDBをリセットすると、全てのベクトルデータが削除されます。
                    Embeddingモデルを変更した場合のみ実行してください。
                  </p>
                  <Button
                    variant="danger"
                    onClick={handleResetChromaDB}
                    className="text-sm"
                  >
                    ChromaDBをリセット
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* プロンプト管理タブ */}
          {activeTab === 'prompts' && defaultPrompts && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">プロンプトのカスタマイズ</h2>
                <div className="flex gap-3">
                  <Button onClick={handleOpenSaveDialog}>
                    現在のプロンプトを保存
                  </Button>
                  <Button variant="danger" onClick={handleResetAllPrompts}>
                    全て初期設定にリセット
                  </Button>
                </div>
              </div>

              {/* 保存済みプロンプト一覧 */}
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold mb-3">
                  保存済みプロンプト ({savedPromptsList.length}/50)
                </h3>
                {savedPromptsList.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {savedPromptsList.map((prompt) => (
                        <div
                          key={prompt.id}
                          className="bg-white border border-gray-200 rounded p-3 flex justify-between items-start"
                        >
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{prompt.name}</h4>
                            {prompt.description && (
                              <p className="text-xs text-gray-600 mt-1">
                                {prompt.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              更新日: {new Date(prompt.updated_at).toLocaleString('ja-JP')}
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleRestorePrompt(prompt.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-600 rounded hover:bg-blue-50"
                              title="このプロンプトを復元して現在の設定に適用します"
                            >
                              復元
                            </button>
                            <button
                              onClick={() => handleDeleteSavedPrompt(prompt.id, prompt.name)}
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-600 rounded hover:bg-red-50"
                              title="このプロンプトを削除します（元に戻せません）"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-3">
                      残り保存可能数: {50 - savedPromptsList.length}個
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    保存されているプロンプトはありません。<br />
                    「現在のプロンプトを保存」ボタンをクリックして、カスタマイズしたプロンプトを保存できます。
                  </p>
                )}
              </div>

              {Object.entries(defaultPrompts).map(([key, value]: [string, any]) => (
                <div key={key} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold">{value.name}</h3>
                      <p className="text-sm text-gray-600">{value.description}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleResetPrompt(key)}
                      className="text-sm py-1 px-3"
                    >
                      初期設定にリセット
                    </Button>
                  </div>

                  {/* 左右2カラムレイアウト */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左側: デフォルトプロンプト（読み取り専用） */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          デフォルトプロンプト
                        </label>
                        <button
                          onClick={() => {
                            setCustomPrompts({ ...customPrompts, [key]: value.prompt });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          右にコピー →
                        </button>
                      </div>
                      <textarea
                        className="w-full border border-gray-200 bg-gray-50 rounded-md p-3 h-64 font-mono text-sm"
                        value={value.prompt}
                        readOnly
                      />
                    </div>

                    {/* 右側: カスタムプロンプト（編集可能） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        カスタムプロンプト
                        {customPrompts[key] && customPrompts[key] !== value.prompt && (
                          <span className="ml-2 text-xs text-warning">
                            ⚠️ カスタマイズ済み
                          </span>
                        )}
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-md p-3 h-64 font-mono text-sm"
                        value={customPrompts[key] || value.prompt}
                        onChange={(e) => setCustomPrompts({ ...customPrompts, [key]: e.target.value })}
                        placeholder={value.prompt}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ノート管理タブ */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* 本番環境の警告 */}
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                <h3 className="font-bold mb-2 text-yellow-900">⚠️ 本番環境について</h3>
                <p className="text-sm text-yellow-800 mb-2">
                  現在、バックエンドは <strong>Google Cloud Storage (GCS)</strong> で動作しています。
                </p>
                <p className="text-sm text-yellow-800">
                  下記の設定はブラウザに保存されますが、<strong>バックエンドのストレージ設定には影響しません</strong>。
                  バックエンドのストレージタイプとフォルダパスは環境変数で管理されています。
                </p>
                <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
                  <p className="text-xs font-mono text-gray-700">
                    <strong>バックエンド設定:</strong><br />
                    ストレージ: GCS (jikkennote-storage)<br />
                    新規ノート: notes/new<br />
                    処理済み: notes/processed<br />
                    アーカイブ: notes/archived
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold mb-2">ノートストレージの設定（参考）</h3>
                <p className="text-sm text-gray-700">
                  実験ノートの保存先を設定します。Google Driveを使用すると、チーム全体でノートを共有できます。
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  ※ 本番環境ではバックエンドの環境変数が優先されます。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ストレージタイプ</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={storageType}
                  onChange={(e) => setStorageType(e.target.value as any)}
                >
                  <option value="local">ローカルファイルシステム</option>
                  <option value="gcs">Google Cloud Storage</option>
                  <option value="google_drive">Google Drive</option>
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  {storageType === 'local' && 'ローカルマシン上のフォルダに保存します。'}
                  {storageType === 'gcs' && 'Google Cloud Storageのバケットに保存します。'}
                  {storageType === 'google_drive' && 'Google Driveの共有フォルダに保存します（推奨）。'}
                </p>
              </div>

              {storageType === 'google_drive' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Google Drive フォルダID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md p-3"
                      value={googleDriveFolderId}
                      onChange={(e) => setGoogleDriveFolderId(e.target.value)}
                      placeholder="例: 1a2B3c4D5e6F7g8H9i0J"
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      Google Driveの共有フォルダのIDを入力してください。
                      フォルダのURL「https://drive.google.com/drive/folders/<strong>フォルダID</strong>」から取得できます。
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      サービスアカウント認証情報のパス <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md p-3"
                      value={googleDriveCredentialsPath}
                      onChange={(e) => setGoogleDriveCredentialsPath(e.target.value)}
                      placeholder="例: /path/to/service-account-key.json"
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      Google Cloud ConsoleでダウンロードしたサービスアカウントのJSONキーファイルのパスを入力してください。
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">📘 Google Drive APIの設定方法</h4>
                    <ol className="text-sm space-y-2 list-decimal list-inside">
                      <li>Google Cloud Consoleでプロジェクトを作成</li>
                      <li>Google Drive APIを有効化</li>
                      <li>サービスアカウントを作成してJSONキーをダウンロード</li>
                      <li>共有フォルダにサービスアカウントのメールアドレスを編集者として追加</li>
                      <li>フォルダIDとJSONキーのパスを上記に入力</li>
                    </ol>
                    <p className="text-xs text-gray-600 mt-3">
                      詳しい手順は
                      <a
                        href="https://developers.google.com/drive/api/guides/about-sdk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline ml-1"
                      >
                        Google Drive API ドキュメント
                      </a>
                      を参照してください。
                    </p>
                  </div>
                </>
              )}

              <div className="border-t border-gray-300 pt-6 mt-6">
                <h3 className="text-lg font-bold mb-4">フォルダ構成</h3>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <p className="text-sm mb-3">
                    ノートは以下のフォルダ構成で管理されます：
                  </p>
                  <div className="font-mono text-sm space-y-1 bg-white border border-gray-200 rounded p-3">
                    <div>📁 {storageType === 'google_drive' ? '共有フォルダ（指定したフォルダID）' : 'ルートフォルダ'}</div>
                    <div className="ml-4">├── 📁 notes/</div>
                    <div className="ml-8">│   ├── 📁 new/ <span className="text-gray-600">← 新規ノート（取り込み前）</span></div>
                    <div className="ml-8">│   └── 📁 processed/ <span className="text-gray-600">← 取り込み済みノート</span></div>
                    <div className="ml-4">└── 📄 master_dictionary.yaml <span className="text-gray-600">← 正規化辞書</span></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    ※ 新規ノートを <code>notes/new/</code> フォルダに配置すると、取り込み処理で自動的に <code>notes/processed/</code> に移動されます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 保存ボタン */}
          <div className="mt-8 flex items-center gap-4">
            <Button onClick={handleSave} className="w-full md:w-auto">
              設定を保存
            </Button>
            {saved && (
              <span className="text-success font-medium">✓ 保存しました</span>
            )}
          </div>
        </div>

        {/* プロンプト保存ダイアログ */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">プロンプトを保存</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    プロンプト名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md p-2"
                    value={savePromptName}
                    onChange={(e) => {
                      setSavePromptName(e.target.value);
                      setSaveError('');
                    }}
                    placeholder="例: 高精度検索用プロンプト"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    説明（任意）
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-2"
                    value={savePromptDescription}
                    onChange={(e) => setSavePromptDescription(e.target.value)}
                    placeholder="このプロンプトの特徴や用途を記載"
                    rows={3}
                    maxLength={200}
                  />
                </div>

                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSavePromptSet}
                    className="flex-1"
                  >
                    保存
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
