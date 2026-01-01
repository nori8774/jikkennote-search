'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from './firebase-config';

// チーム情報の型定義
export interface Team {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

// 認証コンテキストの型定義
interface AuthContextType {
  user: User | null;
  currentTeamId: string | null;
  teams: Team[];
  idToken: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchTeam: (teamId: string) => void;
  refreshTeams: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ローカルストレージのキー
const STORAGE_KEYS = {
  CURRENT_TEAM_ID: 'current_team_id',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // チーム一覧を取得
  const fetchTeams = async (token: string) => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/teams`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }

      const data = await response.json();
      return data.teams || [];
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  };

  // チーム一覧を更新
  const refreshTeams = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const teamsList = await fetchTeams(token);
      setTeams(teamsList);

      // チームがある場合、現在のチームIDが有効かチェック
      if (teamsList.length > 0) {
        const storedTeamId = localStorage.getItem(STORAGE_KEYS.CURRENT_TEAM_ID);
        const validTeam = teamsList.find((t: Team) => t.id === storedTeamId);

        if (validTeam) {
          setCurrentTeamId(storedTeamId);
        } else {
          // 無効な場合は最初のチームを選択
          const firstTeamId = teamsList[0].id;
          setCurrentTeamId(firstTeamId);
          localStorage.setItem(STORAGE_KEYS.CURRENT_TEAM_ID, firstTeamId);
        }
      }
    } catch (error) {
      console.error('Error refreshing teams:', error);
    }
  };

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // ID Token取得
          const token = await firebaseUser.getIdToken();
          setIdToken(token);

          // チーム一覧取得
          const teamsList = await fetchTeams(token);
          setTeams(teamsList);

          // 現在のチームID復元
          if (teamsList.length > 0) {
            const storedTeamId = localStorage.getItem(STORAGE_KEYS.CURRENT_TEAM_ID);
            const validTeam = teamsList.find((t: Team) => t.id === storedTeamId);

            if (validTeam) {
              setCurrentTeamId(storedTeamId);
            } else {
              // 初回ログインまたは無効なチームIDの場合、最初のチームを選択
              const firstTeamId = teamsList[0].id;
              setCurrentTeamId(firstTeamId);
              localStorage.setItem(STORAGE_KEYS.CURRENT_TEAM_ID, firstTeamId);
            }
          }
        } catch (error) {
          console.error('Error during authentication setup:', error);
        }
      } else {
        setIdToken(null);
        setCurrentTeamId(null);
        setTeams([]);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Googleログイン
  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
      // リダイレクト後、getRedirectResultとonAuthStateChangedで自動的に処理される
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // ログアウト
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_TEAM_ID);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // チーム切り替え
  const switchTeam = (teamId: string) => {
    const validTeam = teams.find(t => t.id === teamId);
    if (validTeam) {
      setCurrentTeamId(teamId);
      localStorage.setItem(STORAGE_KEYS.CURRENT_TEAM_ID, teamId);
    }
  };

  const value: AuthContextType = {
    user,
    currentTeamId,
    teams,
    idToken,
    loading,
    login,
    logout,
    switchTeam,
    refreshTeams,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// カスタムフック
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
