'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import Button from '@/components/Button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export default function SearchPage() {
  const { idToken, currentTeamId } = useAuth();
  const [purpose, setPurpose] = useState('');
  const [materials, setMaterials] = useState('');
  const [methods, setMethods] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const handleSearch = async () => {
    setError('');
    setLoading(true);

    try {
      // APIキーをlocalStorageから取得
      const openaiKey = storage.getOpenAIApiKey();
      const cohereKey = storage.getCohereApiKey();

      // デバッグ: APIキーの形式を確認
      console.log('OpenAI APIキー:', openaiKey ? `${openaiKey.substring(0, 10)}...${openaiKey.substring(openaiKey.length - 4)}` : '未設定');
      console.log('sk-proj-で始まっている:', openaiKey?.startsWith('sk-proj-'));

      if (!openaiKey || !cohereKey) {
        throw new Error('APIキーが設定されていません。設定ページで入力してください。');
      }

      if (!openaiKey.startsWith('sk-proj-')) {
        throw new Error('OpenAI APIキーの形式が正しくありません。「sk-proj-」で始まるキーを設定してください。現在: ' + openaiKey.substring(0, 10) + '...');
      }

      const response = await api.search({
        purpose,
        materials,
        methods,
        instruction,
        openai_api_key: openaiKey,
        cohere_api_key: cohereKey,
        embedding_model: storage.getEmbeddingModel() || undefined,
        llm_model: storage.getLLMModel() || undefined,
        custom_prompts: storage.getCustomPrompts() || undefined,
      }, idToken, currentTeamId);

      setResult(response);

      // 検索結果を履歴に保存
      saveToHistory(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = (response: any) => {
    // 検索結果から上位10件のノートIDを抽出
    const results = response.retrieved_docs?.slice(0, 10).map((doc: string, index: number) => {
      // ノートIDを抽出（複数のパターンを試す）
      let noteId = null;

      // パターン1: 【実験ノートID: ID1-2】 形式（バックエンドの標準形式）
      let idMatch = doc.match(/【実験ノートID:\s*(ID[\d-]+)】/);
      if (idMatch) {
        noteId = idMatch[1];
      }

      // パターン2: # ID1-2 形式（Markdown見出し）
      if (!noteId) {
        idMatch = doc.match(/^#\s+(ID[\d-]+)/m);
        if (idMatch) {
          noteId = idMatch[1];
        }
      }

      // パターン3: ## ID1-2 形式
      if (!noteId) {
        idMatch = doc.match(/^##\s+(ID[\d-]+)/m);
        if (idMatch) {
          noteId = idMatch[1];
        }
      }

      // パターン4: 任意の位置の ID1-2 パターン
      if (!noteId) {
        idMatch = doc.match(/ID\d+-\d+/);
        if (idMatch) {
          noteId = idMatch[0];
        }
      }

      // デバッグ用
      if (!noteId) {
        console.log('ノートIDを抽出できませんでした:', doc.substring(0, 200));
        noteId = `note-${index + 1}`;
      } else {
        console.log(`ノート${index + 1}のID:`, noteId);
      }

      return {
        noteId,
        score: 1.0 - (index * 0.05), // 仮のスコア
        rank: index + 1,
      };
    }) || [];

    console.log('履歴に保存するノートID:', results.map((r: any) => r.noteId));

    const history = {
      id: Date.now().toString(),
      timestamp: new Date(),
      query: {
        purpose,
        materials,
        methods,
        instruction,
      },
      results,
    };

    // localStorageに保存
    const stored = localStorage.getItem('search_histories');
    const histories = stored ? JSON.parse(stored) : [];
    histories.unshift(history); // 最新を先頭に追加

    // 最大50件まで保存
    if (histories.length > 50) {
      histories.pop();
    }

    localStorage.setItem('search_histories', JSON.stringify(histories));
  };

  const handleCopyMaterials = (doc: string) => {
    // ノートから材料セクションを抽出してコピー
    const materialsMatch = doc.match(/## 材料\n(.*?)\n##/s);
    if (materialsMatch) {
      setMaterials(materialsMatch[1].trim());
      setCopySuccess('材料を検索条件にコピーしました');
      setTimeout(() => setCopySuccess(''), 3000);
    } else {
      setCopySuccess('材料セクションが見つかりませんでした');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  const handleCopyMethods = (doc: string) => {
    // ノートから方法セクションを抽出してコピー
    const methodsMatch = doc.match(/## 方法\n(.*?)(?:\n##|$)/s);
    if (methodsMatch) {
      setMethods(methodsMatch[1].trim());
      setCopySuccess('方法を検索条件にコピーしました');
      setTimeout(() => setCopySuccess(''), 3000);
    } else {
      setCopySuccess('方法セクションが見つかりませんでした');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">実験ノート検索</h1>

        {/* 2カラムレイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側: 検索フォーム */}
          <div className="bg-white rounded-lg shadow-lg p-6 h-fit sticky top-8">
            <h2 className="text-xl font-bold mb-4">検索条件</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">目的・背景</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-24 text-sm"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="実験の目的や背景を入力..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">材料</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-32 text-sm"
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="使用する材料を入力..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">方法・手順</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-32 text-sm"
                  value={methods}
                  onChange={(e) => setMethods(e.target.value)}
                  placeholder="実験の手順を入力..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">絞り込み指示（オプション）</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3 text-sm"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="特定の条件で絞り込む場合は入力..."
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={loading || !purpose || !materials || !methods}
                className="w-full"
              >
                {loading ? '検索中...' : '検索'}
              </Button>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {copySuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
                  {copySuccess}
                </div>
              )}
            </div>
          </div>

          {/* 右側: 検索結果 */}
          <div>
            {!result && (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-500">
                <p>検索条件を入力して検索ボタンをクリックしてください</p>
              </div>
            )}

            {result && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-4">検索結果</h2>

                {/* 比較分析レポート */}
                <div className="mb-8 prose max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      table: ({node, ...props}) => (
                        <table className="border-collapse border border-gray-300 w-full my-4" {...props} />
                      ),
                      thead: ({node, ...props}) => (
                        <thead className="bg-gray-100" {...props} />
                      ),
                      th: ({node, ...props}) => (
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props} />
                      ),
                      td: ({node, ...props}) => (
                        <td className="border border-gray-300 px-4 py-2" {...props} />
                      ),
                      p: ({node, ...props}) => (
                        <p className="whitespace-pre-wrap my-2" {...props} />
                      ),
                      br: ({node, ...props}) => (
                        <br {...props} />
                      ),
                    }}
                  >
                    {result.message}
                  </ReactMarkdown>
                </div>

                {/* 検索されたノート */}
                {result.retrieved_docs && result.retrieved_docs.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold mb-4">検索された実験ノート（上位3件）</h3>
                    {result.retrieved_docs.map((doc: string, index: number) => {
                      // ノートIDを抽出（複数のパターンを試す）
                      let noteId = null;

                      // パターン1: 【実験ノートID: ID1-2】 形式
                      let idMatch = doc.match(/【実験ノートID:\s*(ID[\d-]+)】/);
                      if (idMatch) {
                        noteId = idMatch[1];
                      }

                      // パターン2: # ID1-2 形式
                      if (!noteId) {
                        idMatch = doc.match(/^#\s+(ID[\d-]+)/m);
                        if (idMatch) {
                          noteId = idMatch[1];
                        }
                      }

                      // パターン3: ID1-2 パターン
                      if (!noteId) {
                        idMatch = doc.match(/ID\d+-\d+/);
                        if (idMatch) {
                          noteId = idMatch[0];
                        }
                      }

                      return (
                        <div key={index} className="border border-gray-300 rounded-lg p-4 mb-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-lg">ノート {index + 1}</h4>
                              {noteId && (
                                <a
                                  href={`/viewer?id=${noteId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                                  title="新しいタブで全文表示"
                                >
                                  {noteId} →
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => handleCopyMaterials(doc)}
                                className="text-sm py-1 px-3"
                              >
                                材料をコピー
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleCopyMethods(doc)}
                                className="text-sm py-1 px-3"
                              >
                                方法をコピー
                              </Button>
                            </div>
                          </div>
                          <div className="prose max-w-none text-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                table: ({node, ...props}) => (
                                  <table className="border-collapse border border-gray-300 w-full my-4" {...props} />
                                ),
                                thead: ({node, ...props}) => (
                                  <thead className="bg-gray-100" {...props} />
                                ),
                                th: ({node, ...props}) => (
                                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold" {...props} />
                                ),
                                td: ({node, ...props}) => (
                                  <td className="border border-gray-300 px-4 py-2" {...props} />
                                ),
                                p: ({node, ...props}) => (
                                  <p className="whitespace-pre-wrap my-2" {...props} />
                                ),
                                br: ({node, ...props}) => (
                                  <br {...props} />
                                ),
                              }}
                            >
                              {doc}
                            </ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
