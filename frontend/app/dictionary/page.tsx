'use client';

import { useState, useEffect, useRef } from 'react';
import Button from '@/components/Button';
import { api, DictionaryEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function DictionaryPage() {
  const { idToken, currentTeamId } = useAuth();
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 編集モーダル用
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const [editForm, setEditForm] = useState({
    canonical: '',
    variants: [] as string[],
    category: '',
    note: '',
  });

  // ファイル入力用のref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 辞書を読み込み
  const loadDictionary = async () => {
    // 認証情報が揃っていない場合はスキップ
    if (!idToken || !currentTeamId) {
      setError('認証情報が取得できていません。ログインしているか確認してください。');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.getDictionary(idToken, currentTeamId);
      if (response.success) {
        setEntries(response.entries);
        setFilteredEntries(response.entries);
      }
    } catch (err: any) {
      setError(err.message || '辞書の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 初期読み込み（認証情報が揃ったら実行）
  useEffect(() => {
    if (idToken && currentTeamId) {
      loadDictionary();
    }
  }, [idToken, currentTeamId]);

  // 検索フィルター
  useEffect(() => {
    if (!searchQuery) {
      setFilteredEntries(entries);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = entries.filter(entry =>
      entry.canonical.toLowerCase().includes(query) ||
      entry.variants.some(v => v.toLowerCase().includes(query)) ||
      (entry.category && entry.category.toLowerCase().includes(query))
    );
    setFilteredEntries(filtered);
  }, [searchQuery, entries]);

  // エクスポート
  const handleExport = async (format: 'yaml' | 'json' | 'csv') => {
    if (!idToken || !currentTeamId) {
      setError('認証情報が取得できていません。ページを再読み込みしてください。');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const blob = await api.exportDictionary(format, idToken, currentTeamId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dictionary.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(`辞書を ${format.toUpperCase()} 形式でエクスポートしました`);
    } catch (err: any) {
      setError(err.message || 'エクスポートに失敗しました');
    }
  };

  // インポート
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!idToken || !currentTeamId) {
      setError('認証情報が取得できていません。ページを再読み込みしてください。');
      event.target.value = '';
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.importDictionary(file, idToken, currentTeamId);
      if (response.success) {
        setSuccess(response.message);
        await loadDictionary();
      }
    } catch (err: any) {
      setError(err.message || 'インポートに失敗しました');
    } finally {
      setLoading(false);
      // ファイル入力をリセット
      event.target.value = '';
    }
  };

  // 編集モーダルを開く
  const openEditModal = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setEditForm({
      canonical: entry.canonical,
      variants: [...entry.variants],
      category: entry.category || '',
      note: entry.note || '',
    });
    setShowEditModal(true);
  };

  // 編集を保存
  const handleEdit = async () => {
    if (!idToken || !currentTeamId || !editingEntry) {
      setError('認証情報が取得できていません。ページを再読み込みしてください。');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updates: any = {};

      // 正規化名が変更されている場合
      if (editForm.canonical !== editingEntry.canonical) {
        updates.new_canonical = editForm.canonical;
      }

      // バリアントが変更されている場合
      if (JSON.stringify(editForm.variants) !== JSON.stringify(editingEntry.variants)) {
        updates.variants = editForm.variants;
      }

      // カテゴリが変更されている場合
      if (editForm.category !== (editingEntry.category || '')) {
        updates.category = editForm.category;
      }

      // メモが変更されている場合
      if (editForm.note !== (editingEntry.note || '')) {
        updates.note = editForm.note;
      }

      const response = await api.editDictionaryEntry(
        editingEntry.canonical,
        updates,
        idToken,
        currentTeamId
      );

      if (response.success) {
        setSuccess(response.message);
        setShowEditModal(false);
        await loadDictionary();
      }
    } catch (err: any) {
      setError(err.message || 'エントリの編集に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 削除
  const handleDelete = async (canonical: string) => {
    if (!idToken || !currentTeamId) {
      setError('認証情報が取得できていません。ページを再読み込みしてください。');
      return;
    }

    if (!confirm(`「${canonical}」を削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.deleteDictionaryEntry(canonical, idToken, currentTeamId);
      if (response.success) {
        setSuccess(response.message);
        await loadDictionary();
      }
    } catch (err: any) {
      setError(err.message || 'エントリの削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">正規化辞書管理</h1>

        {/* アクションバー */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            {/* 検索 */}
            <div className="flex-1 min-w-[300px]">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md p-3"
                placeholder="正規化名、バリアント、カテゴリで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* エクスポート */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => handleExport('yaml')}
                className="text-sm"
              >
                YAML出力
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleExport('json')}
                className="text-sm"
              >
                JSON出力
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleExport('csv')}
                className="text-sm"
              >
                CSV出力
              </Button>
            </div>

            {/* インポート */}
            <div className="flex flex-col gap-1">
              <Button
                variant="secondary"
                className="text-sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                📂 ファイルから読み込み
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml,.json,.csv"
                className="hidden"
                onChange={handleImport}
              />
              <p className="text-xs text-gray-600">
                YAML/JSON/CSV形式のファイルを選択してインポート
              </p>
            </div>

            {/* リロード */}
            <Button
              onClick={loadDictionary}
              disabled={loading}
              className="text-sm"
            >
              {loading ? '読み込み中...' : '再読み込み'}
            </Button>
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

        {/* 統計情報 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">統計情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-300 rounded-lg p-4">
              <div className="text-sm text-text-secondary">総エントリ数</div>
              <div className="text-2xl font-bold">{entries.length}</div>
            </div>
            <div className="border border-gray-300 rounded-lg p-4">
              <div className="text-sm text-text-secondary">総バリアント数</div>
              <div className="text-2xl font-bold">
                {entries.reduce((sum, e) => sum + e.variants.length, 0)}
              </div>
            </div>
            <div className="border border-gray-300 rounded-lg p-4">
              <div className="text-sm text-text-secondary">検索結果</div>
              <div className="text-2xl font-bold">{filteredEntries.length}</div>
            </div>
          </div>
        </div>

        {/* エントリ一覧 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">エントリ一覧</h2>

          {loading && <div className="text-center py-8">読み込み中...</div>}

          {!loading && filteredEntries.length === 0 && (
            <div className="text-center py-8 text-text-secondary">
              {searchQuery ? '検索結果が見つかりません' : 'エントリがありません'}
            </div>
          )}

          {!loading && filteredEntries.length > 0 && (
            <div className="space-y-4">
              {filteredEntries.map((entry, index) => (
                <div
                  key={index}
                  className="border border-gray-300 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    {/* 正規化名 */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm text-text-secondary mb-1">正規化名</div>
                      <div className="text-lg font-bold">{entry.canonical}</div>
                    </div>

                    {/* バリアント */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm text-text-secondary mb-1">
                        表記揺れ ({entry.variants.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {entry.variants.map((variant, vIndex) => (
                          <span
                            key={vIndex}
                            className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                          >
                            {variant}
                          </span>
                        ))}
                        {entry.variants.length === 0 && (
                          <span className="text-text-secondary text-sm">なし</span>
                        )}
                      </div>
                    </div>

                    {/* カテゴリ */}
                    {entry.category && (
                      <div className="min-w-[100px]">
                        <div className="text-sm text-text-secondary mb-1">カテゴリ</div>
                        <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm inline-block">
                          {entry.category}
                        </div>
                      </div>
                    )}

                    {/* アクションボタン */}
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => openEditModal(entry)}
                        className="text-sm"
                      >
                        編集
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleDelete(entry.canonical)}
                        className="text-sm bg-red-100 hover:bg-red-200 text-red-800"
                      >
                        削除
                      </Button>
                    </div>
                  </div>

                  {/* メモ */}
                  {entry.note && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-text-secondary mb-1">メモ</div>
                      <div className="text-sm">{entry.note}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 編集モーダル */}
        {showEditModal && editingEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">エントリ編集</h2>

              {/* 正規化名 */}
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">正規化名</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={editForm.canonical}
                  onChange={(e) => setEditForm({ ...editForm, canonical: e.target.value })}
                />
              </div>

              {/* バリアント */}
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">表記揺れ（カンマ区切り）</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={editForm.variants.join(', ')}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    variants: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                  })}
                  placeholder="例: エタノール, EtOH, 無水エタノール"
                />
              </div>

              {/* カテゴリ */}
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">カテゴリ</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="例: 溶媒, 試薬, 器具"
                />
              </div>

              {/* メモ */}
              <div className="mb-6">
                <label className="block text-sm font-bold mb-2">メモ</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3"
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  rows={3}
                  placeholder="補足情報やメモを入力"
                />
              </div>

              {/* ボタン */}
              <div className="flex gap-4 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={loading}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={loading}
                >
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
