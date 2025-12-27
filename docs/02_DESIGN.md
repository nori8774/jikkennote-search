# 設計仕様書 - 実験ノート検索システム v2.0

## 1. システムアーキテクチャ

### 1.1 全体構成図

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 App Router)                           │
│  Deployment: Vercel                                         │
│  ┌───────────┬───────────┬───────────┬──────────────────┐  │
│  │ Search    │ History   │ Viewer    │ Settings         │  │
│  │ Page      │ Page      │ Page      │ Page             │  │
│  ├───────────┼───────────┼───────────┼──────────────────┤  │
│  │ Evaluate  │ Ingest    │ Dictionary│ Prompt Mgmt      │  │
│  │ Page      │ Page      │ Page      │ Component        │  │
│  └───────────┴───────────┴───────────┴──────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Shared Components                                    │   │
│  │ - Button, Input, Modal, Toast, ProgressBar          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ State Management (localStorage)                      │   │
│  │ - API Keys, Search History, User Preferences         │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ REST API (HTTPS)
                         │
┌────────────────────────┴─────────────────────────────────────┐
│  Backend API (FastAPI + Python 3.12)                         │
│  Deployment: Google Cloud Run                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ API Endpoints                                        │   │
│  │ /search, /ingest, /notes/{id}, /evaluate            │   │
│  │ /prompts/*, /dictionary/*, /chroma/*                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Core Modules                                         │   │
│  │ - agent.py (LangGraph workflow)                     │   │
│  │ - ingest.py (Note processing)                       │   │
│  │ - utils.py (Normalization)                          │   │
│  │ - chroma_sync.py (ChromaDB management)              │   │
│  │ - storage.py (File/GCS abstraction)                 │   │
│  │ - prompt_manager.py (YAML prompt storage)           │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────┬──────────────┬──────────────┬───────────────────┘
            │              │              │
            │              │              │
┌───────────┴────────┐ ┌──┴──────────┐ ┌─┴──────────────────┐
│ External Services  │ │ ChromaDB    │ │ Google Cloud       │
│                    │ │ (Vector DB) │ │ Storage (GCS)      │
│ - OpenAI API       │ │             │ │                    │
│ - Cohere API       │ │ Persistent  │ │ Buckets:           │
│                    │ │ Storage in  │ │ - chroma-db/       │
│                    │ │ GCS         │ │ - notes/           │
│                    │ │             │ │ - prompts/         │
│                    │ │             │ │ - master_dict.yaml │
└────────────────────┘ └─────────────┘ └────────────────────┘
```

### 1.2 データフロー

#### 1.2.1 検索フロー

```
User Input (目的・材料・方法・重点指示)
  │
  ├─→ Frontend (Search Page)
  │     └─→ API Request with custom_prompts, embedding_model, llm_model
  │
  ├─→ Backend API (/search)
  │     │
  │     ├─→ LangGraph Agent (agent.py)
  │     │     │
  │     │     ├─→ Normalize Node (utils.py)
  │     │     │     └─→ Load master_dictionary.yaml
  │     │     │     └─→ Normalize material names
  │     │     │
  │     │     ├─→ Query Generation Node (prompts)
  │     │     │     └─→ Generate 3 perspective queries
  │     │     │         (Veteran, Newcomer, Manager)
  │     │     │
  │     │     ├─→ Search Node
  │     │     │     ├─→ ChromaDB Vector Search (top 100)
  │     │     │     └─→ Cohere Reranking (top 10)
  │     │     │
  │     │     └─→ Compare Node (if not evaluation_mode)
  │     │           └─→ Generate comparison report (top 3)
  │     │
  │     └─→ Return SearchResponse
  │
  └─→ Frontend Display Results
        └─→ Save to Search History (localStorage)
```

#### 1.2.2 ノート取り込みフロー

```
User Action: Upload Notes to Folder
  │
  ├─→ Frontend (Ingest Page)
  │     └─→ POST /ingest with source_folder, post_action
  │
  ├─→ Backend (ingest.py)
  │     │
  │     ├─→ Scan source_folder for *.md files
  │     │
  │     ├─→ Check existing IDs in ChromaDB
  │     │     └─→ Skip already ingested notes (増分更新)
  │     │
  │     ├─→ Parse new notes
  │     │     ├─→ Extract sections (目的・材料・方法・結果)
  │     │     └─→ Normalize materials with master_dict
  │     │
  │     ├─→ POST /ingest/analyze (if new terms detected)
  │     │     ├─→ Extract unknown terms
  │     │     ├─→ LLM similarity check
  │     │     └─→ Return suggestions to user
  │     │
  │     ├─→ User confirms dictionary updates
  │     │     └─→ POST /dictionary/update
  │     │
  │     ├─→ Vectorize with OpenAI Embeddings
  │     │     └─→ Add to ChromaDB
  │     │
  │     ├─→ Sync ChromaDB to GCS
  │     │
  │     └─→ Execute post_action
  │           ├─→ delete: Remove from source_folder
  │           ├─→ archive: Move to archive_folder
  │           └─→ keep: Leave in source_folder
  │
  └─→ Frontend: Display ingest results + new terms UI
```

#### 1.2.3 評価フロー

```
User Action: Upload Evaluation Excel/CSV
  │
  ├─→ Frontend (Evaluate Page)
  │     └─→ POST /evaluate/import (multipart/form-data)
  │
  ├─→ Backend: Parse Excel/CSV
  │     └─→ Return test_cases[]
  │
  ├─→ User: Select test cases and execute
  │     └─→ POST /evaluate for each test case
  │
  ├─→ Backend: Run search with test query
  │     ├─→ Get top 10 results
  │     └─→ Calculate metrics:
  │           - nDCG@10
  │           - Precision@K (K=3,5,10)
  │           - Recall@10
  │           - MRR
  │
  └─→ Frontend: Display results
        ├─→ Metrics chart (radar/bar)
        ├─→ Ranking comparison table
        └─→ Save to evaluation history
```

---

## 2. コンポーネント設計

### 2.1 フロントエンド構成

#### 2.1.1 ページコンポーネント

| ページ | パス | 責務 |
|--------|------|------|
| Search Page | `/` | 検索UI、結果表示、コピー機能 |
| History Page | `/history` | 検索履歴テーブル、再検索 |
| Viewer Page | `/viewer` | ノートID入力→全文表示 |
| Ingest Page | `/ingest` | ノート取り込み、新出単語管理 |
| Dictionary Page | `/dictionary` | 正規化辞書CRUD |
| Evaluate Page | `/evaluate` | RAG性能評価 |
| Settings Page | `/settings` | APIキー、モデル、プロンプト、ChromaDB管理 |

#### 2.1.2 共通コンポーネント

**Button.tsx**
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'success';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}
```

**Input.tsx**
```typescript
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
  disabled?: boolean;
}
```

**Modal.tsx**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
```

**Toast.tsx**
```typescript
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}
```

**ProgressBar.tsx**
```typescript
interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}
```

### 2.2 バックエンド構成

#### 2.2.1 モジュール構成

**server.py** (FastAPI Application)
- API endpoint definitions
- Request/Response validation (Pydantic models)
- Error handling and CORS configuration

**agent.py** (LangGraph Workflow)
- State definition (AgentState)
- Nodes: normalize_node, query_generation_node, search_node, compare_node
- Workflow graph construction
- Streaming support

**ingest.py** (Note Processing)
- parse_markdown_note(): Extract sections from markdown
- get_existing_ids(): Check ChromaDB for duplicates
- ingest_notes(): Main ingestion logic with incremental updates

**utils.py** (Utilities)
- load_master_dict(): Load normalization dictionary from YAML
- normalize_text(): Apply normalization rules
- extract_note_sections(): Parse markdown sections

**chroma_sync.py** (ChromaDB Management)
- get_chroma_vectorstore(): Initialize ChromaDB with embedding tracking
- sync_chroma_to_gcs(): Upload ChromaDB to Google Cloud Storage
- get_current_embedding_model(): Retrieve current embedding config
- save_embedding_model_config(): Track embedding model changes
- reset_chroma_db(): Complete database reset

**storage.py** (Storage Abstraction)
- Unified interface for local filesystem and GCS
- Methods: read_file(), write_file(), list_files(), delete_file(), move_file()
- Environment-based switching (local vs GCS)

**prompt_manager.py** (Prompt Management)
- save_prompt_to_yaml(): Save prompts to YAML files
- load_prompt_from_yaml(): Load prompts from YAML
- list_saved_prompts(): Get all saved prompts
- delete_prompt_file(): Remove YAML file
- update_prompt_yaml(): Update existing prompt

**config.py** (Configuration)
- Environment variables
- Default model configurations
- Folder paths
- API base URLs

---

## 3. データモデル

### 3.1 フロントエンド型定義

#### SearchRequest
```typescript
interface SearchRequest {
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
  evaluation_mode?: boolean;
}
```

#### SearchResponse
```typescript
interface SearchResponse {
  success: boolean;
  message: string;
  retrieved_docs: string[];
  normalized_materials?: string;
  search_query?: string;
}
```

#### NoteResponse
```typescript
interface NoteResponse {
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
```

#### EvaluationResult
```typescript
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
```

#### SearchHistory (localStorage)
```typescript
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
  embeddingModel: string;
  llmModel: string;
}
```

### 3.2 バックエンドデータモデル

#### AgentState (LangGraph)
```python
class AgentState(TypedDict):
    input_purpose: str
    input_materials: str
    input_methods: str
    input_type: Optional[str]
    instruction: Optional[str]
    normalized_materials: str
    search_query: str
    retrieved_docs: List[str]
    final_output: str
```

#### DictionaryEntry (master_dictionary.yaml)
```yaml
エタノール:
  - EtOH
  - エチルアルコール
  - ethanol
  - C2H5OH
```

#### PromptYAML (prompts/*.yaml)
```yaml
name: "プロンプト名"
description: "プロンプトの説明"
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:00:00Z"
prompts:
  normalize: |
    正規化プロンプト内容
  query_generation_veteran: |
    ベテラン視点クエリ生成プロンプト
  query_generation_newcomer: |
    新人視点クエリ生成プロンプト
  query_generation_manager: |
    マネージャー視点クエリ生成プロンプト
  compare: |
    比較分析プロンプト
```

#### ChromaDB Config (chroma_db_config.json)
```json
{
  "embedding_model": "text-embedding-3-small",
  "created_at": "2025-01-01T00:00:00Z",
  "last_updated": "2025-01-01T00:00:00Z"
}
```

---

## 4. 技術スタック詳細

### 4.1 フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 15.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| React Markdown | 9.x | Markdown rendering |
| Playwright | 1.x | E2E testing |

### 4.2 バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Python | 3.12+ | Core language |
| FastAPI | 0.115+ | Web framework |
| LangChain | 0.3.13+ | LLM orchestration |
| LangGraph | 0.2.62+ | Workflow management |
| ChromaDB | 0.6.3+ | Vector database |
| OpenAI SDK | 1.59+ | Embeddings & LLM |
| Cohere SDK | 5.14+ | Reranking |
| PyYAML | 6.0+ | YAML parsing |
| Pydantic | 2.x | Data validation |

### 4.3 インフラ

| サービス | 用途 |
|---------|------|
| Vercel | フロントエンドホスティング |
| Google Cloud Run | バックエンドAPI (コンテナ) |
| Google Cloud Storage (GCS) | ファイルストレージ、ChromaDB永続化 |
| Docker | コンテナ化 |

---

## 5. セキュリティ設計

### 5.1 APIキー管理

**フロントエンド**
- localStorage に保存（暗号化なし）
- ユーザーが手動で入力
- ページロード時に読み込み
- リクエスト時にヘッダーまたはボディで送信

**バックエンド**
- APIキーはサーバーに保存しない
- リクエストごとに受け取り、一時的にメモリで使用
- ログに出力しない
- レスポンスに含めない

### 5.2 通信セキュリティ

- HTTPS通信のみ（Vercel/GCP標準）
- CORS設定: フロントエンドドメインのみ許可
- Rate limiting（FastAPI middleware）

### 5.3 入力検証

- Pydanticによるリクエストバリデーション
- ファイルパスのサニタイズ（パストラバーサル対策）
- 最大ファイルサイズ制限
- 許可された拡張子のみ処理（.md, .yaml, .csv, .xlsx）

### 5.4 データ保護

- ユーザーデータは各自のAPIキーで処理
- GCSバケットはプロジェクト内で権限制御
- ChromaDBデータは永続化ストレージに保存

---

## 6. デプロイアーキテクチャ

### 6.1 フロントエンド (Vercel)

```
GitHub Repository
  │
  ├─→ Vercel Auto Deploy (main branch)
  │     │
  │     ├─→ Build: next build
  │     └─→ Deploy to Edge Network
  │
  └─→ Environment Variables:
        - NEXT_PUBLIC_API_URL=https://backend-url.run.app
```

### 6.2 バックエンド (Google Cloud Run)

```
Docker Build
  │
  ├─→ Dockerfile
  │     ├─→ FROM python:3.12-slim
  │     ├─→ COPY requirements.txt
  │     ├─→ RUN pip install -r requirements.txt
  │     ├─→ COPY backend/ /app/
  │     └─→ CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
  │
  ├─→ Push to Google Container Registry (GCR)
  │
  └─→ Deploy to Cloud Run
        ├─→ Service Name: jikkennote-backend
        ├─→ Region: asia-northeast1
        ├─→ Memory: 2GB
        ├─→ CPU: 2
        ├─→ Concurrency: 10
        ├─→ Min Instances: 0
        ├─→ Max Instances: 5
        └─→ Environment Variables:
              - GCS_BUCKET_NAME=jikkennote-storage
              - STORAGE_TYPE=gcs
```

### 6.3 ストレージ (Google Cloud Storage)

```
GCS Bucket: jikkennote-storage
  │
  ├─→ chroma-db/
  │     └─→ (ChromaDB persistent files)
  │
  ├─→ notes/
  │     ├─→ new/
  │     └─→ archived/
  │
  ├─→ prompts/
  │     └─→ *.yaml (saved prompts)
  │
  └─→ master_dictionary.yaml
```

---

## 7. パフォーマンス設計

### 7.1 フロントエンド最適化

- Next.js App Router: Server Components でサーバーサイドレンダリング
- Code splitting: 各ページで必要なコードのみロード
- Image optimization: Next.js Image component
- Caching: SWR for API responses

### 7.2 バックエンド最適化

**ChromaDB**
- インデックス最適化（デフォルト設定）
- バッチ処理（50件ずつ）
- 既存ID確認で増分更新

**LLM API**
- 非同期処理（複数クエリ生成を並列実行）
- ストリーミングレスポンス（agent.py）
- モデル選択による速度調整

**Cohere Reranking**
- Top 100→Top 10に絞り込み
- 関連度スコアでソート

### 7.3 目標性能指標

| 指標 | 目標値 |
|------|-------|
| 検索レスポンス | < 5秒 |
| ノート取り込み | < 10秒/件 |
| 新出単語抽出 | < 10秒/ノート |
| ページロード | < 2秒 |
| API応答時間 | < 3秒 |

---

## 8. エラーハンドリング設計

### 8.1 フロントエンド

**APIエラー**
```typescript
try {
  const result = await api.search(request);
} catch (error) {
  if (error.message.includes('401')) {
    alert('APIキーが無効です。設定ページで確認してください。');
  } else {
    alert(`エラー: ${error.message}`);
  }
}
```

**バリデーション**
```typescript
if (!purpose.trim() || !materials.trim() || !methods.trim()) {
  alert('目的・材料・方法は必須です。');
  return;
}
```

### 8.2 バックエンド

**HTTPException**
```python
from fastapi import HTTPException

if not openai_api_key:
    raise HTTPException(status_code=400, detail="OpenAI APIキーが必要です")
```

**Try-Catch with Logging**
```python
try:
    result = agent_graph.invoke(state)
except Exception as e:
    print(f"Agent error: {e}")
    raise HTTPException(status_code=500, detail=f"検索エラー: {str(e)}")
```

**ChromaDB Error Handling**
```python
try:
    vectorstore.add_documents(documents=batch)
except Exception as e:
    print(f"バッチ {batch_num} エラー: {str(e)}")
    continue  # Skip failed batch
```

---

## 9. 拡張性設計

### 9.1 将来的な機能追加のための設計

**マルチテナント対応**
- ユーザーID/ワークスペースID の導入
- GCSでフォルダ分離: `gs://bucket/{user_id}/notes/`
- ChromaDB コレクション分離

**通知機能**
- WebSocket 導入で進捗リアルタイム表示
- メール通知（取り込み完了、評価結果）

**高度な検索機能**
- ファセット検索（カテゴリ、日付範囲）
- フィルタリング（材料、手法）
- 保存された検索条件

**協働機能**
- ノートへのコメント・アノテーション
- チーム内共有・権限管理
- 変更履歴追跡

### 9.2 モジュール追加ガイドライン

**新しいエンドポイント追加**
1. `server.py` に Pydantic モデル定義
2. エンドポイント実装 (`@app.post("/new-endpoint")`)
3. `frontend/lib/api.ts` にクライアント関数追加
4. フロントエンドページで呼び出し

**新しいノード追加（LangGraph）**
1. `agent.py` に新ノード関数定義
2. `AgentState` に必要なフィールド追加
3. ワークフローに `.add_node()` でノード追加
4. `.add_edge()` でフロー接続

**新しいページ追加**
1. `frontend/app/{page-name}/page.tsx` 作成
2. ナビゲーションに追加
3. API 呼び出しロジック実装
4. UI コンポーネント組み立て

---

## 10. テスト設計

### 10.1 フロントエンドテスト

**E2E Tests (Playwright)**
- `tests/e2e/prompt-management.spec.ts`
- `tests/e2e/evaluation.spec.ts`
- `tests/e2e/search.spec.ts` (未実装)
- `tests/e2e/ingest.spec.ts` (未実装)

**Unit Tests**
- React Testing Library
- Jest
- 各コンポーネントの動作検証

### 10.2 バックエンドテスト

**API Tests (pytest)**
```python
def test_search_endpoint():
    response = client.post("/search", json={
        "purpose": "テスト",
        "materials": "試薬A",
        "methods": "方法1",
        "openai_api_key": "sk-test",
        "cohere_api_key": "test"
    })
    assert response.status_code == 200
```

**Integration Tests**
- ChromaDB との連携テスト
- GCS との連携テスト
- LangGraph ワークフローテスト

### 10.3 テストカバレッジ目標

| コンポーネント | 目標カバレッジ |
|--------------|--------------|
| API Endpoints | 80%+ |
| Core Modules | 70%+ |
| UI Components | 60%+ |

---

## 11. 運用設計

### 11.1 ログ設計

**フロントエンド**
- Console.log (開発環境のみ)
- エラー追跡: Sentry (本番環境)

**バックエンド**
- Python logging module
- ログレベル: DEBUG, INFO, WARNING, ERROR
- 出力先: stdout (Cloud Run Logs)

**重要ログ**
- API リクエスト/レスポンス
- ChromaDB 操作
- エラー詳細（スタックトレース含む）

### 11.2 モニタリング

**Vercel**
- アクセス数、レスポンスタイム
- ビルド成功/失敗

**Google Cloud Run**
- CPU/メモリ使用率
- リクエスト数、レスポンスタイム
- エラーレート

**ChromaDB**
- ドキュメント数
- 検索クエリ応答時間

### 11.3 バックアップ戦略

**ChromaDB**
- GCS 自動同期（毎回 ingest 後）
- 手動バックアップ機能（設定画面）

**正規化辞書**
- GCS に保存（自動同期）
- バージョン管理（更新日時記録）

**プロンプト**
- YAML ファイル（GCS）
- エクスポート機能

---

## 12. 設計原則

### 12.1 コーディング規約

**TypeScript**
- 厳密な型定義（`strict: true`）
- 関数型プログラミング推奨
- Async/Await 使用

**Python**
- PEP 8 準拠
- Type hints 必須
- Docstring 記述

### 12.2 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| ファイル | kebab-case | `prompt-management.tsx` |
| コンポーネント | PascalCase | `SearchPage` |
| 関数 | camelCase | `handleSave` |
| 定数 | UPPER_SNAKE_CASE | `API_BASE_URL` |
| 型 | PascalCase | `SearchRequest` |

### 12.3 ディレクトリ構成

```
jikkennote-search/
├─ frontend/
│  ├─ app/
│  │  ├─ page.tsx (Search)
│  │  ├─ history/
│  │  ├─ viewer/
│  │  ├─ ingest/
│  │  ├─ dictionary/
│  │  ├─ evaluate/
│  │  └─ settings/
│  ├─ components/
│  │  ├─ Button.tsx
│  │  ├─ Input.tsx
│  │  └─ ...
│  ├─ lib/
│  │  └─ api.ts
│  └─ tests/
│     └─ e2e/
│
├─ backend/
│  ├─ server.py
│  ├─ agent.py
│  ├─ ingest.py
│  ├─ utils.py
│  ├─ chroma_sync.py
│  ├─ storage.py
│  ├─ prompt_manager.py
│  ├─ config.py
│  ├─ prompts/
│  │  └─ *.yaml
│  └─ chroma_db_config.json
│
├─ docs/
│  ├─ 01_REQUIREMENTS.md
│  ├─ 02_DESIGN.md (this file)
│  ├─ 03_API.md
│  └─ 04_DEVELOPMENT.md
│
└─ README.md
```

---

**作成日**: 2025-12-25
**最終更新**: 2025-12-25
**バージョン**: 2.0.0
