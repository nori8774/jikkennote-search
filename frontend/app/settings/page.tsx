'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import Button from '@/components/Button';
import {
  getSavedPrompts,
  savePrompt,
  deletePrompt,
  getRemainingSlots,
  getPromptById
} from '@/lib/promptStorage';
import { SavedPrompt } from '@/lib/types';

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [cohereKey, setCohereKey] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [defaultPrompts, setDefaultPrompts] = useState<any>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'api' | 'models' | 'prompts'>('api');
  const [saved, setSaved] = useState(false);

  // プロンプト保存機能用のステート
  const [savedPromptsList, setSavedPromptsList] = useState<SavedPrompt[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [savePromptDescription, setSavePromptDescription] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    // localStorageから設定を読み込む
    setOpenaiKey(storage.getOpenAIApiKey() || '');
    setCohereKey(storage.getCohereApiKey() || '');
    setEmbeddingModel(storage.getEmbeddingModel() || 'text-embedding-3-small');
    setLlmModel(storage.getLLMModel() || 'gpt-4o-mini');
    setCustomPrompts(storage.getCustomPrompts() || {});

    // 保存済みプロンプト一覧を読み込む
    setSavedPromptsList(getSavedPrompts());

    // デフォルトプロンプトを取得
    api.getDefaultPrompts().then((res) => {
      setDefaultPrompts(res.prompts);
    }).catch(console.error);
  }, []);

  const handleSave = () => {
    storage.setOpenAIApiKey(openaiKey);
    storage.setCohereApiKey(cohereKey);
    storage.setEmbeddingModel(embeddingModel);
    storage.setLLMModel(llmModel);
    storage.setCustomPrompts(customPrompts);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  const handleSavePromptSet = () => {
    if (!savePromptName.trim()) {
      setSaveError('プロンプト名を入力してください。');
      return;
    }

    // 現在のプロンプトを保存
    const promptsToSave = {
      query_generation: customPrompts['query_generation'] || defaultPrompts?.query_generation?.prompt || '',
      compare: customPrompts['compare'] || defaultPrompts?.compare?.prompt || ''
    };

    const result = savePrompt(savePromptName, promptsToSave, savePromptDescription);

    if (!result.success) {
      setSaveError(result.error || '保存に失敗しました。');
      return;
    }

    // 保存成功
    setSavedPromptsList(getSavedPrompts());
    setShowSaveDialog(false);
    alert(`プロンプト「${savePromptName}」を保存しました。`);
  };

  const handleRestorePrompt = (id: string) => {
    const prompt = getPromptById(id);
    if (!prompt) {
      alert('プロンプトが見つかりません。');
      return;
    }

    if (confirm(`プロンプト「${prompt.name}」を復元しますか？現在の編集内容は上書きされます。`)) {
      setCustomPrompts({
        query_generation: prompt.prompts.query_generation,
        compare: prompt.prompts.compare
      });
      alert(`プロンプト「${prompt.name}」を復元しました。「設定を保存」ボタンをクリックして適用してください。`);
    }
  };

  const handleDeleteSavedPrompt = (id: string, name: string) => {
    if (confirm(`プロンプト「${name}」を削除しますか？この操作は元に戻せません。`)) {
      const result = deletePrompt(id);
      if (result.success) {
        setSavedPromptsList(getSavedPrompts());
        alert('削除しました。');
      } else {
        alert(result.error || '削除に失敗しました。');
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
              {savedPromptsList.length > 0 && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <h3 className="font-bold mb-3">
                    保存済みプロンプト ({savedPromptsList.length}/50)
                  </h3>
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
                            更新日: {new Date(prompt.updatedAt).toLocaleString('ja-JP')}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleRestorePrompt(prompt.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-600 rounded"
                          >
                            復元
                          </button>
                          <button
                            onClick={() => handleDeleteSavedPrompt(prompt.id, prompt.name)}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-600 rounded"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    残り保存可能数: {getRemainingSlots()}個
                  </p>
                </div>
              )}

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
