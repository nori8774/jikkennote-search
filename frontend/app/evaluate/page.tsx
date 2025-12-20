'use client';

import { useState } from 'react';
import Button from '@/components/Button';

interface TestCase {
  id: string;
  name: string;
  query: {
    purpose: string;
    materials: string;
    methods: string;
  };
  groundTruth: {
    noteId: string;
    relevance: number;
  }[];
}

interface EvaluationResult {
  testCaseId: string;
  metrics: {
    ndcg_10: number;
    precision_3: number;
    precision_5: number;
    precision_10: number;
    recall_10: number;
    mrr: number;
  };
  ranking: {
    noteId: string;
    rank: number;
    score: number;
    groundTruthRank?: number;
    relevance?: number;
  }[];
}

export default function EvaluatePage() {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',');

      // CSVの各行をパース
      const parsedTestCases: { [key: string]: TestCase } = {};

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        const testCaseId = values[0];
        const purpose = values[1];
        const materials = values[2];
        const methods = values[3];
        const noteId = values[4];
        const rank = parseInt(values[5]);
        const relevance = parseFloat(values[6]);

        if (!parsedTestCases[testCaseId]) {
          parsedTestCases[testCaseId] = {
            id: testCaseId,
            name: `テストケース ${testCaseId}`,
            query: { purpose, materials, methods },
            groundTruth: [],
          };
        }

        parsedTestCases[testCaseId].groundTruth.push({
          noteId,
          relevance,
        });
      }

      setTestCases(Object.values(parsedTestCases));
    };

    reader.readAsText(file);
  };

  const handleEvaluate = async (testCase: TestCase) => {
    setLoading(true);
    setError('');

    try {
      // 実装予定: バックエンドのAPI呼び出し
      // const response = await api.evaluate(testCase);

      // 仮の結果
      const mockResult: EvaluationResult = {
        testCaseId: testCase.id,
        metrics: {
          ndcg_10: 0.85,
          precision_3: 0.67,
          precision_5: 0.60,
          precision_10: 0.50,
          recall_10: 0.70,
          mrr: 0.90,
        },
        ranking: testCase.groundTruth.map((gt, index) => ({
          noteId: gt.noteId,
          rank: index + 1,
          score: 1.0 - (index * 0.1),
          groundTruthRank: index + 1,
          relevance: gt.relevance,
        })),
      };

      setEvaluationResults([...evaluationResults, mockResult]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchEvaluate = async () => {
    setLoading(true);
    setError('');
    const results: EvaluationResult[] = [];

    for (const testCase of testCases) {
      try {
        // 実装予定: バックエンドのAPI呼び出し
        const mockResult: EvaluationResult = {
          testCaseId: testCase.id,
          metrics: {
            ndcg_10: Math.random() * 0.3 + 0.7,
            precision_3: Math.random() * 0.3 + 0.5,
            precision_5: Math.random() * 0.3 + 0.5,
            precision_10: Math.random() * 0.3 + 0.4,
            recall_10: Math.random() * 0.3 + 0.6,
            mrr: Math.random() * 0.2 + 0.8,
          },
          ranking: testCase.groundTruth.map((gt, index) => ({
            noteId: gt.noteId,
            rank: index + 1,
            score: 1.0 - (index * 0.1),
            groundTruthRank: index + 1,
            relevance: gt.relevance,
          })),
        };

        results.push(mockResult);
      } catch (err) {
        console.error(err);
      }
    }

    setEvaluationResults(results);
    setLoading(false);
  };

  const calculateAverageMetrics = () => {
    if (evaluationResults.length === 0) return null;

    const sum = evaluationResults.reduce(
      (acc, result) => ({
        ndcg_10: acc.ndcg_10 + result.metrics.ndcg_10,
        precision_3: acc.precision_3 + result.metrics.precision_3,
        precision_5: acc.precision_5 + result.metrics.precision_5,
        precision_10: acc.precision_10 + result.metrics.precision_10,
        recall_10: acc.recall_10 + result.metrics.recall_10,
        mrr: acc.mrr + result.metrics.mrr,
      }),
      { ndcg_10: 0, precision_3: 0, precision_5: 0, precision_10: 0, recall_10: 0, mrr: 0 }
    );

    const count = evaluationResults.length;
    return {
      ndcg_10: (sum.ndcg_10 / count).toFixed(3),
      precision_3: (sum.precision_3 / count).toFixed(3),
      precision_5: (sum.precision_5 / count).toFixed(3),
      precision_10: (sum.precision_10 / count).toFixed(3),
      recall_10: (sum.recall_10 / count).toFixed(3),
      mrr: (sum.mrr / count).toFixed(3),
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">RAG性能評価</h1>

        {/* CSV/Excelインポート */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">テストケースのインポート</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                CSV/Excelファイルをアップロード
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:bg-primary-dark"
              />
              <p className="text-xs text-gray-500 mt-2">
                フォーマット: test_case_id, query_purpose, query_materials, query_methods, note_id, rank, relevance
              </p>
            </div>

            {selectedFile && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>ファイル「{selectedFile.name}」を読み込みました</p>
                <p className="text-sm">テストケース数: {testCases.length}件</p>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* テストケース一覧 */}
        {testCases.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">テストケース一覧</h2>
              <Button onClick={handleBatchEvaluate} disabled={loading}>
                {loading ? '評価実行中...' : 'バッチ評価実行'}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">正解データ数</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">アクション</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {testCases.map((testCase) => (
                    <tr key={testCase.id}>
                      <td className="px-4 py-2 text-sm">{testCase.id}</td>
                      <td className="px-4 py-2 text-sm">
                        <div className="max-w-md">
                          <p className="font-medium">{testCase.query.purpose.substring(0, 50)}...</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">{testCase.groundTruth.length}件</td>
                      <td className="px-4 py-2 text-sm">
                        <Button
                          variant="secondary"
                          onClick={() => handleEvaluate(testCase)}
                          disabled={loading}
                          className="text-xs py-1 px-3"
                        >
                          評価
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 評価結果 */}
        {evaluationResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">評価結果</h2>

            {/* 平均スコア */}
            {calculateAverageMetrics() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold mb-2">平均スコア</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(calculateAverageMetrics()!).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <p className="text-xs text-gray-600 uppercase">{key.replace('_', '@')}</p>
                      <p className="text-2xl font-bold text-blue-600">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 個別結果 */}
            <div className="space-y-4">
              {evaluationResults.map((result) => (
                <div key={result.testCaseId} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold mb-2">テストケース: {result.testCaseId}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">nDCG@10:</span>
                      <span className="ml-2 font-bold">{result.metrics.ndcg_10.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Precision@3:</span>
                      <span className="ml-2 font-bold">{result.metrics.precision_3.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Precision@5:</span>
                      <span className="ml-2 font-bold">{result.metrics.precision_5.toFixed(3)}</span>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
