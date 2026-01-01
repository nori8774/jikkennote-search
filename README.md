# 実験ノート検索システム v2.0

LangChainを活用した高精度な実験ノート検索システムの機能拡張版

## プロジェクト概要

既存の実験ノート検索システム（LangChain_v2）をベースに、ユーザビリティとカスタマイズ性を大幅に向上させたWebアプリケーションです。研究者がブラウザから簡単にアクセスでき、過去の実験ノートを高精度に検索・比較できます。

### 主要機能

1. **プロンプト管理機能** - コード内プロンプトをUI上でカスタマイズ
2. **検索結果コピー機能** - 材料・方法をワンクリックで検索条件欄に反映
3. **検索履歴管理** - クエリごとに保存、テーブル表示
4. **ノートビューワー** - 実験ノートID入力で全文表示
5. **モデル選択UI** - OpenAI Embedding/LLMをUI上で選択
6. **RAG性能評価** - Excel/CSVインポート、nDCG等の評価指標
7. **新出単語抽出** - 表記揺れ判定、正規化辞書自動更新
8. **ChromaDB管理** - Embeddingモデル変更時の互換性警告とリセット機能

---

## 技術スタック

**フロントエンド**: Next.js 15 (App Router) | React 19 | TypeScript | Tailwind CSS

**バックエンド**: Python 3.12+ | FastAPI | LangChain + LangGraph | ChromaDB | Cohere Rerank

**インフラ**: Vercel (フロント) | Google Cloud Run (バックエンド) | GCS (ストレージ)

---

## クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/jikkennote-search.git
cd jikkennote-search
```

### 2. バックエンドのセットアップ

```bash
cd backend

# 仮想環境作成
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 依存パッケージインストール
pip install -r requirements.txt

# サーバー起動
python server.py
```

サーバーは http://localhost:8000 で起動します。

### 3. フロントエンドのセットアップ

```bash
cd frontend

# 依存パッケージインストール
npm install

# 開発サーバー起動
npm run dev
```

UIは http://localhost:3000 で起動します。

### 4. 初期設定

1. http://localhost:3000/settings にアクセス
2. **APIキータブ**でOpenAI API KeyとCohere API Keyを入力
3. 「設定を保存」をクリック

---

## ドキュメント

### 主要ドキュメント

- **[CLAUDE.md](CLAUDE.md)** - プロジェクトメモリ（技術スタック、開発プロセス）
- **[USER_MANUAL.md](USER_MANUAL.md)** - エンドユーザー向け完全マニュアル

### 設計ドキュメント (`docs/`)

- [初期要件・アイデアメモ](docs/ideas/initial-requirements.md)
- [プロダクト要求定義書](docs/product-requirements.md)
- [機能設計書](docs/functional-design.md)
- [技術仕様書](docs/architecture.md)
- [API仕様書](docs/api-specification.md)
- [リポジトリ構造定義書](docs/repository-structure.md)
- [開発ガイドライン](docs/development-guidelines.md)
- [用語集](docs/glossary.md)

### デプロイドキュメント

**Google Cloud Run版** (推奨):
- **[DEPLOY_NOW_CLOUDRUN.md](DEPLOY_NOW_CLOUDRUN.md)** - 今すぐデプロイ ⭐
- **[DEPLOYMENT_CLOUDRUN.md](DEPLOYMENT_CLOUDRUN.md)** - 詳細なデプロイ手順

**Railway/Render版**:
- **[DEPLOY_NOW.md](DEPLOY_NOW.md)** - 今すぐデプロイ
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - 詳細なデプロイ手順

**共通**:
- **[PRODUCTION_TEST_CHECKLIST.md](PRODUCTION_TEST_CHECKLIST.md)** - 本番環境テストチェックリスト

---

## 使い方

### 実験ノートの取り込み

1. 実験ノートをMarkdown形式（.md）で作成
2. `backend/notes/new/` フォルダに配置
3. http://localhost:3000/ingest にアクセス
4. 「取り込み実行」をクリック
5. 新出単語が検出された場合、判定画面が表示されます

### 実験ノート検索

1. http://localhost:3000/search にアクセス
2. 検索条件を入力（目的、材料、方法、重点指示）
3. 「検索」ボタンをクリック
4. 結果が表示されます（比較分析レポート + 上位3件のノート）

詳細は [USER_MANUAL.md](USER_MANUAL.md) を参照してください。

---

## 開発ステータス

### Phase 1-6: 全機能実装完了 ✅

- [x] 基盤整備（Next.js + FastAPI）
- [x] コア機能実装（プロンプト管理、検索コピー、モデル選択）
- [x] ノート管理・辞書機能（新出単語抽出、正規化辞書）
- [x] 履歴・評価機能（検索履歴、RAG性能評価）
- [x] UI/UX改善・テスト（E2Eテスト、レスポンシブ対応）
- [x] デプロイ・ドキュメント（Vercel, Google Cloud Run）

**現在のバージョン**: v2.0.5 (2025-12-29)

---

## ディレクトリ構造

```
jikkennote-search/
├── frontend/          # Next.js フロントエンド
│   ├── app/          # App Router ページ
│   ├── tests/        # E2Eテスト
│   └── package.json
│
├── backend/          # FastAPI バックエンド
│   ├── server.py     # メインAPIサーバー
│   ├── agent.py      # LangGraph ワークフロー
│   ├── ingest.py     # ノート取り込みロジック
│   ├── chroma_sync.py # ChromaDB管理
│   └── requirements.txt
│
├── docs/             # ドキュメント
│   ├── ideas/       # 初期要件、アイデアメモ
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── api-specification.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   └── glossary.md
│
├── CLAUDE.md         # プロジェクトメモリ
├── README.md         # このファイル
├── DEPLOYMENT.md     # デプロイ手順書
├── USER_MANUAL.md    # ユーザーマニュアル
└── PRODUCTION_TEST_CHECKLIST.md
```

詳細は [docs/repository-structure.md](docs/repository-structure.md) を参照してください。

---

## トラブルシューティング

### バックエンドが起動しない

**対処**:
1. Python 3.12以上がインストールされているか確認
2. 仮想環境が有効化されているか確認
3. `pip install -r requirements.txt` を再実行

### フロントエンドが起動しない

**対処**:
1. Node.js 18以上がインストールされているか確認
2. `rm -rf node_modules package-lock.json && npm install` を実行

### 検索時に「APIキーが設定されていません」エラー

**対処**:
1. http://localhost:3000/settings にアクセス
2. OpenAI API KeyとCohere API Keyを入力
3. 「設定を保存」をクリック

詳細は [USER_MANUAL.md](USER_MANUAL.md) のトラブルシューティングセクションを参照してください。

---

## テスト

### E2Eテスト（Playwright）

```bash
cd frontend
npm test                                # 全テスト実行
npm test tests/e2e/prompt-management.spec.ts  # 特定テスト実行
npx playwright test --debug             # デバッグモード
```

### APIテスト

```bash
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "テスト",
    "materials": "エタノール",
    "methods": "攪拌",
    "openai_api_key": "sk-proj-...",
    "cohere_api_key": "..."
  }' | jq .
```

---

## ライセンス

MIT License

---

## バージョン履歴

- **v2.0.5** (2025-12-29) - ドキュメント整備完了 📚
- **v2.0.4** (2025-12-19) - Phase 6 デプロイ・ドキュメント完了 🎉
- **v2.0.3** (2025-12-19) - Phase 5 UI/UX改善・テスト完了
- **v2.0.2** (2025-12-19) - Phase 4 履歴・評価機能実装完了
- **v2.0.1** (2025-12-19) - Phase 3 ノート管理・辞書機能実装完了
- **v2.0.0** (2025-12-19) - Phase 2 コア機能実装完了
- **v1.0.0** - 既存システム（LangChain_v2）

---

## サポート

問題が発生した場合は、まず [USER_MANUAL.md](USER_MANUAL.md) のトラブルシューティングを確認してください。解決しない場合は、GitHubのIssuesセクションで報告してください。

---

**開発チーム** | **最終更新**: 2025-12-29
