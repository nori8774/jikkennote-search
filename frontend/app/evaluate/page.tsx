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
  candidates: string[]; // 検索結果のノートID (10件)
  ground_truth: string[]; // 正解データのノートID (10件)
}

export default function EvaluatePage() {
  const [testConditions, setTestConditions] = useState<TestCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([]);

  // プロンプト設定
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});

  // 評価用シートのデータを読み込む
  useEffect(() => {
    loadEvaluationData();

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

        // 検索実行（10件取得）
        const searchResponse = await api.search({
          purpose: condition.目的 || '',
          materials: condition.材料 || '',
          methods: condition.実験手順 || '',
          instruction: '', // 絞り込み指示なし
          openai_api_key: openaiKey,
          cohere_api_key: cohereKey,
          embedding_model: embeddingModel,
          llm_model: llmModel,
          custom_prompts: customPrompts,
        });

        // 検索結果からノートIDを抽出（上位10件）
        const candidates: string[] = [];
        if (searchResponse.retrieved_docs && searchResponse.retrieved_docs.length > 0) {
          for (let i = 0; i < Math.min(10, searchResponse.retrieved_docs.length); i++) {
            const doc = searchResponse.retrieved_docs[i];
            // ノートIDを抽出
            const idMatch = doc.match(/【実験ノートID:\s*(ID[\d-]+)】/) ||
                           doc.match(/^#\s+(ID[\d-]+)/m) ||
                           doc.match(/ID\d+-\d+/);
            if (idMatch) {
              candidates.push(idMatch[1] || idMatch[0]);
            }
          }
        }

        // 正解データを取得（ranking_1からranking_10まで）
        const groundTruth: string[] = [];
        for (let i = 1; i <= 10; i++) {
          const rankingKey = `ranking_${i}`;
          if (condition[rankingKey]) {
            groundTruth.push(condition[rankingKey]);
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

      setEvaluationResults(results);
    } catch (err: any) {
      console.error('評価エラー:', err);
      setError(err.message || '評価の実行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 評価指標の計算
  const calculateMetrics = (candidates: string[], groundTruth: string[]) => {
    const k = 10;

    // nDCG@10の計算
    let dcg = 0;
    let idcg = 0;

    for (let i = 0; i < k; i++) {
      // DCG
      if (i < candidates.length) {
        const rank = groundTruth.indexOf(candidates[i]);
        if (rank !== -1) {
          const relevance = k - rank; // 上位ほど高い relevance
          dcg += relevance / Math.log2(i + 2);
        }
      }

      // IDCG（理想的なランキング）
      if (i < groundTruth.length) {
        const relevance = k - i;
        idcg += relevance / Math.log2(i + 2);
      }
    }

    const ndcg_10 = idcg > 0 ? dcg / idcg : 0;

    // Precision@10の計算
    let hits = 0;
    for (let i = 0; i < Math.min(k, candidates.length); i++) {
      if (groundTruth.includes(candidates[i])) {
        hits++;
      }
    }
    const precision_10 = candidates.length > 0 ? hits / Math.min(k, candidates.length) : 0;

    // Recall@10の計算
    const recall_10 = groundTruth.length > 0 ? hits / Math.min(k, groundTruth.length) : 0;

    // MRR（Mean Reciprocal Rank）の計算
    let mrr = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (groundTruth.includes(candidates[i])) {
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
  const calculateAverageMetrics = () => {
    if (evaluationResults.length === 0) return null;

    const sum = evaluationResults.reduce(
      (acc, result) => ({
        ndcg_10: acc.ndcg_10 + result.metrics.ndcg_10,
        precision_10: acc.precision_10 + result.metrics.precision_10,
        recall_10: acc.recall_10 + result.metrics.recall_10,
        mrr: acc.mrr + result.metrics.mrr,
      }),
      { ndcg_10: 0, precision_10: 0, recall_10: 0, mrr: 0 }
    );

    const count = evaluationResults.length;
    return {
      ndcg_10: (sum.ndcg_10 / count).toFixed(3),
      precision_10: (sum.precision_10 / count).toFixed(3),
      recall_10: (sum.recall_10 / count).toFixed(3),
      mrr: (sum.mrr / count).toFixed(3),
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">性能評価</h1>

        {/* 評価条件セクション */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">評価条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div>
              <label className="block text-sm font-medium mb-2">プロンプト設定</label>
              <p className="text-sm text-gray-600">
                {Object.keys(customPrompts).length > 0
                  ? `カスタマイズ済み (${Object.keys(customPrompts).length}件)`
                  : 'デフォルト'}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleEvaluateAll}
              disabled={loading || testConditions.length === 0}
              className="w-full md:w-auto"
            >
              {loading ? `評価実行中... (${evaluationResults.length}/${testConditions.length})` : '全条件を評価'}
            </Button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {error}
            </div>
          )}
        </div>

        {/* テストケース一覧 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">テストケース一覧</h2>
          <p className="text-sm text-gray-600 mb-4">
            全 {testConditions.length} 件の条件で評価を実行します
          </p>
          <div className="space-y-2">
            {testConditions.map((condition, idx) => (
              <div key={idx} className="border border-gray-200 rounded p-3">
                <div className="flex items-start gap-4">
                  <span className="font-bold text-lg">条件 {condition.条件}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {condition.目的 || '(目的なし)'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 評価指標結果セクション */}
        {evaluationResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">評価指標結果 (k=10)</h2>

            {/* 平均スコア */}
            {calculateAverageMetrics() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold mb-2">平均スコア</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 uppercase">nDCG@10</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {calculateAverageMetrics()!.ndcg_10}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 uppercase">Precision@10</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {calculateAverageMetrics()!.precision_10}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 uppercase">Recall@10</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {calculateAverageMetrics()!.recall_10}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 uppercase">MRR</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {calculateAverageMetrics()!.mrr}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 個別結果 */}
            <div className="space-y-6">
              {evaluationResults.map((result) => (
                <div key={result.condition_id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-4">条件 {result.condition_id}</h3>

                  {/* 指標 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">nDCG@10:</span>
                      <span className="ml-2 font-bold">{result.metrics.ndcg_10.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Precision@10:</span>
                      <span className="ml-2 font-bold">{result.metrics.precision_10.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Recall@10:</span>
                      <span className="ml-2 font-bold">{result.metrics.recall_10.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">MRR:</span>
                      <span className="ml-2 font-bold">{result.metrics.mrr.toFixed(3)}</span>
                    </div>
                  </div>

                  {/* 検索結果 */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">検索結果 (Candidates)</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.candidates.map((noteId, idx) => {
                        const isCorrect = result.ground_truth.includes(noteId);
                        return (
                          <span
                            key={idx}
                            className={`px-3 py-1 rounded text-sm ${
                              isCorrect
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300'
                            }`}
                            title={`Candidate_${idx + 1}${isCorrect ? ' (正解)' : ''}`}
                          >
                            {noteId}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* 正解データ */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">正解データ (Ground Truth)</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.ground_truth.map((noteId, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded text-sm bg-blue-100 text-blue-800 border border-blue-300"
                          title={`True_${idx + 1}`}
                        >
                          {noteId}
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
    </div>
  );
}
