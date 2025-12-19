'use client';

import { useState } from 'react';
import Button from '@/components/Button';
import ReactMarkdown from 'react-markdown';
import { api } from '@/lib/api';

export default function ViewerPage() {
  const [noteId, setNoteId] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<{
    purpose?: string;
    materials?: string;
    methods?: string;
    results?: string;
  }>({});

  const handleLoad = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await api.getNote(noteId);

      if (!response.success || !response.note) {
        setError(response.error || 'ノートの読み込みに失敗しました');
        return;
      }

      setNoteContent(response.note.content);
      setSections(response.note.sections);

    } catch (err: any) {
      setError(err.message || 'ノートの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySection = (sectionName: string, content?: string) => {
    if (!content) return;

    // TODO: 検索ページの対応するフィールドにコピーする機能を実装
    // 現在はクリップボードにコピー
    navigator.clipboard.writeText(content);
    alert(`${sectionName}をクリップボードにコピーしました`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">実験ノートビューワー</h1>

        {/* 入力フォーム */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">実験ノートID</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md p-3"
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                placeholder="例: ID3-14"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleLoad}
                disabled={loading || !noteId}
              >
                {loading ? '読み込み中...' : '表示'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {error}
            </div>
          )}
        </div>

        {/* ノート表示 */}
        {noteContent && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">実験ノート {noteId}</h2>
            </div>

            {/* セクション別コピーボタン付き表示 */}
            <div className="space-y-6">
              {sections.purpose && (
                <div className="border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">目的・背景</h3>
                    <Button
                      variant="secondary"
                      onClick={() => handleCopySection('目的・背景', sections.purpose)}
                      className="text-sm py-1 px-3"
                    >
                      コピー
                    </Button>
                  </div>
                  <div className="prose max-w-none">
                    <ReactMarkdown>{sections.purpose}</ReactMarkdown>
                  </div>
                </div>
              )}

              {sections.materials && (
                <div className="border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">材料</h3>
                    <Button
                      variant="secondary"
                      onClick={() => handleCopySection('材料', sections.materials)}
                      className="text-sm py-1 px-3"
                    >
                      コピー
                    </Button>
                  </div>
                  <div className="prose max-w-none">
                    <ReactMarkdown>{sections.materials}</ReactMarkdown>
                  </div>
                </div>
              )}

              {sections.methods && (
                <div className="border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">方法</h3>
                    <Button
                      variant="secondary"
                      onClick={() => handleCopySection('方法', sections.methods)}
                      className="text-sm py-1 px-3"
                    >
                      コピー
                    </Button>
                  </div>
                  <div className="prose max-w-none">
                    <ReactMarkdown>{sections.methods}</ReactMarkdown>
                  </div>
                </div>
              )}

              {sections.results && (
                <div className="border border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">結果</h3>
                    <Button
                      variant="secondary"
                      onClick={() => handleCopySection('結果', sections.results)}
                      className="text-sm py-1 px-3"
                    >
                      コピー
                    </Button>
                  </div>
                  <div className="prose max-w-none">
                    <ReactMarkdown>{sections.results}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* 全文表示 */}
            <div className="mt-8 pt-8 border-t border-gray-300">
              <h3 className="text-lg font-bold mb-4">全文</h3>
              <div className="prose max-w-none">
                <ReactMarkdown>{noteContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
