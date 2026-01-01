'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function TeamsPage() {
  const { user, teams, currentTeamId, idToken, refreshTeams } = useAuth();
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createdTeam, setCreatedTeam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setError('チーム名を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: teamName,
          description: teamDescription
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCreatedTeam(data.team);
        setTeamName('');
        setTeamDescription('');
        await refreshTeams();
        alert(`チーム「${data.team.name}」を作成しました！\n\n招待コード: ${data.team.inviteCode}\n\nこのコードを共有して、他のユーザーをチームに招待できます。`);
      } else {
        setError(data.detail || 'チーム作成に失敗しました');
      }
    } catch (err) {
      setError('チーム作成エラー: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      setError('招待コードを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          inviteCode: inviteCode
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setInviteCode('');
        await refreshTeams();
        alert(`チームに参加しました！`);
      } else {
        setError(data.detail || 'チーム参加に失敗しました');
      }
    } catch (err) {
      setError('チーム参加エラー: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">ログインしてください</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">チーム管理</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* 現在のチーム一覧 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">所属チーム</h2>
          {teams.length === 0 ? (
            <p className="text-gray-500">まだチームに所属していません</p>
          ) : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className={`p-3 border rounded ${
                    team.id === currentTeamId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-gray-500">役割: {team.role}</p>
                    </div>
                    {team.id === currentTeamId && (
                      <span className="text-sm text-blue-600 font-medium">選択中</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* チーム作成フォーム */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">新しいチームを作成</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                チーム名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 研究室A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                説明（任意）
              </label>
              <textarea
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="チームの説明を入力"
                rows={3}
              />
            </div>
            <button
              onClick={handleCreateTeam}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '作成中...' : 'チームを作成'}
            </button>
          </div>

          {createdTeam && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="font-medium text-green-900 mb-2">チーム作成成功！</p>
              <div className="space-y-1 text-sm">
                <p><strong>チーム名:</strong> {createdTeam.name}</p>
                <p><strong>招待コード:</strong> <code className="bg-white px-2 py-1 rounded">{createdTeam.inviteCode}</code></p>
                <p className="text-green-700 mt-2">このコードを共有して他のユーザーを招待できます。</p>
              </div>
            </div>
          )}
        </div>

        {/* チーム参加フォーム */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">招待コードでチームに参加</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                招待コード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: ABC-XYZ-123"
              />
            </div>
            <button
              onClick={handleJoinTeam}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? '参加中...' : 'チームに参加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
