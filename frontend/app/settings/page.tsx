'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import Button from '@/components/Button';

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [cohereKey, setCohereKey] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [defaultPrompts, setDefaultPrompts] = useState<any>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'api' | 'models' | 'prompts'>('api');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // localStorageから設定を読み込む
    setOpenaiKey(storage.getOpenAIApiKey() || '');
    setCohereKey(storage.getCohereApiKey() || '');
    setEmbeddingModel(storage.getEmbeddingModel() || 'text-embedding-3-small');
    setLlmModel(storage.getLLMModel() || 'gpt-4o-mini');
    setCustomPrompts(storage.getCustomPrompts() || {});

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
                <Button variant="danger" onClick={handleResetAllPrompts}>
                  全て初期設定にリセット
                </Button>
              </div>

              {Object.entries(defaultPrompts).map(([key, value]: [string, any]) => (
                <div key={key} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
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

                  <textarea
                    className="w-full border border-gray-300 rounded-md p-3 h-64 font-mono text-sm mt-2"
                    value={customPrompts[key] || value.prompt}
                    onChange={(e) => setCustomPrompts({ ...customPrompts, [key]: e.target.value })}
                    placeholder={value.prompt}
                  />

                  {customPrompts[key] && customPrompts[key] !== value.prompt && (
                    <p className="text-sm text-warning mt-2">
                      ⚠️ カスタマイズされています
                    </p>
                  )}
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
      </div>
    </div>
  );
}
