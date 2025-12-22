'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import * as XLSX from 'xlsx';
import { getSavedPrompts } from '@/lib/promptStorage';

interface TestCondition {
  条件: number;
  目的: string;
  材料: string;
  実験手順: string;
  重点指示?: string;  // 新規: 重点指示フィールド
  [key: string]: any; // ranking_1, ranking_2, etc.
}

interface EvaluationResult {
  condition_id: number;
  condition_details: {
    目的: string;
    材料: string;
    実験手順: string;
    重点指示?: string;
  };
  metrics: {
    ndcg_10: number;
    precision_10: number;
    recall_10: number;
    mrr: number;
  };
  candidates: { noteId: string; rank: number; score: number }[]; // 検索結果（リランキング後）
  ground_truth: { noteId: string; rank: number }[]; // 正解データ (10件)
}

interface EvaluationHistory {
  id: string;
  timestamp: Date;
  promptName?: string;  // プロンプト名
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
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentCondition, setCurrentCondition] = useState<number | null>(null);

  // 評価履歴（最新5件）
  const [evaluationHistories, setEvaluationHistories] = useState<EvaluationHistory[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // プロンプト設定
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [defaultPrompts, setDefaultPrompts] = useState<any>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  // プロンプト名管理
  const [promptName, setPromptName] = useState('デフォルト');
  const [savedPromptsList, setSavedPromptsList] = useState<any[]>([]);

  // 評価用シートのデータを読み込む
  useEffect(() => {
    loadEvaluationData();
    loadEvaluationHistories();
    loadDefaultPrompts();

    // 現在の設定を読み込む
    setEmbeddingModel(storage.getEmbeddingModel() || 'text-embedding-3-small');
    setLlmModel(storage.getLLMModel() || 'gpt-4o-mini');
    setCustomPrompts(storage.getCustomPrompts() || {});

    // 保存済みプロンプト一覧を読み込む
    setSavedPromptsList(getSavedPrompts());
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

  // Excel ファイルを読み込む
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // データを TestCondition 形式に変換
        const conditions: TestCondition[] = jsonData.map((row: any) => {
          // ranking カラムのノートIDに "ID" プレフィックスを追加（必要な場合）
          const processedRow = { ...row };
          for (let i = 1; i <= 16; i++) {
            const key = `ranking_${i}`;
            if (processedRow[key] && typeof processedRow[key] === 'string') {
              // "ID" プレフィックスがない場合は追加
              if (!processedRow[key].startsWith('ID')) {
                processedRow[key] = `ID${processedRow[key]}`;
              }
            }
          }
          return processedRow as TestCondition;
        });

        setTestConditions(conditions);
        setError('');
        console.log(`Excel ファイルから ${conditions.length} 件の評価条件を読み込みました`);
      } catch (err) {
        console.error('Excel ファイルの解析に失敗:', err);
        setError('Excel ファイルの解析に失敗しました');
      }
    };

    reader.readAsArrayBuffer(file);
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
      try {
        const parsed = JSON.parse(stored);
        console.log('📊 評価履歴を読み込みました:', parsed.length, '件');
        const histories = parsed.map((h: any) => {
          console.log('履歴データ:', {
            id: h.id,
            timestamp: h.timestamp,
            hasResults: !!h.results,
            resultsCount: h.results?.length || 0,
            firstResult: h.results?.[0] || null
          });
          return {
            ...h,
            timestamp: new Date(h.timestamp),
          };
        });
        setEvaluationHistories(histories);
      } catch (error) {
        console.error('評価履歴の読み込みに失敗:', error);
      }
    } else {
      console.log('📊 評価履歴が見つかりません（localStorage）');
    }
  };

  const saveEvaluationHistory = (results: EvaluationResult[], avgMetrics: any) => {
    console.log('💾 評価履歴を保存します');
    console.log('結果数:', results.length);
    console.log('最初の結果:', results[0]);

    const newHistory: EvaluationHistory = {
      id: Date.now().toString(),
      timestamp: new Date(),
      promptName: promptName || 'デフォルト',  // プロンプト名を記録
      embedding_model: embeddingModel,
      llm_model: llmModel,
      custom_prompts: customPrompts,
      results,
      average_metrics: avgMetrics,
    };

    console.log('保存する履歴データ:', newHistory);

    const updated = [newHistory, ...evaluationHistories].slice(0, 5); // 最新5件のみ保持
    setEvaluationHistories(updated);
    localStorage.setItem('evaluation_histories', JSON.stringify(updated));

    console.log('✅ 評価履歴を保存しました（全', updated.length, '件）');
  };

  // 全条件について評価を実行
  const handleEvaluateAll = async () => {
    setLoading(true);
    setError('');
    setProgress({ current: 0, total: testConditions.length });
    const results: EvaluationResult[] = [];
    const errors: string[] = [];

    try {
      // APIキーを取得（事前チェック）
      const openaiKey = storage.getOpenAIApiKey();
      const cohereKey = storage.getCohereApiKey();

      if (!openaiKey || !cohereKey) {
        throw new Error('APIキーが設定されていません');
      }

      for (let i = 0; i < testConditions.length; i++) {
        const condition = testConditions[i];
        setCurrentCondition(condition.条件);
        setProgress({ current: i + 1, total: testConditions.length });

        try {
          console.log(`条件 ${condition.条件} を評価中...`);

          // 検索実行（評価モード: 比較省略、Top10返却）
          const searchResponse = await api.search({
            purpose: condition.目的 || '',
            materials: condition.材料 || '',
            methods: condition.実験手順 || '',
            instruction: condition.重点指示 || '', // 重点指示フィールドを使用
            openai_api_key: openaiKey,
            cohere_api_key: cohereKey,
            embedding_model: embeddingModel,
            llm_model: llmModel,
            custom_prompts: customPrompts,
            evaluation_mode: true,  // 評価モードを有効化
          });

          // デバッグログ: 検索レスポンスを確認
          console.log(`条件 ${condition.条件} の検索レスポンス:`, {
            success: searchResponse.success,
            retrieved_docs_count: searchResponse.retrieved_docs?.length || 0,
            first_doc_preview: searchResponse.retrieved_docs?.[0]?.substring(0, 200) || 'なし'
          });

          // 検索結果からノートIDとスコアを抽出（リランキング後の上位10件）
          const candidates: { noteId: string; rank: number; score: number }[] = [];
          if (searchResponse.retrieved_docs && searchResponse.retrieved_docs.length > 0) {
            for (let j = 0; j < Math.min(10, searchResponse.retrieved_docs.length); j++) {
              const doc = searchResponse.retrieved_docs[j];
              // ノートIDを抽出（バックエンドから返されるフォーマット: 【実験ノートID: ID3-14】）
              const idMatch = doc.match(/【実験ノートID:\s*([ID\d-]+)】/) ||  // 【実験ノートID: ID3-14】
                             doc.match(/実験ノートID:\s*([ID\d-]+)/) ||       // 実験ノートID: ID3-14
                             doc.match(/^#\s+([ID\d-]+)/m) ||                  // # ID3-14
                             doc.match(/\b(ID\d+-\d+)\b/);                     // ID3-14

              if (idMatch) {
                const noteId = idMatch[1];
                // スコアは現時点では取得できないため、ランクベースの仮スコアを設定
                // (将来的にバックエンドからスコアが返される場合は、それを使用)
                const score = 1.0 - (j * 0.05); // 1位=1.0, 2位=0.95, ...
                candidates.push({
                  noteId: noteId,
                  rank: j + 1,
                  score: score,
                });
              } else {
                console.warn(`条件 ${condition.条件}: ノートID抽出失敗（順位 ${j+1}）`, doc.substring(0, 100));
              }
            }
          }

          // 正解データを取得（ranking_1からranking_10まで）
          const groundTruth: { noteId: string; rank: number }[] = [];
          for (let j = 1; j <= 10; j++) {
            const rankingKey = `ranking_${j}`;
            if (condition[rankingKey]) {
              // ノートIDをそのまま使用（形式を統一）
              const noteId = condition[rankingKey];
              groundTruth.push({
                noteId: noteId,
                rank: j,
              });
            }
          }

          // 評価指標を計算
          const metrics = calculateMetrics(candidates, groundTruth);

          results.push({
            condition_id: condition.条件,
            condition_details: {
              目的: condition.目的 || '',
              材料: condition.材料 || '',
              実験手順: condition.実験手順 || '',
              重点指示: condition.重点指示 || '',
            },
            metrics,
            candidates,
            ground_truth: groundTruth,
          });

          console.log(`条件 ${condition.条件} 完了`);

          // 少し待機してブラウザのリソースを解放
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (conditionErr: any) {
          console.error(`条件 ${condition.条件} でエラー:`, conditionErr);
          errors.push(`条件${condition.条件}: ${conditionErr.message || 'エラーが発生しました'}`);
          // エラーが発生しても次の条件に進む
        }
      }

      // 平均スコアを計算（成功した結果のみ）
      if (results.length > 0) {
        const avgMetrics = calculateAverageMetrics(results);
        // 履歴に保存
        saveEvaluationHistory(results, avgMetrics);
      }

      // エラーがあった場合は表示
      if (errors.length > 0) {
        setError(`一部の条件で評価に失敗しました:\n${errors.join('\n')}`);
      } else if (results.length === 0) {
        setError('全ての条件で評価に失敗しました');
      }

    } catch (err: any) {
      console.error('評価エラー:', err);
      setError(err.message || '評価の実行に失敗しました');
    } finally {
      setLoading(false);
      setCurrentCondition(null);
      setProgress({ current: 0, total: 0 });
    }
  };

  // 評価指標の計算
  const calculateMetrics = (
    candidates: { noteId: string; rank: number; score?: number }[],
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

          {/* Excel ファイルアップロードセクション */}
          <div className="border border-gray-300 rounded-md p-4 mb-6 bg-gray-50">
            <h3 className="font-semibold mb-2">評価データファイル</h3>
            <p className="text-sm text-gray-600 mb-3">
              Excel ファイル（.xlsx）をアップロードして評価データを読み込みます。
              <br />
              現在の評価条件数: {testConditions.length} 件
            </p>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:bg-primary-dark
                  cursor-pointer"
              />
              <Button
                variant="secondary"
                onClick={loadEvaluationData}
                className="text-sm whitespace-nowrap"
              >
                JSONデータ読込
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ※ Excel ファイルには「条件」「目的」「材料」「実験手順」「重点指示」「ranking_1〜16」のカラムが必要です
            </p>
          </div>

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

          {/* プロンプト名の設定 */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mt-6">
            <h3 className="font-bold mb-3">プロンプト名</h3>
            <p className="text-sm text-gray-600 mb-3">
              評価履歴に記録するプロンプト名を選択または入力してください。
            </p>

            <div className="flex gap-3 items-center">
              <select
                className="flex-1 border border-gray-300 rounded-md p-2"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
              >
                <option value="デフォルト">デフォルト</option>
                <option value="カスタム">カスタム（手動入力）</option>
                {savedPromptsList.map((prompt) => (
                  <option key={prompt.id} value={prompt.name}>
                    {prompt.name}
                  </option>
                ))}
              </select>

              {promptName === 'カスタム' && (
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-md p-2"
                  placeholder="プロンプト名を入力"
                  onChange={(e) => setPromptName(e.target.value || 'カスタム')}
                />
              )}
            </div>
          </div>

          {/* 評価実行ボタン */}
          <div className="mt-6">
            <Button
              onClick={handleEvaluateAll}
              disabled={loading || testConditions.length === 0}
              className="w-full md:w-auto"
            >
              {loading
                ? currentCondition
                  ? `条件 ${currentCondition} を評価中... (${progress.current}/${progress.total})`
                  : `評価実行中... (${testConditions.length}条件)`
                : '全条件を評価'}
            </Button>
            {loading && (
              <p className="text-sm text-blue-600 mt-2">
                評価実行中です。ネットワークエラーが発生しても処理は継続されます...
              </p>
            )}
            {!loading && (
              <p className="text-sm text-gray-600 mt-2">
                {testConditions.length}件の条件について検索・評価を実行します
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}
        </div>

        {/* 評価履歴セクション */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">評価履歴（最新5件）</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const data = localStorage.getItem('evaluation_histories');
                  console.log('📊 LocalStorage評価履歴:', data);
                  if (data) {
                    const parsed = JSON.parse(data);
                    console.log('パース後:', parsed);
                    alert(`評価履歴: ${parsed.length}件\n\n詳細はコンソールを確認してください`);
                  } else {
                    alert('評価履歴がありません');
                  }
                }}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
              >
                🔍 データ確認
              </button>
              <button
                onClick={() => {
                  if (confirm('評価履歴を全て削除しますか？')) {
                    localStorage.removeItem('evaluation_histories');
                    setEvaluationHistories([]);
                    alert('評価履歴を削除しました');
                  }
                }}
                className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
              >
                🗑️ 履歴削除
              </button>
            </div>
          </div>

          {evaluationHistories.length === 0 ? (
            <div className="p-6 bg-gray-50 border border-gray-300 rounded text-center">
              <p className="text-gray-600 mb-2">評価履歴がありません</p>
              <p className="text-sm text-gray-500">
                「全条件を評価」ボタンをクリックして評価を実行すると、ここに履歴が表示されます。
              </p>
            </div>
          ) : (

            <div className="space-y-4">
              {evaluationHistories.map((history) => (
                <div key={history.id} className="border border-gray-200 rounded-lg">
                  {/* ヘッダー部分 */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      console.log('クリック:', history.id, '現在の展開ID:', expandedHistoryId);
                      console.log('履歴データ:', history);
                      setExpandedHistoryId(expandedHistoryId === history.id ? null : history.id);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">
                            {history.timestamp.toLocaleString('ja-JP')}
                          </span>
                          {history.promptName && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded font-semibold">
                              📌 {history.promptName}
                            </span>
                          )}
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
                      {/* デバッグ情報 */}
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                        <p className="font-bold mb-1">デバッグ情報:</p>
                        <p>履歴ID: {history.id}</p>
                        <p>results配列: {history.results ? `${history.results.length}件` : '存在しない'}</p>
                        <p>promptName: {history.promptName || '未設定'}</p>
                        {history.results && history.results.length > 0 && (
                          <p>最初の結果のcondition_id: {history.results[0].condition_id}</p>
                        )}
                      </div>

                      <div className="space-y-4">
                        {history.results && history.results.length > 0 ? (
                          history.results.map((result) => (
                            <div
                              key={result.condition_id}
                              className="border border-gray-200 rounded-lg p-4 bg-white"
                            >
                              <h4 className="font-bold text-sm mb-3">条件 {result.condition_id}</h4>

                              {/* 条件の詳細情報 */}
                              {result.condition_details && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                                  <h5 className="font-semibold text-xs mb-2 text-blue-900">入力条件</h5>
                                  <div className="space-y-2 text-xs">
                                    {result.condition_details.目的 && (
                                      <div>
                                        <span className="font-semibold text-gray-700">目的: </span>
                                        <span className="text-gray-600">{result.condition_details.目的}</span>
                                      </div>
                                    )}
                                    {result.condition_details.材料 && (
                                      <div>
                                        <span className="font-semibold text-gray-700">材料: </span>
                                        <span className="text-gray-600 whitespace-pre-wrap">{result.condition_details.材料}</span>
                                      </div>
                                    )}
                                    {result.condition_details.実験手順 && (
                                      <div>
                                        <span className="font-semibold text-gray-700">実験手順: </span>
                                        <span className="text-gray-600 whitespace-pre-wrap">{result.condition_details.実験手順}</span>
                                      </div>
                                    )}
                                    {result.condition_details.重点指示 && (
                                      <div>
                                        <span className="font-semibold text-gray-700">重点指示: </span>
                                        <span className="text-gray-600">{result.condition_details.重点指示}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 古いデータの場合の警告 */}
                              {!result.condition_details && (
                                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                  <p className="text-xs text-yellow-800">
                                    ⚠️ この評価は古い形式で保存されています。入力条件の詳細情報を確認するには、再度評価を実行してください。
                                  </p>
                                </div>
                              )}

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

                            {/* 検索結果（リランキング後） */}
                            {result.candidates && result.candidates.length > 0 ? (
                              <div className="mb-3">
                                <h5 className="font-semibold text-xs mb-2">
                                  検索結果（リランキング後、Top 10）
                                </h5>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs border border-gray-300">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">ランク</th>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">ノートID</th>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">スコア</th>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">正解</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {result.candidates.map((candidate) => {
                                        const isCorrect = result.ground_truth?.some(
                                          (gt) => gt.noteId === candidate.noteId
                                        ) || false;
                                        return (
                                          <tr
                                            key={candidate.rank}
                                            className={isCorrect ? 'bg-green-50' : ''}
                                          >
                                            <td className="px-2 py-1 border-b border-gray-200">{candidate.rank}</td>
                                            <td className="px-2 py-1 border-b border-gray-200 font-mono">
                                              {candidate.noteId}
                                            </td>
                                            <td className="px-2 py-1 border-b border-gray-200">
                                              {candidate.score?.toFixed(3) || 'N/A'}
                                            </td>
                                            <td className="px-2 py-1 border-b border-gray-200">
                                              {isCorrect ? (
                                                <span className="text-green-600 font-bold">✓</span>
                                              ) : (
                                                <span className="text-gray-400">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3 p-3 bg-gray-50 border border-gray-300 rounded">
                                <p className="text-xs text-gray-600">検索結果がありません</p>
                              </div>
                            )}

                            {/* 正解データ */}
                            {result.ground_truth && result.ground_truth.length > 0 ? (
                              <div>
                                <h5 className="font-semibold text-xs mb-2">
                                  正解データ (Ground Truth、Top 10)
                                </h5>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs border border-gray-300">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">正解順位</th>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">ノートID</th>
                                        <th className="px-2 py-1 border-b border-gray-300 text-left">検出</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {result.ground_truth.map((gt) => {
                                        const wasFound = result.candidates?.some(
                                          (c) => c.noteId === gt.noteId
                                        ) || false;
                                        const foundRank = result.candidates?.find(
                                          (c) => c.noteId === gt.noteId
                                        )?.rank;
                                        return (
                                          <tr key={gt.rank} className={wasFound ? 'bg-green-50' : 'bg-red-50'}>
                                            <td className="px-2 py-1 border-b border-gray-200">{gt.rank}</td>
                                            <td className="px-2 py-1 border-b border-gray-200 font-mono">
                                              {gt.noteId}
                                            </td>
                                            <td className="px-2 py-1 border-b border-gray-200">
                                              {wasFound ? (
                                                <span className="text-green-600 font-bold">
                                                  ✓ (ランク {foundRank})
                                                </span>
                                              ) : (
                                                <span className="text-red-600">✗ 未検出</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-gray-50 border border-gray-300 rounded">
                                <p className="text-xs text-gray-600">正解データがありません</p>
                              </div>
                            )}
                          </div>
                        ))
                        ) : (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-sm text-yellow-800">
                              評価結果がありません。評価を実行してください。
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
