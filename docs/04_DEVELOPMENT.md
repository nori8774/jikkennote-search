# 開発・運用ガイド - 実験ノート検索システム v2.0

## 目次
1. [開発環境セットアップ](#1-開発環境セットアップ)
2. [ローカル開発](#2-ローカル開発)
3. [デバッグ手順](#3-デバッグ手順)
4. [デプロイ](#4-デプロイ)
5. [運用・保守](#5-運用保守)
6. [トラブルシューティング](#6-トラブルシューティング)
7. [パフォーマンス最適化](#7-パフォーマンス最適化)
8. [セキュリティ対策](#8-セキュリティ対策)

---

## 1. 開発環境セットアップ

### 1.1 必要なソフトウェア

| ソフトウェア | バージョン | 用途 |
|------------|----------|------|
| Node.js | 18.x以上 | フロントエンド開発 |
| npm | 9.x以上 | パッケージ管理 |
| Python | 3.12以上 | バックエンド開発 |
| pip | 最新版 | Pythonパッケージ管理 |
| Git | 2.x以上 | バージョン管理 |
| Docker | 24.x以上 | コンテナ化（本番環境） |

### 1.2 リポジトリクローン

```bash
git clone https://github.com/your-org/jikkennote-search.git
cd jikkennote-search
```

### 1.3 フロントエンドセットアップ

```bash
cd frontend
npm install

# 環境変数設定
cp .env.example .env.local
```

**.env.local**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 1.4 バックエンドセットアップ

```bash
cd backend

# 仮想環境作成
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージインストール
pip install -r requirements.txt

# 環境変数設定
cp .env.example .env
```

**.env**
```bash
# ストレージ設定
STORAGE_TYPE=local  # local or gcs
GCS_BUCKET_NAME=jikkennote-storage  # 本番環境のみ

# フォルダパス（ローカル開発）
NOTES_NEW_FOLDER=./notes/new
NOTES_ARCHIVE_FOLDER=./notes/archived
CHROMA_DB_PATH=./chroma_db

# デフォルトモデル
DEFAULT_EMBEDDING_MODEL=text-embedding-3-small
DEFAULT_LLM_MODEL=gpt-4o-mini
```

### 1.5 初期データ準備

```bash
# ノート用フォルダ作成
mkdir -p backend/notes/new
mkdir -p backend/notes/archived

# ChromaDBフォルダ作成
mkdir -p backend/chroma_db

# プロンプトフォルダ作成
mkdir -p backend/prompts

# サンプル正規化辞書を配置
# master_dictionary.yaml を backend/ に配置
```

**master_dictionary.yaml（サンプル）**
```yaml
エタノール:
  - EtOH
  - エチルアルコール
  - ethanol
  - C2H5OH

ジメチルスルホキシド:
  - DMSO
  - dimethyl sulfoxide

メタノール:
  - MeOH
  - methanol
  - CH3OH
```

---

## 2. ローカル開発

### 2.1 バックエンド起動

```bash
cd backend
source venv/bin/activate

# 開発サーバー起動（ホットリロード有効）
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**起動確認**
```bash
curl http://localhost:8000/health
# => {"status":"healthy","version":"2.0.0",...}
```

### 2.2 フロントエンド起動

```bash
cd frontend
npm run dev
```

**起動確認**
ブラウザで `http://localhost:3000` を開く

### 2.3 開発ワークフロー

1. **機能開発**
   - ブランチ作成: `git checkout -b feature/new-feature`
   - コード変更
   - ローカルテスト

2. **コミット**
   ```bash
   git add .
   git commit -m "Feat: 新機能の実装"
   ```

3. **プッシュ**
   ```bash
   git push origin feature/new-feature
   ```

4. **プルリクエスト作成**
   - GitHub上でPR作成
   - レビュー後マージ

### 2.4 ホットリロード

**フロントエンド**
- ファイル変更時に自動リロード
- `npm run dev` で有効

**バックエンド**
- `--reload` オプションで有効
- Pythonファイル変更時に自動再起動

---

## 3. デバッグ手順

### 3.1 フロントエンドデバッグ

#### ブラウザDevTools

**Consoleでエラー確認**
```javascript
// API呼び出しエラー
Failed to fetch: TypeError: Failed to fetch
// => バックエンドが起動していない、CORS設定ミス

// 401エラー
Error: OpenAI APIキーが無効です
// => APIキーが正しくない
```

**Networkタブ**
- リクエスト/レスポンスの確認
- ステータスコード確認
- ペイロード確認

**React DevTools**
- コンポーネント状態の確認
- Props確認

#### VSCode Debugger

**launch.json**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "cwd": "${workspaceFolder}/frontend"
    }
  ]
}
```

### 3.2 バックエンドデバッグ

#### ログ出力

**標準出力（print）**
```python
# agent.py
def normalize_node(state: AgentState):
    print(f"[DEBUG] Input materials: {state['input_materials']}")
    normalized = normalize_text(state['input_materials'], norm_map)
    print(f"[DEBUG] Normalized: {normalized}")
    return {"normalized_materials": normalized}
```

**Pythonロギング**
```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

logger.debug("デバッグメッセージ")
logger.info("情報メッセージ")
logger.error("エラーメッセージ")
```

#### VSCode Debugger

**launch.json**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "server:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", "8000"
      ],
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

**ブレークポイント設定**
- VSCodeでPythonファイルの行番号左をクリック
- F5でデバッグ実行
- ステップ実行、変数確認

#### cURLでAPI直接テスト

```bash
# 検索APIテスト
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "テスト",
    "materials": "エタノール",
    "methods": "攪拌",
    "openai_api_key": "sk-proj-...",
    "cohere_api_key": "..."
  }' | jq .

# エラー時の詳細確認
curl -v -X POST "http://localhost:8000/search" ...
```

### 3.3 よくあるエラーと対処法

#### 「CORS policy error」

**原因**: バックエンドのCORS設定が不正

**対処**:
```python
# server.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # フロントエンドURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 「OpenAI APIキーが無効です」

**原因**: APIキーが正しくない、または期限切れ

**対処**:
1. OpenAIダッシュボードで新しいキー作成
2. フロントエンド設定画面で更新
3. `sk-proj-` で始まるキーを確認

#### 「ChromaDBが見つかりません」

**原因**: ChromaDBフォルダが存在しない

**対処**:
```bash
mkdir -p backend/chroma_db
```

#### 「モジュールが見つかりません」

**原因**: 依存パッケージ未インストール

**対処**:
```bash
cd backend
pip install -r requirements.txt
```

---

## 4. デプロイ

### 4.1 フロントエンド（Vercel）

#### 初回デプロイ

1. **Vercelアカウント作成**
   - https://vercel.com でサインアップ

2. **GitHubリポジトリ連携**
   - Vercel Dashboard → New Project
   - GitHubリポジトリ選択

3. **設定**
   ```
   Framework Preset: Next.js
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

4. **環境変数設定**
   ```
   NEXT_PUBLIC_API_URL=https://jikkennote-backend-xxx.run.app
   ```

5. **デプロイ実行**
   - `Deploy` ボタンクリック
   - ビルド完了後、URLが発行される

#### 継続的デプロイ

- `main` ブランチへのプッシュで自動デプロイ
- PRごとにプレビューデプロイ

### 4.2 バックエンド（Google Cloud Run）

#### 前提条件

- Google Cloudアカウント作成
- gcloud CLI インストール
- Docker インストール

#### デプロイ手順

```bash
# 1. Google Cloudプロジェクト設定
gcloud config set project jikkennote-search

# 2. Artifact Registry作成
gcloud artifacts repositories create jikkennote-repo \
  --repository-format=docker \
  --location=asia-northeast1

# 3. Docker認証
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

# 4. Dockerイメージビルド
cd backend
docker build -t asia-northeast1-docker.pkg.dev/jikkennote-search/jikkennote-repo/jikkennote-backend:latest .

# 5. イメージプッシュ
docker push asia-northeast1-docker.pkg.dev/jikkennote-search/jikkennote-repo/jikkennote-backend:latest

# 6. Cloud Runデプロイ
gcloud run deploy jikkennote-backend \
  --image asia-northeast1-docker.pkg.dev/jikkennote-search/jikkennote-repo/jikkennote-backend:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars STORAGE_TYPE=gcs,GCS_BUCKET_NAME=jikkennote-storage
```

#### 環境変数設定

```bash
gcloud run services update jikkennote-backend \
  --region asia-northeast1 \
  --set-env-vars STORAGE_TYPE=gcs,GCS_BUCKET_NAME=jikkennote-storage
```

### 4.3 Google Cloud Storage設定

```bash
# 1. バケット作成
gcloud storage buckets create gs://jikkennote-storage \
  --location=asia-northeast1

# 2. フォルダ構造作成
gsutil mkdir gs://jikkennote-storage/chroma-db
gsutil mkdir gs://jikkennote-storage/notes
gsutil mkdir gs://jikkennote-storage/prompts

# 3. 初期ファイルアップロード
gsutil cp master_dictionary.yaml gs://jikkennote-storage/
```

### 4.4 デプロイスクリプト

**deploy.sh**
```bash
#!/bin/bash
set -e

echo "Building Docker image..."
docker build -t asia-northeast1-docker.pkg.dev/jikkennote-search/jikkennote-repo/jikkennote-backend:latest backend/

echo "Pushing to Artifact Registry..."
docker push asia-northeast1-docker.pkg.dev/jikkennote-search/jikkennote-repo/jikkennote-backend:latest

echo "Deploying to Cloud Run..."
gcloud run deploy jikkennote-backend \
  --image asia-northeast1-docker.pkg.dev/jikkennote-search/jikkennote-repo/jikkennote-backend:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated

echo "Deployment complete!"
```

**使用方法**
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 5. 運用・保守

### 5.1 ログ確認

#### Vercel（フロントエンド）

```bash
# Vercel CLI
vercel logs
```

**ダッシュボード**
- https://vercel.com/dashboard
- プロジェクト選択 → Deployments → Logs

#### Google Cloud Run（バックエンド）

```bash
# gcloud CLI
gcloud run services logs read jikkennote-backend \
  --region asia-northeast1 \
  --limit 100

# リアルタイムログ
gcloud run services logs tail jikkennote-backend \
  --region asia-northeast1
```

**Cloud Logging**
- https://console.cloud.google.com/logs
- リソース: Cloud Run Revision
- サービス名: jikkennote-backend

### 5.2 モニタリング

#### パフォーマンス指標

**Vercel Analytics**
- ページロード時間
- Core Web Vitals
- エラーレート

**Cloud Run Metrics**
- リクエスト数
- レスポンスタイム
- CPU/メモリ使用率
- エラー率

#### アラート設定

**Cloud Monitoring**
```bash
# エラーレート > 5% でアラート
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Error Rate Alert" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=60s
```

### 5.3 バックアップ

#### ChromaDB

**手動バックアップ**
```bash
# GCSから取得
gsutil -m cp -r gs://jikkennote-storage/chroma-db ./backup/

# GCSへアップロード
gsutil -m cp -r ./chroma_db gs://jikkennote-storage/chroma-db-backup-$(date +%Y%m%d)
```

**自動バックアップ（cronジョブ）**
```bash
# backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
gsutil -m cp -r gs://jikkennote-storage/chroma-db gs://jikkennote-storage/backups/chroma-db-$DATE
```

#### 正規化辞書

```bash
# エクスポート
curl "http://localhost:8000/dictionary/export?format=yaml" -o master_dictionary_backup.yaml

# GCSへバックアップ
gsutil cp master_dictionary.yaml gs://jikkennote-storage/backups/master_dictionary_$(date +%Y%m%d).yaml
```

### 5.4 データベースメンテナンス

#### ChromaDBリセット

**UIから**
1. 設定ページ → ChromaDB管理
2. 「ChromaDBをリセット」ボタン
3. 確認ダイアログで承認

**APIから**
```bash
curl -X POST "http://localhost:8000/chroma/reset"
```

#### 再インデックス

```bash
# 全ノート再取り込み
# 1. ChromaDBリセット
curl -X POST "http://localhost:8000/chroma/reset"

# 2. 全ノート再取り込み
curl -X POST "http://localhost:8000/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "openai_api_key": "sk-proj-...",
    "source_folder": "notes",
    "post_action": "keep"
  }'
```

---

## 6. トラブルシューティング

### 6.1 検索が遅い

**症状**: 検索レスポンスが5秒以上かかる

**原因と対処**:

1. **ChromaDBのドキュメント数が多すぎる**
   - 対処: 古いノートをアーカイブ
   - インデックス再構築

2. **LLMモデルが重い**
   - 対処: `gpt-4o` → `gpt-4o-mini` に変更

3. **ネットワーク遅延**
   - 対処: リージョン確認（asia-northeast1推奨）

4. **Cohere Reranking遅延**
   - 対処: top_kを100→50に減らす

### 6.2 検索結果が不正確

**症状**: 関連性の低いノートが上位に表示される

**原因と対処**:

1. **材料名の正規化漏れ**
   - 対処: 正規化辞書に追加
   - `/dictionary` で確認

2. **Embeddingモデル不一致**
   - 対処: ChromaDB info確認
   - 必要ならリセット→再取り込み

3. **クエリ生成プロンプトが不適切**
   - 対処: プロンプト編集
   - 評価機能でnDCG測定

### 6.3 ノート取り込みエラー

**症状**: 新規ノート取り込みが失敗する

**原因と対処**:

1. **ファイル形式エラー**
   ```
   エラー: マークダウン形式ではありません
   ```
   - 対処: `.md` 拡張子確認
   - セクション構造確認（## 材料、## 方法）

2. **APIキーエラー**
   ```
   エラー: OpenAI APIキーが無効です
   ```
   - 対処: APIキー再確認
   - 課金状況確認

3. **GCSアクセスエラー**
   ```
   エラー: GCS bucket not found
   ```
   - 対処: バケット名確認
   - 権限確認（Storage Admin）

### 6.4 ChromaDB互換性エラー

**症状**: Embeddingモデル変更後、検索エラー

**エラーメッセージ**:
```
ValueError: Embedding dimension mismatch
```

**対処**:
1. 設定ページで「ChromaDBをリセット」
2. 全ノート再取り込み
3. Embedding モデル確認

### 6.5 プロンプトが保存できない

**症状**: プロンプト保存時にエラー

**原因と対処**:

1. **保存上限（50件）超過**
   ```
   エラー: プロンプトは最大50件までです
   ```
   - 対処: 不要なプロンプト削除

2. **YAML形式エラー**
   - 対処: YAML構文確認
   - インデント確認

3. **GCS書き込み権限エラー**
   - 対処: Storage Object Admin権限確認

### 6.6 評価機能エラー

**症状**: Excelインポートが失敗

**原因と対処**:

1. **ファイル形式エラー**
   - 対処: CSV/Excel形式確認
   - カラム名確認（test_case_id, query_purpose, ...）

2. **nDCGが0.0になる**
   - 対処: ground_truthに正しいノートIDが含まれているか確認
   - relevanceスコア（1-5）が正しいか確認

---

## 7. パフォーマンス最適化

### 7.1 フロントエンド最適化

#### コード分割

**動的インポート**
```typescript
// Before
import HeavyComponent from '@/components/HeavyComponent';

// After
const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <p>Loading...</p>,
});
```

#### 画像最適化

```typescript
import Image from 'next/image';

<Image
  src="/images/logo.png"
  alt="Logo"
  width={200}
  height={50}
  priority
/>
```

#### キャッシング（SWR）

```typescript
import useSWR from 'swr';

const { data, error } = useSWR('/api/search-history', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000, // 1分間キャッシュ
});
```

### 7.2 バックエンド最適化

#### ChromaDB最適化

**バッチサイズ調整**
```python
# ingest.py
BATCH_SIZE = 50  # トークン制限に応じて調整
```

**インデックス設定**
```python
# デフォルトで最適化されているが、調整可能
vectorstore = Chroma(
    collection_name="notes",
    embedding_function=embeddings,
    persist_directory=CHROMA_DB_PATH,
    collection_metadata={"hnsw:space": "cosine"}  # 類似度計算方法
)
```

#### LLM API最適化

**並列処理**
```python
import asyncio

async def generate_queries_parallel():
    tasks = [
        generate_veteran_query(),
        generate_newcomer_query(),
        generate_manager_query()
    ]
    return await asyncio.gather(*tasks)
```

**ストリーミング**
```python
# agent.py
for chunk in agent_graph.stream(state):
    print(chunk)
    # リアルタイムでフロントエンドに送信
```

### 7.3 インフラ最適化

#### Cloud Runスケーリング

```bash
gcloud run services update jikkennote-backend \
  --min-instances 1 \  # コールドスタート回避
  --max-instances 10 \ # 最大インスタンス数
  --concurrency 20     # 同時リクエスト数
```

#### CDN活用

- Vercel: 自動CDN配信
- 静的アセットのエッジキャッシング

---

## 8. セキュリティ対策

### 8.1 APIキー保護

**フロントエンド**
- localStorageに保存（平文）
- HTTPS通信のみ
- リクエスト時のみ送信

**改善案**:
```typescript
// Web Crypto APIで暗号化
async function encryptAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
```

### 8.2 入力検証

**バックエンド（Pydantic）**
```python
from pydantic import BaseModel, validator

class SearchRequest(BaseModel):
    purpose: str
    materials: str
    methods: str

    @validator('purpose', 'materials', 'methods')
    def check_not_empty(cls, v):
        if not v.strip():
            raise ValueError('空の入力は許可されません')
        return v

    @validator('purpose')
    def check_length(cls, v):
        if len(v) > 1000:
            raise ValueError('目的は1000文字以内です')
        return v
```

### 8.3 パストラバーサル対策

```python
import os
from pathlib import Path

def sanitize_path(user_input: str, base_dir: str) -> str:
    # 相対パスを絶対パスに変換
    full_path = os.path.abspath(os.path.join(base_dir, user_input))
    # ベースディレクトリ外へのアクセスを防止
    if not full_path.startswith(os.path.abspath(base_dir)):
        raise ValueError("不正なパス")
    return full_path
```

### 8.4 レート制限（未実装）

**FastAPI Limiter**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/search")
@limiter.limit("20/minute")
async def search(request: SearchRequest):
    ...
```

---

## 9. テスト実行

### 9.1 E2Eテスト（Playwright）

**テスト実行**
```bash
cd frontend
npm test
```

**特定テストのみ実行**
```bash
npm test tests/e2e/prompt-management.spec.ts
```

**デバッグモード**
```bash
npx playwright test --debug
```

**ヘッドレスモード無効**
```bash
npx playwright test --headed
```

### 9.2 APIテスト（pytest）

**テスト作成**
```python
# backend/tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_search_endpoint():
    response = client.post("/search", json={
        "purpose": "テスト",
        "materials": "エタノール",
        "methods": "攪拌",
        "openai_api_key": "test_key",
        "cohere_api_key": "test_key"
    })
    assert response.status_code == 200
    assert response.json()["success"] == True
```

**テスト実行**
```bash
cd backend
pytest tests/
```

---

## 10. チェックリスト

### 10.1 本番デプロイ前チェックリスト

- [ ] 全てのAPIキーが正しく設定されている
- [ ] 環境変数が本番環境用に設定されている
- [ ] CORS設定が正しい（本番URLのみ許可）
- [ ] ChromaDBが正しくGCSに同期されている
- [ ] 正規化辞書が最新版になっている
- [ ] プロンプトがYAML形式で保存されている
- [ ] E2Eテストが全てパスしている
- [ ] パフォーマンステストを実施済み
- [ ] セキュリティスキャン完了
- [ ] ログ設定が有効になっている
- [ ] バックアップ戦略が確立している
- [ ] ドキュメントが最新版

### 10.2 リリース後チェックリスト

- [ ] ヘルスチェックが正常
- [ ] 検索機能が正常動作
- [ ] ノート取り込みが正常動作
- [ ] 評価機能が正常動作
- [ ] プロンプト管理が正常動作
- [ ] ChromaDB管理が正常動作
- [ ] ログが正しく記録されている
- [ ] モニタリングアラートが有効
- [ ] チームメンバーがアクセス可能

---

## 11. FAQ

### Q1: ローカル開発でGCSを使いたい

**A**: `STORAGE_TYPE=gcs` に設定し、サービスアカウントキーを配置

```bash
# サービスアカウントキー取得
gcloud iam service-accounts keys create key.json \
  --iam-account=YOUR_SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com

# 環境変数設定
export GOOGLE_APPLICATION_CREDENTIALS="./key.json"
```

### Q2: Embeddingモデルを変更したい

**A**:
1. 設定ページでモデル選択
2. 警告を確認
3. 「ChromaDBをリセット」実行
4. 全ノート再取り込み

### Q3: プロンプトをチーム内で共有したい

**A**:
1. プロンプトをエクスポート（YAMLダウンロード）
2. チームメンバーに配布
3. インポート機能で読み込み

### Q4: 検索履歴を削除したい

**A**: ブラウザのlocalStorageをクリア

```javascript
// ブラウザのConsoleで実行
localStorage.removeItem('searchHistory');
```

---

**作成日**: 2025-12-25
**最終更新**: 2025-12-25
**バージョン**: 2.0.0
**管理者**: 開発チーム
