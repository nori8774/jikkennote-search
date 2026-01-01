/**
 * API Client
 * バックエンドAPIとの通信を行う
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 認証ヘッダーを生成する
 *
 * @param idToken Firebase ID Token
 * @param teamId 現在のチームID
 * @returns 認証ヘッダー
 */
export function getAuthHeaders(idToken: string | null, teamId: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  if (teamId) {
    headers['X-Team-ID'] = teamId;
  }

  return headers;
}

export interface SearchRequest {
  purpose: string;
  materials: string;
  methods: string;
  type?: string;
  instruction?: string;
  openai_api_key: string;
  cohere_api_key: string;
  embedding_model?: string;
  llm_model?: string;
  custom_prompts?: Record<string, string>;
  evaluation_mode?: boolean;  // 評価モード（True: 比較省略、Top10返却）
}

export interface SearchResponse {
  success: boolean;
  message: string;
  retrieved_docs: string[];
  normalized_materials?: string;
  search_query?: string;
}

export interface PromptsResponse {
  success: boolean;
  prompts: Record<string, {
    name: string;
    description: string;
    prompt: string;
  }>;
}

export interface IngestRequest {
  openai_api_key: string;
  source_folder?: string;
  post_action?: 'delete' | 'archive' | 'keep' | 'move_to_processed';
  archive_folder?: string;
  embedding_model?: string;
  rebuild_mode?: boolean;
}

export interface IngestResponse {
  success: boolean;
  message: string;
  new_notes: string[];
  skipped_notes: string[];
}

export interface NoteResponse {
  success: boolean;
  note?: {
    id: string;
    content: string;
    sections: {
      purpose?: string;
      materials?: string;
      methods?: string;
      results?: string;
    };
  };
  error?: string;
}

export interface AnalyzeRequest {
  note_ids: string[];
  note_contents: string[];
  openai_api_key: string;
}

export interface AnalyzeResponse {
  success: boolean;
  new_terms: Array<{
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
  }>;
}

export interface DictionaryEntry {
  canonical: string;
  variants: string[];
  category?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DictionaryResponse {
  success: boolean;
  entries: DictionaryEntry[];
}

export interface DictionaryUpdateRequest {
  updates: Array<{
    term: string;
    decision: 'new' | 'variant';
    canonical?: string;
    category?: string;
    note?: string;
  }>;
}

export interface DictionaryUpdateResponse {
  success: boolean;
  message: string;
  updated_entries: number;
}

export const api = {
  async search(request: SearchRequest, idToken: string | null = null, teamId: string | null = null): Promise<SearchResponse> {
    const headers = getAuthHeaders(idToken, teamId);

    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('OpenAI APIキーが無効です。設定ページで正しいAPIキー（sk-proj-で始まる）を入力してください。');
      }
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || response.statusText;
      throw new Error(`検索エラー: ${errorMessage}`);
    }

    return response.json();
  },

  async getDefaultPrompts(): Promise<PromptsResponse> {
    const response = await fetch(`${API_BASE_URL}/prompts`);

    if (!response.ok) {
      throw new Error(`Get prompts failed: ${response.statusText}`);
    }

    return response.json();
  },

  async uploadNotes(files: FileList, idToken: string | null = null, teamId: string | null = null): Promise<{ success: boolean; message: string; uploaded_files: string[] }> {
    const formData = new FormData();

    // Add all files to form data
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    if (teamId) {
      headers['X-Team-ID'] = teamId;
    }

    const response = await fetch(`${API_BASE_URL}/upload/notes`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  async ingest(request: IngestRequest, idToken: string | null = null, teamId: string | null = null): Promise<IngestResponse> {
    const headers = getAuthHeaders(idToken, teamId);

    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Ingest failed: ${response.statusText}`);
    }

    return response.json();
  },

  async health(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.json();
  },

  async getNote(noteId: string): Promise<NoteResponse> {
    const response = await fetch(`${API_BASE_URL}/notes/${noteId}`);

    if (!response.ok) {
      throw new Error(`Get note failed: ${response.statusText}`);
    }

    return response.json();
  },

  async analyzeNewTerms(request: AnalyzeRequest, idToken: string | null = null, teamId: string | null = null): Promise<AnalyzeResponse> {
    const headers = getAuthHeaders(idToken, teamId);

    const response = await fetch(`${API_BASE_URL}/ingest/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Analyze failed: ${response.statusText}`);
    }

    return response.json();
  },

  async getDictionary(idToken: string | null = null, teamId: string | null = null): Promise<DictionaryResponse> {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/dictionary`, { headers });

    if (!response.ok) {
      throw new Error(`Get dictionary failed: ${response.statusText}`);
    }

    return response.json();
  },

  async updateDictionary(request: DictionaryUpdateRequest, idToken: string | null = null, teamId: string | null = null): Promise<DictionaryUpdateResponse> {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/dictionary/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Update dictionary failed: ${response.statusText}`);
    }

    return response.json();
  },

  async exportDictionary(format: 'yaml' | 'json' | 'csv' = 'yaml', idToken: string | null = null, teamId: string | null = null): Promise<Blob> {
    const headers = getAuthHeaders(idToken, teamId);
    // FormDataの場合はContent-Typeを削除
    delete headers['Content-Type'];
    const response = await fetch(`${API_BASE_URL}/dictionary/export?format=${format}`, { headers });

    if (!response.ok) {
      throw new Error(`Export dictionary failed: ${response.statusText}`);
    }

    return response.blob();
  },

  async importDictionary(file: File, idToken: string | null = null, teamId: string | null = null): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers = getAuthHeaders(idToken, teamId);
    // FormDataの場合はContent-Typeを削除（ブラウザが自動設定）
    delete headers['Content-Type'];

    const response = await fetch(`${API_BASE_URL}/dictionary/import`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Import dictionary failed: ${response.statusText}`);
    }

    return response.json();
  },

  async editDictionaryEntry(
    canonical: string,
    updates: {
      new_canonical?: string;
      variants?: string[];
      category?: string;
      note?: string;
    },
    idToken: string | null = null,
    teamId: string | null = null
  ): Promise<{ success: boolean; message: string }> {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/dictionary/entry`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        canonical,
        ...updates,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Edit dictionary entry failed: ${response.statusText}`);
    }

    return response.json();
  },

  async deleteDictionaryEntry(canonical: string, idToken: string | null = null, teamId: string | null = null): Promise<{ success: boolean; message: string }> {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/dictionary/entry`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ canonical }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Delete dictionary entry failed: ${response.statusText}`);
    }

    return response.json();
  },

  // === Prompt Management APIs ===

  /**
   * 保存されているプロンプトの一覧を取得
   */
  async listSavedPrompts(idToken: string | null = null, teamId: string | null = null) {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/prompts/list`, { headers });

    if (!response.ok) {
      throw new Error(`List prompts failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * プロンプトをYAMLファイルとして保存
   */
  async savePrompt(name: string, prompts: Record<string, string>, description?: string, idToken: string | null = null, teamId: string | null = null) {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/prompts/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        prompts,
        description: description || ''
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Save prompt failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * プロンプトをYAMLファイルから読み込み
   */
  async loadPrompt(name: string, idToken: string | null = null, teamId: string | null = null) {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/prompts/load/${encodeURIComponent(name)}`, { headers });

    if (!response.ok) {
      throw new Error(`Load prompt failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * プロンプトを削除
   */
  async deletePrompt(name: string, idToken: string | null = null, teamId: string | null = null) {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/prompts/delete/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Delete prompt failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * プロンプトを更新
   */
  async updatePrompt(name: string, prompts?: Record<string, string>, description?: string, idToken: string | null = null, teamId: string | null = null) {
    const headers = getAuthHeaders(idToken, teamId);
    const response = await fetch(`${API_BASE_URL}/prompts/update`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name,
        prompts,
        description
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Update prompt failed: ${response.statusText}`);
    }

    return response.json();
  },

  // === ChromaDB Management APIs ===

  /**
   * ChromaDBの現在のembeddingモデル情報を取得
   */
  async getChromaInfo() {
    const response = await fetch(`${API_BASE_URL}/chroma/info`);

    if (!response.ok) {
      throw new Error(`Get ChromaDB info failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * ChromaDBを完全にリセット
   */
  async resetChromaDB() {
    const response = await fetch(`${API_BASE_URL}/chroma/reset`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Reset ChromaDB failed: ${response.statusText}`);
    }

    return response.json();
  },
};
