# 実験ノート検索システム v2.0

LangChainを活用した高精度な実験ノート検索システムの機能拡張版

## プロジェクト概要

既存の実験ノート検索システム（LangChain_v2）をベースに、以下の新機能を追加した拡張版です：

1. **プロンプト管理画面** - コード内プロンプトをUI上でカスタマイズ
2. **検索結果コピー機能** - 材料・方法をワンクリックで検索条件欄に反映
3. **検索履歴管理** - クエリごとに保存、テーブル表示
4. **ノートビューワー** - 実験ノートID入力で表示
5. **モデル選択UI** - OpenAI Embedding/LLMをUI上で選択
6. **RAG性能評価** - Excel/CSVインポート、nDCG等の評価指標
7. **新出単語抽出** - 表記揺れ判定、正規化辞書自動更新

## ディレクトリ構造

```
jikkennote-search/
├── frontend/          # Next.js フロントエンド
│   ├── app/          # App Router
│   ├── components/   # Reactコンポーネント（追加予定）
│   └── lib/          # ユーティリティ（追加予定）
├── backend/          # FastAPI バックエンド
│   ├── server.py     # メインAPIサーバー
│   ├── config.py     # 設定管理
│   ├── utils.py      # ユーティリティ関数
│   ├── requirements.txt
│   └── master_dictionary.yaml
├── CLAUDE.md         # 詳細仕様書
├── README.md         # このファイル
├── DEPLOYMENT.md     # デプロイ手順書
├── USER_MANUAL.md    # ユーザーマニュアル
└── PRODUCTION_TEST_CHECKLIST.md  # テストチェックリスト
```

## セットアップ

### 前提条件

- Python 3.12以上
- Node.js 18以上
- OpenAI APIキー
- Cohere APIキー

### バックエンドのセットアップ

```bash
cd backend

# 仮想環境作成
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 依存パッケージインストール
pip install -r requirements.txt

# 環境変数設定（オプション）
cp .env.example .env
# .envファイルを編集してフォルダパスを設定

# サーバー起動
python server.py
```

サーバーは http://localhost:8000 で起動します。

### フロントエンドのセットアップ

```bash
cd frontend

# 依存パッケージインストール
npm install

# 開発サーバー起動
npm run dev
```

UIは http://localhost:3000 で起動します。

## 本番環境へのデプロイ

本番環境へのデプロイ方法については、以下のドキュメントを参照してください：

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - デプロイ手順の詳細
- **[USER_MANUAL.md](USER_MANUAL.md)** - エンドユーザー向けマニュアル
- **[PRODUCTION_TEST_CHECKLIST.md](PRODUCTION_TEST_CHECKLIST.md)** - 本番環境テスト項目

### クイックスタート

1. **フロントエンド**: Vercelにデプロイ
   ```bash
   # Vercelにログイン
   vercel login

   # フロントエンドをデプロイ
   cd frontend
   vercel --prod
   ```

2. **バックエンド**: Railwayにデプロイ
   - GitHubリポジトリを接続
   - `backend` ディレクトリをルートに設定
   - 環境変数を設定（CORS_ORIGINS等）
   - デプロイ実行

詳細は [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

## 開発ステータス

### Phase 1: 基盤整備 ✅ 完了

- [x] プロジェクトセットアップ（Next.js + FastAPI）
- [x] 既存UIのカラースキーム・デザインシステムの整理
- [x] 既存コードの移行・リファクタリング
- [x] ローカルストレージ管理機能（フォルダパス設定）
- [x] API設計とエンドポイント実装
- [x] 基本的なUI構築

### Phase 2: コア機能実装 ✅ 完了

- [x] 機能1: プロンプト管理画面（初期設定リセット機能含む）
- [x] 機能2: 検索結果コピー機能
- [x] 機能4: ノートビューワー（セクション別コピーボタン）
- [x] 機能5: モデル選択UI
- [x] 増分DB更新（既存ノートスキップ機能）

### Phase 3: ノート管理・辞書機能実装 ✅ 完了

- [x] 機能7: 新出単語抽出と正規化辞書管理
- [x] 取り込み後のファイルアクション（削除/移動/保持）
- [x] 正規化辞書管理UI
- [x] LLMによる表記揺れ判定機能

### Phase 4: 履歴・評価機能実装 ✅ 完了

- [x] 機能3: 検索履歴管理（テーブル表示、ノートIDクリック表示）
- [x] 機能6: RAG性能評価機能
- [x] Excel/CSVインポート機能
- [x] nDCG等の評価指標実装
- [x] バッチ評価機能

### Phase 5: UI/UX改善・テスト ✅ 完了

- [x] 共通コンポーネント作成（Loading, Toast）
- [x] 既存UIデザインとの統一性確認
- [x] レスポンシブ対応
- [x] エラーハンドリング・バリデーション
- [x] 詳細な使用方法ドキュメント作成
- [x] トラブルシューティングガイド作成

### Phase 6: デプロイ・ドキュメント ✅ 完了

- [x] Vercelデプロイ設定（vercel.json）
- [x] バックエンドデプロイ設定（Dockerfile, Railway設定）
- [x] CORS設定の環境変数対応
- [x] デプロイ手順書（DEPLOYMENT.md）
- [x] ユーザーマニュアル（USER_MANUAL.md）
- [x] 本番環境テストチェックリスト

## 技術スタック

### フロントエンド
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS

### バックエンド
- Python 3.12+
- FastAPI
- LangChain + LangGraph
- ChromaDB
- Cohere Rerank

## APIエンドポイント

### Phase 1 (基盤)
- `GET /` - ルート、APIバージョン情報
- `GET /health` - ヘルスチェック、設定確認
- `GET /config/folders` - フォルダパス取得
- `POST /config/folders` - フォルダパス更新

### Phase 2 (コア機能)
- `POST /search` - 実験ノート検索
- `GET /prompts` - デフォルトプロンプト取得
- `POST /ingest` - ノート取り込み（増分更新）

### Phase 3 (ノート管理・辞書機能)
- `GET /notes/{id}` - 実験ノート取得
- `POST /ingest/analyze` - 新出単語分析
- `GET /dictionary` - 正規化辞書取得
- `POST /dictionary/update` - 辞書更新
- `GET /dictionary/export` - 辞書エクスポート
- `POST /dictionary/import` - 辞書インポート

### Phase 4 (履歴・評価機能)
- `POST /history` - 検索履歴追加
- `GET /history` - 検索履歴取得
- `GET /history/{id}` - 特定の履歴取得
- `DELETE /history/{id}` - 履歴削除
- `GET /evaluate/cases` - テストケース取得
- `POST /evaluate/import` - テストケースインポート
- `POST /evaluate` - RAG評価実行
- `POST /evaluate/batch` - バッチ評価

詳細は http://localhost:8000/docs を参照してください。

## 画面構成

1. **ホーム (`/`)** - ランディングページ、機能紹介
2. **検索 (`/search`)** - 実験ノート検索、コピー機能付き
3. **ビューワー (`/viewer`)** - ノート直接閲覧、セクション別コピー
4. **ノート管理 (`/ingest`)** - ノート取り込み、新出単語判定
5. **辞書管理 (`/dictionary`)** - 正規化辞書の閲覧・編集・エクスポート
6. **設定 (`/settings`)** - APIキー、モデル選択、プロンプト管理

## ライセンス

MIT License

## 使い方

### 1. 初期設定

#### 1.1 APIキーの設定

1. http://localhost:3000/settings にアクセス
2. **APIキータブ**を選択
3. 以下のAPIキーを入力：
   - **OpenAI API Key**: OpenAIのAPIキー（Embedding・LLM用）
   - **Cohere API Key**: CohereのAPIキー（Reranking用）
4. 「設定を保存」をクリック

**注意**: APIキーはブラウザのlocalStorageに保存されます。サーバーには送信されません。

#### 1.2 モデルの選択（オプション）

1. **モデル選択タブ**を選択
2. 使用するモデルを選択：
   - **Embeddingモデル**: text-embedding-3-small（デフォルト）、text-embedding-3-large、text-embedding-ada-002
   - **LLMモデル**: gpt-4o-mini（デフォルト）、gpt-4o、gpt-4-turbo、gpt-3.5-turbo
3. 「設定を保存」をクリック

#### 1.3 プロンプトのカスタマイズ（オプション）

1. **プロンプト管理タブ**を選択
2. 各プロンプトを確認・編集
3. 初期設定に戻す場合は「リセット」ボタンをクリック
4. 「設定を保存」をクリック

### 2. 実験ノートの取り込み

#### 2.1 ノートの準備

1. 実験ノートをMarkdown形式（.md）で作成
2. 以下のセクションを含めることを推奨：
   ```markdown
   # 実験ノート ID3-14

   ## 目的・背景
   実験の目的を記述

   ## 材料
   - 試薬A: 100ml
   - 試薬B: 50ml

   ## 方法
   1. 手順1
   2. 手順2

   ## 結果
   実験結果を記述
   ```
3. ファイルを `backend/notes/new/` フォルダに配置（または任意のフォルダ）

#### 2.2 ノートの取り込み

1. http://localhost:3000/ingest にアクセス
2. **ソースフォルダ**を指定（空欄の場合はデフォルト: `./notes/new`）
3. **取り込み後のアクション**を選択：
   - **ファイルを残す**: そのまま保持
   - **アーカイブフォルダへ移動**: `./notes/archived` へ移動
   - **ファイルを削除**: 取り込み後にファイル削除
4. 「取り込み実行」をクリック
5. 新出単語が検出された場合、判定画面が表示されます：
   - **新規物質**: 新しい化学物質として辞書に追加
   - **表記揺れ**: 既存物質の別名として追加
   - **スキップ**: 辞書に追加しない
6. 判定を確認して「辞書を更新」をクリック

### 3. 実験ノート検索

#### 3.1 基本的な検索

1. http://localhost:3000/search にアクセス
2. 検索条件を入力：
   - **目的**: 実験の目的（例: 「○○の合成」）
   - **材料**: 使用する材料（例: 「試薬A、試薬B」）
   - **方法**: 実験方法（例: 「加熱、混合」）
   - **重点指示**（オプション）: 特に注目したいポイント
3. 「検索」ボタンをクリック
4. 結果が表示されます：
   - **比較分析レポート**: LLMによる詳細な分析
   - **上位3件のノート**: 関連度の高いノート

#### 3.2 検索結果の活用

1. 各ノートの「材料をコピー」「方法をコピー」ボタンをクリック
2. 検索条件欄に自動的に反映されます
3. 条件を調整して再検索が可能

#### 3.3 検索履歴の確認（Phase 4実装予定）

- 検索履歴は自動的に保存されます（最新100件）
- 履歴から過去の検索を再実行可能

### 4. ノート直接閲覧

1. http://localhost:3000/viewer にアクセス
2. 実験ノートIDを入力（例: `ID3-14`）
3. 「表示」ボタンをクリック
4. ノートの内容が表示されます：
   - 各セクション（目的・材料・方法・結果）にコピーボタンあり
   - コピーボタンでクリップボードにコピー

### 5. 正規化辞書の管理

#### 5.1 辞書の閲覧

1. http://localhost:3000/dictionary にアクセス
2. エントリ一覧が表示されます：
   - **正規化名**: 統一された名称
   - **表記揺れ**: 別名のリスト
   - **カテゴリ**: 試薬、溶媒など
3. 検索ボックスでフィルタリング可能

#### 5.2 辞書のエクスポート

1. 「YAML出力」「JSON出力」「CSV出力」ボタンをクリック
2. ファイルがダウンロードされます

#### 5.3 辞書のインポート

1. 「インポート」ボタンをクリック
2. YAML/JSON/CSVファイルを選択
3. 自動的に辞書が更新されます

### 6. RAG性能評価（Phase 4実装予定）

#### 6.1 テストケースの準備

CSVファイルを以下の形式で作成：
```csv
test_case_id,test_case_name,purpose,materials,methods,note_id,rank,relevance
TC001,テストケース1,合成実験,試薬A,加熱,ID3-14,1,5
TC001,テストケース1,合成実験,試薬A,加熱,ID3-15,2,4
```

#### 6.2 評価の実行

1. 評価ページにアクセス（実装予定）
2. テストケースをインポート
3. 評価を実行
4. nDCG、Precision、Recallなどの指標を確認

## バージョン履歴

- **v2.0.5** (2025-12-19) - Phase 6 デプロイ・ドキュメント完了 🎉
- **v2.0.4** (2025-12-19) - Phase 5 UI/UX改善・テスト完了
- **v2.0.3** (2025-12-19) - Phase 4 履歴・評価機能実装完了
- **v2.0.2** (2025-12-19) - Phase 3 ノート管理・辞書機能実装完了
- **v2.0.1** (2025-12-19) - Phase 2 コア機能実装完了
- **v2.0.0** (2025-12-19) - Phase 1 基盤整備完了
- **v1.0.0** - 既存システム（LangChain_v2）

## トラブルシューティング

### バックエンドが起動しない

**症状**: `python server.py` を実行してもエラーが出る

**解決策**:
1. Python 3.12以上がインストールされているか確認
   ```bash
   python --version
   ```
2. 仮想環境が有効化されているか確認
   ```bash
   # macOS/Linux
   source .venv/bin/activate

   # Windows
   .venv\Scripts\activate
   ```
3. 依存パッケージが正しくインストールされているか確認
   ```bash
   pip install -r requirements.txt
   ```

### フロントエンドが起動しない

**症状**: `npm run dev` を実行してもエラーが出る

**解決策**:
1. Node.js 18以上がインストールされているか確認
   ```bash
   node --version
   ```
2. 依存パッケージを再インストール
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### 検索時に「APIキーが設定されていません」エラー

**症状**: 検索実行時にエラーメッセージが表示される

**解決策**:
1. http://localhost:3000/settings にアクセス
2. **APIキータブ**でOpenAI API KeyとCohere API Keyを入力
3. 「設定を保存」をクリック
4. ページをリロードして再度検索

### ノート取り込みが失敗する

**症状**: ノート取り込み時にエラーが発生する

**解決策**:
1. ノートファイルがMarkdown形式（.md）であることを確認
2. ファイル名に特殊文字が含まれていないか確認
3. ソースフォルダのパスが正しいか確認（デフォルト: `./notes/new`）
4. バックエンドのログを確認（ターミナル出力）

### 辞書インポートが失敗する

**症状**: YAML/JSON/CSVファイルをインポートできない

**解決策**:
1. ファイル形式が正しいか確認：
   - **YAML**: `canonical`, `variants`, `category` のキーが必要
   - **JSON**: 配列形式で同様のキー
   - **CSV**: `canonical,variants,category` のヘッダーが必要
2. 文字エンコーディングがUTF-8であることを確認
3. ファイルサイズが大きすぎないか確認（推奨: 1MB未満）

### ChromaDBエラー

**症状**: `chromadb.errors.XXX` のようなエラーが表示される

**解決策**:
1. ChromaDBの永続化フォルダを削除して再作成
   ```bash
   cd backend
   rm -rf ./chroma_db
   ```
2. ノートを再度取り込み
   ```bash
   # バックエンドサーバーを起動した状態で
   # http://localhost:3000/ingest からノートを取り込み
   ```

### 検索結果が表示されない

**症状**: 検索を実行しても結果が0件

**解決策**:
1. データベースにノートが取り込まれているか確認
   - http://localhost:3000/ingest でノートを取り込み
2. 検索条件を緩和してみる（目的・材料・方法のいずれかのみで検索）
3. バックエンドのログでエラーが出ていないか確認

### パフォーマンスが遅い

**症状**: 検索やノート取り込みに時間がかかる

**解決策**:
1. 使用するEmbeddingモデルを軽量なものに変更
   - 設定ページで `text-embedding-3-small` を選択（デフォルト）
2. 使用するLLMモデルを軽量なものに変更
   - 設定ページで `gpt-4o-mini` を選択（デフォルト）
3. ノート数が多い場合は増分更新を活用（自動で既存ノートをスキップ）

### ブラウザのlocalStorageがクリアされた

**症状**: 設定したAPIキーやモデル選択が消えている

**解決策**:
1. 設定ページで再度APIキーを入力
2. 必要に応じてモデル選択やプロンプトも再設定
3. ブラウザのプライベートモード使用時は毎回設定が必要

### その他のエラー

上記で解決しない場合は、以下の情報を含めてGitHubのIssuesで報告してください：
- エラーメッセージ全文
- 実行したコマンドや操作手順
- 環境情報（OS、Python/Nodeバージョン）
- バックエンドのログ出力

## ドキュメント

プロジェクトには以下のドキュメントが含まれています：

1. **[README.md](README.md)** - プロジェクト概要、セットアップ、使い方
2. **[CLAUDE.md](CLAUDE.md)** - 詳細な技術仕様書
3. **[DEPLOYMENT.md](DEPLOYMENT.md)** - 本番環境へのデプロイ手順
4. **[USER_MANUAL.md](USER_MANUAL.md)** - エンドユーザー向け完全マニュアル
5. **[PRODUCTION_TEST_CHECKLIST.md](PRODUCTION_TEST_CHECKLIST.md)** - 本番環境テストチェックリスト

フェーズ別サマリー:
- **[PHASE2_SUMMARY.md](PHASE2_SUMMARY.md)** - Phase 2 実装サマリー
- **[PHASE3_SUMMARY.md](PHASE3_SUMMARY.md)** - Phase 3 実装サマリー
- **[PHASE4_SUMMARY.md](PHASE4_SUMMARY.md)** - Phase 4 実装サマリー
- **[PHASE5_SUMMARY.md](PHASE5_SUMMARY.md)** - Phase 5 実装サマリー
- **[PHASE6_SUMMARY.md](PHASE6_SUMMARY.md)** - Phase 6 実装サマリー

## サポート

問題が発生した場合は、まず上記のトラブルシューティングを確認してください。解決しない場合は、GitHubのIssuesセクションで報告してください。

詳細な使用方法については、[USER_MANUAL.md](USER_MANUAL.md) を参照してください。
