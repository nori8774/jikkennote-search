'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface TestCondition {
  条件: number;
  目的: string;
  材料: string;
  実験手順: string;
  [key: string]: any; // ranking_1, ranking_2, etc.
}

interface EvaluationResult {
  condition_id: number;
  metrics: {
    ndcg_10: number;
    precision_10: number;
    recall_10: number;
    mrr: number;
  };
  candidates: { noteId: string; rank: number }[]; // 検索結果 (10件)
  ground_truth: { noteId: string; rank: number }[]; // 正解データ (10件)
}

interface EvaluationHistory {
  id: string;
  timestamp: Date;
  embedding_model: string;
  llm_model: string;
  custom_prompts: Record<string, string>;
  results: EvaluationResult[];
  average_metrics: {
    ndcg_10: number;
    precision_10: number;
    recall_10: number;
    mrr: number;
  };
}

export default function EvaluatePage() {
  const [testConditions, setTestConditions] = useState<TestCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 評価履歴（最新5件）
  const [evaluationHistories, setEvaluationHistories] = useState<EvaluationHistory[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // プロンプト設定
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [defaultPrompts, setDefaultPrompts] = useState<any>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  // 評価用シートのデータを読み込む
  useEffect(() => {
    loadEvaluationData();
    loadEvaluationHistories();
    loadDefaultPrompts();

    // 現在の設定を読み込む
    setEmbeddingModel(storage.getEmbeddingModel() || 'text-embedding-3-small');
    setLlmModel(storage.getLLMModel() || 'gpt-4o-mini');
    setCustomPrompts(storage.getCustomPrompts() || {});
  }, []);

  const loadEvaluationData = async () => {
    try {
      const response = await fetch('/evaluation_data.json');
      const data = await response.json();
      setTestConditions(data);
    } catch (err) {
      console.error('評価データの読み込みに失敗:', err);
      setError('評価データの読み込みに失敗しました');
    }
  };

  const loadDefaultPrompts = async () => {
    try {
      const response = await api.getDefaultPrompts();
      setDefaultPrompts(response.prompts);
    } catch (err) {
      console.error('デフォルトプロンプトの取得に失敗:', err);
    }
  };

  const loadEvaluationHistories = () => {
    const stored = localStorage.getItem('evaluation_histories');
    if (stored) {
      const parsed = JSON.parse(stored);
      const histories = parsed.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      }));
      setEvaluationHistories(histories);
    }
  };

  const saveEvaluationHistory = (results: EvaluationResult[], avgMetrics: any) => {
    const newHistory: EvaluationHistory = {
      id: Date.now().toString(),
      timestamp: new Date(),
      embedding_model: embeddingModel,
      llm_model: llmModel,
      custom_prompts: customPrompts,
      results,
      average_metrics: avgMetrics,
    };

    const updated = [newHistory, ...evaluationHistories].slice(0, 5); // 最新5件のみ保持
    setEvaluationHistories(updated);
    localStorage.setItem('evaluation_histories', JSON.stringify(updated));
  };

  // 全条件について評価を実行
  const handleEvaluateAll = async () => {
    setLoading(true);
    setError('');
    const results: EvaluationResult[] = [];

    try {
      for (const condition of testConditions) {
        console.log(`条件 ${condition.条件} を評価中...`);

        // APIキーを取得
        const openaiKey = storage.getOpenAIApiKey();
        const cohereKey = storage.getCohereApiKey();

        if (!openaiKey || !cohereKey) {
          throw new Error('APIキーが設定されていません');
        }

        // 検索実行（デフォルトの重点指示を使用）
        const searchResponse = await api.search({
          purpose: condition.目的 || '',
          materials: condition.材料 || '',
          methods: condition.実験手順 || '',
          instruction: '', // デフォルトの重点指示（空文字列）
          openai_api_key: openaiKey,
          cohere_api_key: cohereKey,
          embedding_model: embeddingModel,
          llm_model: llmModel,
          custom_prompts: customPrompts,
        });

        // 検索結果からノートIDを抽出（リランキング後の上位10件）
        const candidates: { noteId: string; rank: number }[] = [];
        if (searchResponse.retrieved_docs && searchResponse.retrieved_docs.length > 0) {
          for (let i = 0; i < Math.min(10, searchResponse.retrieved_docs.length); i++) {
            const doc = searchResponse.retrieved_docs[i];
            // ノートIDを抽出
            const idMatch = doc.match(/【実験ノートID:\s*(ID[\d-]+)】/) ||
                           doc.match(/^#\s+(ID[\d-]+)/m) ||
                           doc.match(/ID\d+-\d+/);
            if (idMatch) {
              candidates.push({
                noteId: idMatch[1] || idMatch[0],
                rank: i + 1,
              });
            }
          }
        }

        // 正解データを取得（ranking_1からranking_10まで）
        const groundTruth: { noteId: string; rank: number }[] = [];
        for (let i = 1; i <= 10; i++) {
          const rankingKey = `ranking_${i}`;
          if (condition[rankingKey]) {
            groundTruth.push({
              noteId: condition[rankingKey],
              rank: i,
            });
          }
        }

        // 評価指標を計算
        const metrics = calculateMetrics(candidates, groundTruth);

        results.push({
          condition_id: condition.条件,
          metrics,
          candidates,
          ground_truth: groundTruth,
        });
      }

      // 平均スコアを計算
      const avgMetrics = calculateAverageMetrics(results);

      // 履歴に保存
      saveEvaluationHistory(results, avgMetrics);

    } catch (err: any) {
      console.error('評価エラー:', err);
      setError(err.message || '評価の実行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 評価指標の計算
  const calculateMetrics = (
    candidates: { noteId: string; rank: number }[],
    groundTruth: { noteId: string; rank: number }[]
  ) => {
    const k = 10;

    // 正解ノートIDのリスト
    const gtIds = groundTruth.map(gt => gt.noteId);

    // nDCG@10の計算
    let dcg = 0;
    let idcg = 0;

    for (let i = 0; i < k; i++) {
      // DCG: 検索結果の順位での計算
      if (i < candidates.length) {
        const candidateId = candidates[i].noteId;
        const gtIndex = gtIds.indexOf(candidateId);
        if (gtIndex !== -1) {
          // 正解データでの順位に基づいてrelevanceを計算（上位ほど高い）
          const relevance = k - gtIndex;
          dcg += relevance / Math.log2(i + 2);
        }
      }

      // IDCG: 理想的なランキング（正解データの順序）
      if (i < groundTruth.length) {
        const relevance = k - i;
        idcg += relevance / Math.log2(i + 2);
      }
    }

    const ndcg_10 = idcg > 0 ? dcg / idcg : 0;

    // Precision@10の計算
    let hits = 0;
    for (let i = 0; i < Math.min(k, candidates.length); i++) {
      if (gtIds.includes(candidates[i].noteId)) {
        hits++;
      }
    }
    const precision_10 = candidates.length > 0 ? hits / Math.min(k, candidates.length) : 0;

    // Recall@10の計算
    const recall_10 = groundTruth.length > 0 ? hits / Math.min(k, groundTruth.length) : 0;

    // MRR（Mean Reciprocal Rank）の計算
    let mrr = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (gtIds.includes(candidates[i].noteId)) {
        mrr = 1 / (i + 1);
        break;
      }
    }

    return {
      ndcg_10,
      precision_10,
      recall_10,
      mrr,
    };
  };

  // 平均スコアを計算
  const calculateAverageMetrics = (results: EvaluationResult[]) => {
    if (results.length === 0) return null;

    const sum = results.reduce(
      (acc, result) => ({
        ndcg_10: acc.ndcg_10 + result.metrics.ndcg_10,
        precision_10: acc.precision_10 + result.metrics.precision_10,
        recall_10: acc.recall_10 + result.metrics.recall_10,
        mrr: acc.mrr + result.metrics.mrr,
      }),
      { ndcg_10: 0, precision_10: 0, recall_10: 0, mrr: 0 }
    );

    const count = results.length;
    return {
      ndcg_10: sum.ndcg_10 / count,
      precision_10: sum.precision_10 / count,
      recall_10: sum.recall_10 / count,
      mrr: sum.mrr / count,
    };
  };

  const handleResetPrompt = (promptType: string) => {
    if (defaultPrompts && defaultPrompts[promptType]) {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">性能評価</h1>

        {/* 評価条件セクション */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">評価条件</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Embedding モデル</label>
              <select
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              >
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-3-large">text-embedding-3-large</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">LLM モデル</label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              >
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            </div>
          </div>

          {/* プロンプト編集セクション */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="font-semibold">プロンプト設定</h3>
                <p className="text-sm text-gray-600">
                  {Object.keys(customPrompts).length > 0
                    ? `カスタマイズ済み (${Object.keys(customPrompts).length}件)`
                    : 'デフォルト'}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowPromptEditor(!showPromptEditor)}
                className="text-sm"
              >
                {showPromptEditor ? 'プロンプト編集を閉じる' : 'プロンプトを編集'}
              </Button>
            </div>

            {showPromptEditor && defaultPrompts && (
              <div className="mt-4 space-y-4">
                <div className="flex justify-end">
                  <Button variant="danger" onClick={handleResetAllPrompts} className="text-sm">
                    全て初期設定にリセット
                  </Button>
                </div>

                {Object.entries(defaultPrompts).map(([key, value]: [string, any]) => (
                  <div key={key} className="border border-gray-300 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold">{value.name}</h4>
                        <p className="text-xs text-gray-600">{value.description}</p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => handleResetPrompt(key)}
                        className="text-xs py-1 px-2"
                      >
                        リセット
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* デフォルト */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-medium text-gray-700">
                            デフォルト
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
                          className="w-full border border-gray-200 bg-gray-50 rounded-md p-2 h-32 font-mono text-xs"
                          value={value.prompt}
                          readOnly
                        />
                      </div>

                      {/* カスタム */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          カスタム
                          {customPrompts[key] && customPrompts[key] !== value.prompt && (
                            <span className="ml-2 text-xs text-warning">⚠️ 変更済み</span>
                          )}
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded-md p-2 h-32 font-mono text-xs"
                          value={customPrompts[key] || value.prompt}
                          onChange={(e) =>
                            setCustomPrompts({ ...customPrompts, [key]: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 評価実行ボタン */}
          <div className="mt-6">
            <Button
              onClick={handleEvaluateAll}
              disabled={loading || testConditions.length === 0}
              className="w-full md:w-auto"
            >
              {loading ? `評価実行中... (${testConditions.length}条件)` : '全条件を評価'}
            </Button>
            <p className="text-sm text-gray-600 mt-2">
              {testConditions.length}件の条件について検索・評価を実行します
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {error}
            </div>
          )}
        </div>

        {/* 評価履歴セクション */}
        {evaluationHistories.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">評価履歴（最新5件）</h2>

            <div className="space-y-4">
              {evaluationHistories.map((history) => (
                <div key={history.id} className="border border-gray-200 rounded-lg">
                  {/* ヘッダー部分 */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      setExpandedHistoryId(expandedHistoryId === history.id ? null : history.id)
                    }
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">
                            {history.timestamp.toLocaleString('ja-JP')}
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {history.embedding_model}
                          </span>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                            {history.llm_model}
                          </span>
                          {Object.keys(history.custom_prompts).length > 0 && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              カスタムプロンプト
                            </span>
                          )}
                        </div>

                        {/* 平均スコア */}
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">nDCG@10: </span>
                            <span className="font-bold">
                              {history.average_metrics.ndcg_10.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Precision@10: </span>
                            <span className="font-bold">
                              {history.average_metrics.precision_10.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Recall@10: </span>
                            <span className="font-bold">
                              {history.average_metrics.recall_10.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">MRR: </span>
                            <span className="font-bold">
                              {history.average_metrics.mrr.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button className="ml-4 text-gray-400 hover:text-gray-600">
                        {expandedHistoryId === history.id ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* 展開部分 */}
                  {expandedHistoryId === history.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="space-y-4">
                        {history.results.map((result) => (
                          <div
                            key={result.condition_id}
                            className="border border-gray-200 rounded-lg p-4 bg-white"
                          >
                            <h4 className="font-bold text-sm mb-3">条件 {result.condition_id}</h4>

                            {/* 指標 */}
                            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                              <div>
                                <span className="text-gray-600">nDCG@10:</span>
                                <span className="ml-1 font-bold">
                                  {result.metrics.ndcg_10.toFixed(3)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Precision@10:</span>
                                <span className="ml-1 font-bold">
                                  {result.metrics.precision_10.toFixed(3)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Recall@10:</span>
                                <span className="ml-1 font-bold">
                                  {result.metrics.recall_10.toFixed(3)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">MRR:</span>
                                <span className="ml-1 font-bold">
                                  {result.metrics.mrr.toFixed(3)}
                                </span>
                              </div>
                            </div>

                            {/* 検索結果 */}
                            <div className="mb-3">
                              <h5 className="font-semibold text-xs mb-2">
                                検索結果 (Candidates)
                              </h5>
                              <div className="flex flex-wrap gap-1">
                                {result.candidates.map((candidate) => {
                                  const isCorrect = result.ground_truth.some(
                                    (gt) => gt.noteId === candidate.noteId
                                  );
                                  return (
                                    <span
                                      key={candidate.rank}
                                      className={`px-2 py-1 rounded text-xs ${
                                        isCorrect
                                          ? 'bg-green-100 text-green-800 border border-green-300'
                                          : 'bg-gray-100 text-gray-600 border border-gray-300'
                                      }`}
                                      title={`順位 ${candidate.rank}${isCorrect ? ' (正解)' : ''}`}
                                    >
                                      {candidate.noteId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 正解データ */}
                            <div>
                              <h5 className="font-semibold text-xs mb-2">
                                正解データ (Ground Truth)
                              </h5>
                              <div className="flex flex-wrap gap-1">
                                {result.ground_truth.map((gt) => (
                                  <span
                                    key={gt.rank}
                                    className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 border border-blue-300"
                                    title={`正解順位 ${gt.rank}`}
                                  >
                                    {gt.noteId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
