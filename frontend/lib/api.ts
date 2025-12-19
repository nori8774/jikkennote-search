/**
 * API Client
 * バックエンドAPIとの通信を行う
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  post_action?: 'delete' | 'archive' | 'keep';
  archive_folder?: string;
  embedding_model?: string;
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
  async search(request: SearchRequest): Promise<SearchResponse> {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
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

  async ingest(request: IngestRequest): Promise<IngestResponse> {
    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  async analyzeNewTerms(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const response = await fetch(`${API_BASE_URL}/ingest/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Analyze failed: ${response.statusText}`);
    }

    return response.json();
  },

  async getDictionary(): Promise<DictionaryResponse> {
    const response = await fetch(`${API_BASE_URL}/dictionary`);

    if (!response.ok) {
      throw new Error(`Get dictionary failed: ${response.statusText}`);
    }

    return response.json();
  },

  async updateDictionary(request: DictionaryUpdateRequest): Promise<DictionaryUpdateResponse> {
    const response = await fetch(`${API_BASE_URL}/dictionary/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Update dictionary failed: ${response.statusText}`);
    }

    return response.json();
  },

  async exportDictionary(format: 'yaml' | 'json' | 'csv' = 'yaml'): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/dictionary/export?format=${format}`);

    if (!response.ok) {
      throw new Error(`Export dictionary failed: ${response.statusText}`);
    }

    return response.blob();
  },

  async importDictionary(file: File): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/dictionary/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Import dictionary failed: ${response.statusText}`);
    }

    return response.json();
  },
};
