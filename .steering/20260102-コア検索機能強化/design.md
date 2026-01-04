# 設計書: コア検索機能強化

## 1. システム概要

### 1.1 変更対象ファイル

**バックエンド**:
- `backend/agent.py`: LangGraphワークフローでLLM使い分け、ハイブリッド検索実装
- `backend/server.py`: SearchRequestモデルにパラメータ追加

**フロントエンド**:
- `frontend/app/settings/page.tsx`: モデル2段階選択UI、hybrid_alphaスライダー
- `frontend/app/search/page.tsx`: 検索モード選択ドロップダウン
- `frontend/lib/storage.ts`: 新しい設定項目の保存/読み込み
- `frontend/lib/api.ts`: 検索APIパラメータの追加

## 2. FR-112: モデル2段階選択の設計

### 2.1 バックエンド設計

#### 2.1.1 SearchAgentクラスの変更

```python
class SearchAgent:
    def __init__(
        self,
        openai_api_key: str,
        cohere_api_key: str,
        embedding_model: str = None,
        search_llm_model: str = None,   # 新規: 検索・判定用
        summary_llm_model: str = None,  # 新規: 要約生成用
        llm_model: str = None,          # 後方互換性のため維持
        prompts: dict = None,
        team_id: str = None
    ):
        # 検索・判定用LLM
        self.search_llm_model = search_llm_model or llm_model or config.DEFAULT_SEARCH_LLM_MODEL
        self.summary_llm_model = summary_llm_model or llm_model or config.DEFAULT_SUMMARY_LLM_MODEL

        # 2つのLLMインスタンスを作成
        self.search_llm = ChatOpenAI(
            model=self.search_llm_model,
            temperature=0,
            api_key=openai_api_key
        )
        self.summary_llm = ChatOpenAI(
            model=self.summary_llm_model,
            temperature=0,
            api_key=openai_api_key
        )
```

#### 2.1.2 ノードでのLLM使い分け

| ノード | 使用LLM | 理由 |
|--------|---------|------|
| normalize | search_llm | 軽量処理、速度重視 |
| generate_query | search_llm | 軽量処理、速度重視 |
| search | - | LLM不使用（ベクトル検索） |
| compare | summary_llm | 要約生成、品質重視 |

### 2.2 フロントエンド設計

#### 2.2.1 設定ページUI

```
モデル選択タブ:
┌─────────────────────────────────────────────────┐
│ Embeddingモデル                                  │
│ [text-embedding-3-small ▼]                      │
│                                                  │
│ 検索・判定用LLM                                  │
│ [gpt-4o-mini ▼]                                 │
│ ※ クエリ生成、正規化に使用されます               │
│                                                  │
│ 要約生成用LLM                                    │
│ [gpt-3.5-turbo ▼]                               │
│ ※ 検索結果の比較・要約に使用されます             │
└─────────────────────────────────────────────────┘
```

#### 2.2.2 storage.ts追加メソッド

```typescript
// 検索・判定用LLMモデル
getSearchLLMModel(): string | null
setSearchLLMModel(model: string): void

// 要約生成用LLMモデル
getSummaryLLMModel(): string | null
setSummaryLLMModel(model: string): void
```

## 3. FR-116: ハイブリッド検索の設計

### 3.1 アルゴリズム設計

ChromaDB 0.5.23ではRRFがサポートされていないため、手動でハイブリッド検索を実装する。

#### 3.1.1 手動スコア統合方式

```python
def hybrid_search(query_text: str, alpha: float = 0.7) -> List[Document]:
    """
    ハイブリッド検索（手動スコア統合）

    Args:
        query_text: 検索クエリ
        alpha: セマンティック検索の重み（0.0-1.0）
               1.0 = 完全セマンティック
               0.0 = 完全キーワード
               0.7 = 推奨値

    Returns:
        統合されたスコアでソートされたドキュメントリスト
    """
    # 1. セマンティック検索（Embedding）
    semantic_results = vectorstore.similarity_search_with_score(
        query_text, k=100
    )

    # 2. キーワード検索（全文検索）
    # ChromaDBのwhere_document条件を使用したテキストマッチング
    keyword_results = collection.query(
        query_texts=[query_text],
        n_results=100,
        include=["documents", "metadatas", "distances"]
    )

    # 3. スコア正規化
    semantic_scores = normalize_scores([s for _, s in semantic_results])
    keyword_scores = normalize_scores(keyword_results["distances"][0])

    # 4. 統合スコア計算
    combined_scores = {}
    for doc, score in zip(semantic_results, semantic_scores):
        doc_id = doc.metadata.get("source")
        combined_scores[doc_id] = alpha * score

    for doc_id, score in zip(keyword_doc_ids, keyword_scores):
        if doc_id in combined_scores:
            combined_scores[doc_id] += (1 - alpha) * score
        else:
            combined_scores[doc_id] = (1 - alpha) * score

    # 5. ソートして返却
    return sorted_documents
```

#### 3.1.2 検索モード分岐

```python
def _search_node(self, state: AgentState):
    search_mode = state.get("search_mode", "semantic")
    hybrid_alpha = state.get("hybrid_alpha", 0.7)

    if search_mode == "semantic":
        # 従来のセマンティック検索
        results = self.vectorstore.similarity_search(query, k=100)

    elif search_mode == "keyword":
        # キーワード検索のみ
        results = self._keyword_search(query, k=100)

    elif search_mode == "hybrid":
        # ハイブリッド検索
        results = self._hybrid_search(query, alpha=hybrid_alpha, k=100)

    # Cohere Rerankingで上位10件に絞り込み
    reranked = self.cohere_client.rerank(...)
```

### 3.2 フロントエンド設計

#### 3.2.1 検索ページUI

```
検索条件:
┌─────────────────────────────────────────────────┐
│ 目的・背景                                       │
│ [テキストエリア]                                 │
│                                                  │
│ 材料                                             │
│ [テキストエリア]                                 │
│                                                  │
│ 方法・手順                                       │
│ [テキストエリア]                                 │
│                                                  │
│ 検索モード                                       │
│ [ハイブリッド検索（推奨）▼]                      │
│ ・セマンティック検索: 意味的類似性で検索          │
│ ・キーワード検索: 固有名詞に強い                  │
│ ・ハイブリッド検索: 両方を組み合わせ（推奨）      │
│                                                  │
│ [検索]                                           │
└─────────────────────────────────────────────────┘
```

#### 3.2.2 設定ページUI（検索設定セクション追加）

```
検索設定:
┌─────────────────────────────────────────────────┐
│ ハイブリッド検索の重み                           │
│ セマンティック ◀━━━━━━━●━━━━▶ キーワード         │
│               0.7                                │
│ ※ 0.7（デフォルト）= セマンティック70%、         │
│   キーワード30%の比率で検索します                 │
└─────────────────────────────────────────────────┘
```

## 4. API設計

### 4.1 SearchRequest更新

```python
class SearchRequest(BaseModel):
    purpose: str
    materials: str
    methods: str
    instruction: Optional[str] = None
    openai_api_key: str
    cohere_api_key: str
    embedding_model: Optional[str] = "text-embedding-3-small"

    # v3.0新規: モデル2段階選択
    search_llm_model: Optional[str] = "gpt-4o-mini"
    summary_llm_model: Optional[str] = "gpt-3.5-turbo"

    # v3.0.1新規: ハイブリッド検索
    search_mode: Optional[Literal["semantic", "keyword", "hybrid"]] = "semantic"
    hybrid_alpha: Optional[float] = 0.7

    # 後方互換性
    llm_model: Optional[str] = None  # 非推奨、search_llm_modelに移行

    custom_prompts: Optional[dict] = None
    evaluation_mode: Optional[bool] = False
```

## 5. データフロー

```
User Input
    │
    ▼
Frontend (search/page.tsx)
    │ search_mode, hybrid_alpha
    │ search_llm_model, summary_llm_model
    ▼
Backend API (POST /search)
    │
    ▼
SearchAgent.__init__()
    │ 2つのLLMインスタンス作成
    │ search_mode, hybrid_alpha設定
    ▼
normalize_node (search_llm)
    ▼
generate_query_node (search_llm)
    ▼
search_node (hybrid_search if mode=hybrid)
    │ セマンティック検索 + キーワード検索
    │ スコア統合
    │ Cohere Reranking
    ▼
compare_node (summary_llm) ※evaluation_mode=Falseの場合
    ▼
SearchResponse
```

## 6. テスト設計

### 6.1 単体テスト

- `test_agent_two_llm_models`: 2つのLLMが正しく初期化されることを確認
- `test_hybrid_search_scoring`: ハイブリッド検索のスコア統合が正しく動作することを確認
- `test_search_mode_routing`: 検索モードに応じて正しい検索メソッドが呼ばれることを確認

### 6.2 E2Eテスト

- `test_search_with_model_selection`: 設定ページでモデル選択→検索実行→結果確認
- `test_search_mode_switching`: 検索モード切り替え→検索実行→結果確認
- `test_hybrid_alpha_slider`: hybrid_alphaスライダー操作→検索実行→結果確認
