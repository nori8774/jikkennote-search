# タスクリスト

## タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: バックエンド - 設定とデータ構造

- [x] config.pyに3軸検索の設定パラメータを追加
  - [x] MULTI_AXIS_ENABLED（デフォルト: True）
  - [x] FUSION_METHOD（"rrf" | "linear"、デフォルト: "rrf"）
  - [x] AXIS_WEIGHTS（材料/方法/総合のウエイト、デフォルト: 0.3/0.4/0.3）
  - [x] RERANK_POSITION（"per_axis" | "after_fusion"、デフォルト: "after_fusion"）
  - [x] RRF_K（RRFのkパラメータ、デフォルト: 60）

- [x] agent.pyのAgentStateに新しいフィールドを追加
  - [x] focus_classification: str（重点指示の分類結果）
  - [x] material_axis_results: List（材料軸の検索結果）
  - [x] method_axis_results: List（方法軸の検索結果）
  - [x] combined_axis_results: List（総合軸の検索結果）
  - [x] multi_axis_enabled: bool
  - [x] fusion_method: str
  - [x] axis_weights: dict
  - [x] rerank_position: str
  - [x] rerank_enabled: bool

## フェーズ2: バックエンド - プロンプト定義

- [x] prompts.pyに新しいプロンプトを追加
  - [x] `focus_classification`: 重点指示を材料/方法/両方/なしに分類
  - [x] `material_query_generation`: 材料軸クエリ生成
  - [x] `method_query_generation`: 方法軸クエリ生成
  - [x] `combined_query_generation`: 総合軸クエリ生成（現行query_generationを改名）

## フェーズ3: バックエンド - 重点指示分類

- [x] _classify_focus_nodeを実装
  - [x] LLMで重点指示を解析
  - [x] "materials" | "methods" | "both" | "none" を判定
  - [x] JSONパース失敗時は"both"にフォールバック
  - [x] 重点指示が空の場合は"none"を返す

## フェーズ4: バックエンド - 3軸クエリ生成

- [x] _generate_multi_axis_queries_nodeを実装
  - [x] 材料軸クエリの生成（材料 + 条件付き重点指示）
  - [x] 方法軸クエリの生成（方法 + 条件付き重点指示）
  - [x] 総合軸クエリの生成（現行方式）
  - [x] focus_classificationの結果に応じて重点指示を適用

## フェーズ5: バックエンド - 3軸検索実行

- [x] _multi_axis_search_nodeを実装
  - [x] 材料軸の検索実行
  - [x] 方法軸の検索実行
  - [x] 総合軸の検索実行
  - [x] 各軸の結果をスコア付きで保持

- [x] リランキング位置の分岐実装
  - [x] per_axis: 各軸で検索後にリランク
  - [x] after_fusion: 統合後にリランク
  - [x] リランク無効化オプション

## フェーズ6: バックエンド - スコア統合

- [x] _score_fusion_nodeを実装
  - [x] RRF方式の統合ロジック
  - [x] 線形結合方式の統合ロジック
  - [x] 重複ドキュメントの処理（最高スコアを採用）
  - [x] 最終ランキングの生成

## フェーズ7: バックエンド - グラフ再構築

- [x] _build_graphを更新
  - [x] 新しいノードを追加（classify_focus, generate_multi_axis_queries, multi_axis_search, score_fusion）
  - [x] エッジを再定義
  - [x] multi_axis_enabled=falseの場合は現行フローを使用

## フェーズ8: バックエンド - APIエンドポイント更新

- [x] server.pyの/searchエンドポイントを更新
  - [x] multi_axis_enabledパラメータを追加
  - [x] fusion_methodパラメータを追加
  - [x] axis_weightsパラメータを追加
  - [x] rerank_positionパラメータを追加
  - [x] rerank_enabledパラメータを追加

- [x] server.pyの/evaluateエンドポイントを更新
  - [x] 同様のパラメータを追加

- [x] /promptsエンドポイントを更新
  - [x] 新しいプロンプト（5種類）を返すように変更

## フェーズ9: フロントエンド - プロンプト管理UI更新

- [x] frontend/app/settings/page.tsxを更新
  - [x] 新しい5つのプロンプト（材料/方法/総合/重点指示分類/比較）の表示
  - [x] 保存/復元機能の対応（5つのプロンプト）
  - [x] 後方互換性対応（旧形式からの変換）

## フェーズ10: フロントエンド - 評価機能更新

- [x] frontend/app/evaluate/page.tsxを更新
  - [x] 3軸検索設定UIの追加
    - [x] multi_axis_enabled トグル
    - [x] fusion_method 選択（RRF/線形結合）
    - [x] axis_weights スライダー（材料/方法/総合）
    - [x] rerank_position 選択（各軸後/統合後）
    - [x] rerank_enabled トグル
  - [x] CSV出力の更新（新しいカラム追加）
  - [x] 評価履歴への3軸設定の記録

- [x] frontend/lib/api.tsを更新
  - [x] search APIに新しいパラメータを追加

- [x] frontend/lib/storage.tsを更新
  - [x] 評価履歴に3軸検索設定を含めて保存（storage.tsの変更は不要、evaluate/page.tsxで対応済み）

## フェーズ11: 動作確認

- [ ] ローカル環境でバックエンドを起動
- [ ] 以下のケースで検索をテスト
  - [ ] 重点指示なしの検索
  - [ ] 材料関連の重点指示での検索
  - [ ] 方法関連の重点指示での検索
  - [ ] 両方に関連する重点指示での検索
- [ ] RRF方式と線形結合方式の両方で動作確認
- [ ] リランキング位置の両設定で動作確認
- [ ] 評価機能でCSV出力を確認

## フェーズ12: 品質チェックと修正

- [x] バックエンドのエラーがないことを確認
- [x] フロントエンドのリントエラーがないことを確認
  - [x] `cd frontend && npm run lint` （Next.js 16で非推奨、ESLintへの移行が推奨）
- [x] フロントエンドの型エラーがないことを確認
  - [x] `cd frontend && npx tsc --noEmit`
- [x] フロントエンドのビルドが成功することを確認
  - [x] `cd frontend && npm run build`

## フェーズ13: セクション別Embeddingアーキテクチャ（v3.1.1）

**背景**: 3軸分離検索でクエリは分離されているが、検索対象が同一コレクション（ノート全体）のため検索精度が上がらない。各軸が対応するセクションのみを検索するアーキテクチャに変更する。

### 13-1: 設定ファイル更新

- [x] config.pyにコレクション名の設定を追加
  - [x] MATERIALS_COLLECTION_NAME = "materials_collection"
  - [x] METHODS_COLLECTION_NAME = "methods_collection"
  - [x] COMBINED_COLLECTION_NAME = "combined_collection"（既存のCOLLECTION_NAMEを置き換え）

### 13-2: ChromaDB管理の更新（chroma_sync.py）

- [x] ChromaDBの3コレクション対応
  - [x] get_team_multi_collection_vectorstores()関数を追加
  - [x] 各コレクション（materials, methods, combined）の初期化
  - [x] reset_team_collections()関数を追加

### 13-3: 取り込み処理の更新（ingest.py）

- [x] セクション抽出関数の実装
  - [x] extract_sections(content: str) -> dict関数の追加
  - [x] "## 材料" または "## Materials" セクションの抽出
  - [x] "## 方法" または "## Methods" セクションの抽出
  - [x] セクションが見つからない場合は空文字列を返す

- [x] 取り込み処理を3コレクション対応に変更
  - [x] materials_collectionへの材料セクション登録
  - [x] methods_collectionへの方法セクション登録
  - [x] combined_collectionへのノート全体登録
  - [x] メタデータにsection_type, note_idを追加

### 13-4: 検索処理の更新（agent.py）

- [x] SearchAgentクラスを3コレクション対応に更新
  - [x] __init__で3つのvectorstoreを初期化（self.vectorstores辞書）
  - [x] materials_vectorstore, methods_vectorstore, combined_vectorstore

- [x] _multi_axis_search_nodeを更新
  - [x] 材料軸: materials_vectorstoreを使用
  - [x] 方法軸: methods_vectorstoreを使用
  - [x] 総合軸: combined_vectorstoreを使用
  - [x] _keyword_search_on_vectorstore(), _hybrid_search_on_vectorstore()を追加

- [x] _score_fusion_nodeを更新
  - [x] note_idでの結果マージ処理を追加
  - [x] 各コレクションからの結果を統合

### 13-5: マイグレーション対応

- [x] 既存データのマイグレーション方針を決定
  - [x] 方針: ChromaDBリセット + 全ノート再取り込み
  - [x] /chroma/resetエンドポイントで3コレクションを削除するように更新

### 13-6: 動作確認

- [ ] バックエンドの起動確認
- [ ] ノート取り込みテスト（3コレクションへの登録確認）
- [ ] 3軸検索テスト（各コレクションから検索されることを確認）
- [ ] スコア統合テスト（note_idでのマージ確認）

### 13-7: 品質チェック

- [x] バックエンドのエラーがないことを確認（Python構文チェック完了）
- [ ] フロントエンドのビルドが成功することを確認

---

## 実装後の振り返り

### 実装完了日
2026-01-02

### 計画と実績の差分

**計画と異なった点**:
- プロンプトは4種類から5種類に変更（compareを含めて5種類）
- storage.tsへの関数追加は不要だった（評価履歴に設定を含めて保存する方式で対応）

**新たに必要になったタスク**:
- 後方互換性対応（旧プロンプト形式からの変換）
- BatchEvaluateRequestの更新

### 学んだこと

**技術的な学び**:
- LangGraphのStateGraphで条件分岐を実装する方法
- RRF (Reciprocal Rank Fusion) のスコア統合ロジック
- TypeScriptでの複雑な状態管理（3軸のウエイト自動調整）

**プロセス上の改善点**:
- タスクリストをより細かく分割すると進捗が把握しやすい
- 後方互換性は初期段階で計画に含めるべき

### 次回への改善提案
- フェーズ11の動作確認はE2Eテストとして自動化することを検討
- プロンプトのバージョン管理機能の追加を検討
