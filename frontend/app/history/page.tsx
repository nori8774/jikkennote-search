'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import Button from '@/components/Button';
import ReactMarkdown from 'react-markdown';
import { api } from '@/lib/api';

interface SearchHistory {
  id: string;
  timestamp: Date;
  query: {
    purpose: string;
    materials: string;
    methods: string;
    instruction?: string;
  };
  results: {
    noteId: string;
    score: number;
    rank: number;
  }[];
}

export default function HistoryPage() {
  const [histories, setHistories] = useState<SearchHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<SearchHistory | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHistories();
  }, []);

  const loadHistories = () => {
    const stored = localStorage.getItem('search_histories');
    if (stored) {
      const parsed = JSON.parse(stored);
      // timestamp を Date オブジェクトに変換
      const histories = parsed.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      }));
      setHistories(histories);
    }
  };

  const handleViewNote = async (noteId: string) => {
    setError('');
    setLoading(true);
    setSelectedNoteId(noteId);

    try {
      const response = await api.getNote(noteId);

      if (!response.success || !response.note) {
        setError(response.error || 'ノートの読み込みに失敗しました');
        return;
      }

      setNoteContent(response.note.content);
    } catch (err: any) {
      setError(err.message || 'ノートの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistory = (id: string) => {
    const updated = histories.filter(h => h.id !== id);
    setHistories(updated);
    localStorage.setItem('search_histories', JSON.stringify(updated));
  };

  const handleClearAll = () => {
    if (confirm('すべての履歴を削除しますか？')) {
      setHistories([]);
      localStorage.removeItem('search_histories');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">検索履歴</h1>
          <Button variant="secondary" onClick={handleClearAll}>
            すべて削除
          </Button>
        </div>

        {histories.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-500">
            <p>検索履歴はまだありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    検索クエリ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    上位10件
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {histories.map((history) => (
                  <tr key={history.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {history.timestamp.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-md">
                        <p className="font-medium">目的: {history.query.purpose.substring(0, 50)}...</p>
                        <p className="text-gray-500 text-xs">材料: {history.query.materials.substring(0, 30)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {history.results.slice(0, 10).map((result) => (
                          <button
                            key={result.noteId}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey) {
                                // Ctrl/Cmdクリックで新しいタブで開く
                                window.open(`/viewer?id=${result.noteId}`, '_blank');
                              } else {
                                // 通常クリックでモーダル表示
                                handleViewNote(result.noteId);
                              }
                            }}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 cursor-pointer"
                            title="クリック: モーダル表示 | Ctrl+クリック: 新しいタブで開く"
                          >
                            {result.noteId}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        variant="secondary"
                        onClick={() => handleDeleteHistory(history.id)}
                        className="text-xs py-1 px-3"
                      >
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ノート表示モーダル */}
        {selectedNoteId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold">実験ノート {selectedNoteId}</h2>
                <button
                  onClick={() => {
                    setSelectedNoteId(null);
                    setNoteContent('');
                    setError('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {loading && (
                  <div className="text-center py-8">
                    <p>読み込み中...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}

                {noteContent && !loading && (
                  <div className="prose max-w-none">
                    <ReactMarkdown>{noteContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
