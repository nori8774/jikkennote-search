'use client';

import { useState } from 'react';
import Button from '@/components/Button';
import { api, DictionaryUpdateRequest } from '@/lib/api';
import { storage } from '@/lib/storage';

interface NewTerm {
  term: string;
  similar_candidates: Array<{
    term: string;
    canonical: string;
    similarity: number;
    embedding_similarity: number;
    combined_score: number;
  }>;
  llm_suggestion: {
    decision: 'variant' | 'new';
    reason: string;
    suggested_canonical?: string;
  };
  user_decision?: 'new' | 'variant' | 'skip';
  user_canonical?: string;
  user_category?: string;
}

export default function IngestPage() {
  const [sourceFolder, setSourceFolder] = useState('');
  const [postAction, setPostAction] = useState<'delete' | 'archive' | 'keep'>('keep');
  const [archiveFolder, setArchiveFolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ingestResult, setIngestResult] = useState<{
    new_notes: string[];
    skipped_notes: string[];
  } | null>(null);
  const [newTerms, setNewTerms] = useState<NewTerm[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleIngest = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    setIngestResult(null);

    try {
      const openaiApiKey = storage.getOpenAIApiKey();
      if (!openaiApiKey) {
        throw new Error('OpenAI APIキーが設定されていません');
      }

      const embeddingModel = storage.getEmbeddingModel();

      const response = await api.ingest({
        openai_api_key: openaiApiKey,
        source_folder: sourceFolder || undefined,
        post_action: postAction,
        archive_folder: archiveFolder || undefined,
        embedding_model: embeddingModel || undefined,
      });

      if (response.success) {
        setIngestResult({
          new_notes: response.new_notes,
          skipped_notes: response.skipped_notes,
        });
        setSuccess(response.message);

        // 新出単語分析を提案
        if (response.new_notes.length > 0) {
          const analyzeNow = confirm(
            `${response.new_notes.length}件の新規ノートが取り込まれました。\n新出単語の分析を実行しますか？`
          );
          if (analyzeNow) {
            await handleAnalyze(response.new_notes);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'ノートの取り込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (noteIds: string[]) => {
    setError('');
    setAnalyzing(true);

    try {
      const openaiApiKey = storage.getOpenAIApiKey();
      if (!openaiApiKey) {
        throw new Error('OpenAI APIキーが設定されていません');
      }

      // ノートの内容を取得（実際には、取り込み時に既に読み込まれているはずだが、ここでは再取得）
      // 簡略化のため、ダミーコンテンツを使用（実際の実装では、ノートファイルを読み込む必要がある）
      const noteContents = noteIds.map(() => '## 材料\n- サンプル材料A\n- サンプル材料B');

      const response = await api.analyzeNewTerms({
        note_ids: noteIds,
        note_contents: noteContents,
        openai_api_key: openaiApiKey,
      });

      if (response.success) {
        setNewTerms(response.new_terms.map(term => ({
          ...term,
          user_decision: term.llm_suggestion.decision, // LLMの提案をデフォルト値に
          user_canonical: term.llm_suggestion.suggested_canonical,
          user_category: undefined,
        })));
        setShowTermsModal(true);
      }
    } catch (err: any) {
      setError(err.message || '新出単語の分析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateDecision = (index: number, field: keyof NewTerm, value: any) => {
    const updated = [...newTerms];
    updated[index] = { ...updated[index], [field]: value };
    setNewTerms(updated);
  };

  const handleSaveTerms = async () => {
    setError('');
    setLoading(true);

    try {
      const updates = newTerms
        .filter(term => term.user_decision !== 'skip')
        .map(term => ({
          term: term.term,
          decision: term.user_decision!,
          canonical: term.user_canonical,
          category: term.user_category,
          note: term.llm_suggestion.reason,
        }));

      if (updates.length === 0) {
        setSuccess('更新する用語がありません');
        setShowTermsModal(false);
        return;
      }

      const response = await api.updateDictionary({ updates });

      if (response.success) {
        setSuccess(`${response.updated_entries}件の用語を辞書に追加しました`);
        setShowTermsModal(false);
        setNewTerms([]);
      }
    } catch (err: any) {
      setError(err.message || '辞書の更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">ノート取り込み</h1>

        {/* 設定フォーム */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">取り込み設定</h2>

          <div className="space-y-4">
            {/* ソースフォルダ */}
            <div>
              <label className="block text-sm font-medium mb-2">
                ソースフォルダ（空欄の場合はデフォルト）
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md p-3"
                value={sourceFolder}
                onChange={(e) => setSourceFolder(e.target.value)}
                placeholder="./notes/new"
              />
              <p className="text-sm text-text-secondary mt-1">
                取り込む新規ノートが保存されているフォルダ
              </p>
            </div>

            {/* 取り込み後のアクション */}
            <div>
              <label className="block text-sm font-medium mb-2">取り込み後のアクション</label>
              <select
                className="w-full border border-gray-300 rounded-md p-3"
                value={postAction}
                onChange={(e) => setPostAction(e.target.value as any)}
              >
                <option value="keep">ファイルを残す</option>
                <option value="archive">アーカイブフォルダへ移動</option>
                <option value="delete">ファイルを削除</option>
              </select>
            </div>

            {/* アーカイブフォルダ */}
            {postAction === 'archive' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  アーカイブフォルダ（空欄の場合はデフォルト）
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={archiveFolder}
                  onChange={(e) => setArchiveFolder(e.target.value)}
                  placeholder="./notes/archived"
                />
              </div>
            )}

            {/* 実行ボタン */}
            <div>
              <Button onClick={handleIngest} disabled={loading || analyzing}>
                {loading ? '取り込み中...' : '取り込み実行'}
              </Button>
            </div>
          </div>

          {/* 通知 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-4">
              {success}
            </div>
          )}
        </div>

        {/* 取り込み結果 */}
        {ingestResult && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">取り込み結果</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 新規ノート */}
              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold mb-2">
                  新規取り込み ({ingestResult.new_notes.length}件)
                </h3>
                {ingestResult.new_notes.length === 0 ? (
                  <p className="text-text-secondary">なし</p>
                ) : (
                  <ul className="space-y-1">
                    {ingestResult.new_notes.map((noteId, index) => (
                      <li key={index} className="text-sm">
                        {noteId}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* スキップしたノート */}
              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold mb-2">
                  スキップ ({ingestResult.skipped_notes.length}件)
                </h3>
                {ingestResult.skipped_notes.length === 0 ? (
                  <p className="text-text-secondary">なし</p>
                ) : (
                  <ul className="space-y-1">
                    {ingestResult.skipped_notes.map((noteId, index) => (
                      <li key={index} className="text-sm text-text-secondary">
                        {noteId}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 新出単語判定モーダル */}
        {showTermsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-4">新出単語の判定</h2>

              <div className="space-y-4 mb-6">
                {newTerms.map((term, index) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-4">
                    {/* 用語名 */}
                    <div className="font-bold text-lg mb-2">{term.term}</div>

                    {/* LLM提案 */}
                    <div className="bg-blue-50 p-3 rounded mb-3">
                      <div className="text-sm font-medium mb-1">AI提案</div>
                      <div className="text-sm">
                        判定: {term.llm_suggestion.decision === 'new' ? '新規物質' : '表記揺れ'}
                      </div>
                      <div className="text-sm">理由: {term.llm_suggestion.reason}</div>
                      {term.llm_suggestion.suggested_canonical && (
                        <div className="text-sm">
                          紐付け先: {term.llm_suggestion.suggested_canonical}
                        </div>
                      )}
                    </div>

                    {/* 類似候補 */}
                    {term.similar_candidates.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium mb-1">類似候補</div>
                        <div className="flex flex-wrap gap-2">
                          {term.similar_candidates.slice(0, 3).map((cand, cIndex) => (
                            <span
                              key={cIndex}
                              className="bg-gray-100 px-2 py-1 rounded text-sm"
                            >
                              {cand.term} (正規化: {cand.canonical}, 類似度:{' '}
                              {cand.combined_score.toFixed(2)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ユーザー判定 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">判定</label>
                        <select
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                          value={term.user_decision}
                          onChange={(e) =>
                            handleUpdateDecision(index, 'user_decision', e.target.value)
                          }
                        >
                          <option value="new">新規物質</option>
                          <option value="variant">表記揺れ</option>
                          <option value="skip">スキップ</option>
                        </select>
                      </div>

                      {term.user_decision === 'variant' && (
                        <div>
                          <label className="block text-sm font-medium mb-1">正規化名</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={term.user_canonical || ''}
                            onChange={(e) =>
                              handleUpdateDecision(index, 'user_canonical', e.target.value)
                            }
                            placeholder="紐付ける正規化名"
                          />
                        </div>
                      )}

                      {term.user_decision === 'new' && (
                        <div>
                          <label className="block text-sm font-medium mb-1">カテゴリ</label>
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={term.user_category || ''}
                            onChange={(e) =>
                              handleUpdateDecision(index, 'user_category', e.target.value)
                            }
                            placeholder="試薬、溶媒など"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* アクションボタン */}
              <div className="flex gap-4">
                <Button onClick={handleSaveTerms} disabled={loading}>
                  {loading ? '保存中...' : '辞書を更新'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowTermsModal(false)}
                  disabled={loading}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
