/**
 * Local Storage Management
 * ブラウザのlocalStorageを使った設定管理
 */

const STORAGE_KEYS = {
  OPENAI_API_KEY: 'openai_api_key',
  COHERE_API_KEY: 'cohere_api_key',
  EMBEDDING_MODEL: 'embedding_model',
  LLM_MODEL: 'llm_model',
  CUSTOM_PROMPTS: 'custom_prompts',
  FOLDER_PATHS: 'folder_paths',
};

export const storage = {
  // APIキー
  setOpenAIApiKey(key: string) {
    localStorage.setItem(STORAGE_KEYS.OPENAI_API_KEY, key);
  },

  getOpenAIApiKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY);
  },

  setCohereApiKey(key: string) {
    localStorage.setItem(STORAGE_KEYS.COHERE_API_KEY, key);
  },

  getCohereApiKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.COHERE_API_KEY);
  },

  // モデル設定
  setEmbeddingModel(model: string) {
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_MODEL, model);
  },

  getEmbeddingModel(): string | null {
    return localStorage.getItem(STORAGE_KEYS.EMBEDDING_MODEL);
  },

  setLLMModel(model: string) {
    localStorage.setItem(STORAGE_KEYS.LLM_MODEL, model);
  },

  getLLMModel(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LLM_MODEL);
  },

  // カスタムプロンプト
  setCustomPrompts(prompts: Record<string, string>) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPTS, JSON.stringify(prompts));
  },

  getCustomPrompts(): Record<string, string> | null {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPTS);
    return data ? JSON.parse(data) : null;
  },

  // フォルダパス
  setFolderPaths(paths: Record<string, string>) {
    localStorage.setItem(STORAGE_KEYS.FOLDER_PATHS, JSON.stringify(paths));
  },

  getFolderPaths(): Record<string, string> | null {
    const data = localStorage.getItem(STORAGE_KEYS.FOLDER_PATHS);
    return data ? JSON.parse(data) : null;
  },

  // 全削除
  clearAll() {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },
};
