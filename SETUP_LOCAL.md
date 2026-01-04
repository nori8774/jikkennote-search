# ローカル環境セットアップガイド

GitHubからリポジトリをクローンして、ローカル環境で実験ノート検索システムを動かすための手順書です。

---

## 前提条件

| ソフトウェア | バージョン | 確認コマンド |
|------------|----------|------------|
| Node.js | 18以上 | `node -v` |
| npm | 9以上 | `npm -v` |
| Python | 3.12以上 | `python3 --version` |
| pip | 最新推奨 | `pip3 --version` |
| Git | 最新推奨 | `git --version` |

### インストールがまだの場合

**Node.js**: https://nodejs.org/ からLTS版をダウンロード

**Python**: https://www.python.org/downloads/ からダウンロード
または Homebrew (Mac): `brew install python@3.12`

---

## 1. リポジトリのクローン

```bash
git clone https://github.com/nori8774/jikkennote-search.git
cd jikkennote-search
```

---

## 2. Firebaseプロジェクトの作成

本システムはFirebase Authenticationを使用しています。新規ユーザーは自分のFirebaseプロジェクトを作成する必要があります。

### 2.1 Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `jikkennote-search`）
4. Googleアナリティクスは無効でOK → 「プロジェクトを作成」

### 2.2 Firebase Authentication の設定

1. 左メニューの「Authentication」をクリック
2. 「始める」をクリック
3. 「Sign-in method」タブで「Google」をクリック
4. 「有効にする」をON
5. プロジェクトのサポートメールを選択
6. 「保存」をクリック

### 2.3 Webアプリの追加（フロントエンド用）

1. プロジェクトの概要画面で「</>」（Web）アイコンをクリック
2. アプリのニックネームを入力（例: `jikkennote-frontend`）
3. 「アプリを登録」をクリック
4. 表示される`firebaseConfig`の値をメモ:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef..."
   };
   ```
5. 「コンソールに進む」をクリック

### 2.4 サービスアカウントキーの取得（バックエンド用）

1. 左メニューの歯車アイコン → 「プロジェクトの設定」
2. 「サービスアカウント」タブをクリック
3. 「新しい秘密鍵の生成」をクリック
4. ダウンロードしたJSONファイルを`backend/firebase-adminsdk.json`として保存

---

## 3. バックエンドのセットアップ

### 3.1 仮想環境の作成と有効化

```bash
cd backend

# 仮想環境を作成
python3 -m venv .venv

# 仮想環境を有効化
# Mac/Linux:
source .venv/bin/activate

# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# Windows (コマンドプロンプト):
.\.venv\Scripts\activate.bat
```

**確認**: プロンプトの先頭に `(.venv)` が表示されればOK

### 3.2 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

インストールに5〜10分かかる場合があります。

### 3.3 Firebase認証ファイルの確認

手順2.4でダウンロードした`firebase-adminsdk.json`が`backend/`フォルダに配置されていることを確認：

```bash
ls backend/firebase-adminsdk.json
```

### 3.4 バックエンドの起動

```bash
python server.py
```

成功すると以下のように表示されます：

```
✅ Firebase Admin SDK initialized successfully
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**確認**: ブラウザで http://localhost:8000/health にアクセスし、`{"status":"healthy"}` が表示されればOK

---

## 4. フロントエンドのセットアップ

新しいターミナルを開いて以下を実行します。

### 4.1 依存パッケージのインストール

```bash
cd frontend
npm install
```

### 4.2 環境変数の設定

手順2.3でメモした`firebaseConfig`の値を使用して、`.env.local`ファイルを作成します：

```bash
cat > .env.local << 'EOF'
# API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Firebase Configuration（手順2.3の値に置き換えてください）
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef...
EOF
```

**重要**: 上記の値を実際のFirebaseプロジェクトの値に置き換えてください。

### 4.3 フロントエンドの起動

```bash
npm run dev
```

成功すると以下のように表示されます：

```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Ready in 2.3s
```

---

## 5. 初期設定と動作確認

### 5.1 ログイン

1. ブラウザで http://localhost:3000 にアクセス
2. 「Googleでログイン」をクリック
3. Googleアカウントでログイン

### 5.2 チームの作成

1. ナビゲーションメニューの「チーム管理」をクリック
2. 「新しいチームを作成」セクションでチーム名を入力
3. 「チームを作成」をクリック

### 5.3 APIキーの設定

1. ナビゲーションメニューの「設定」をクリック
2. 「APIキー」タブを選択
3. 以下のキーを入力：
   - **OpenAI API Key**: `sk-proj-...` で始まるキー
   - **Cohere API Key**: Cohereダッシュボードから取得
4. 「設定を保存」をクリック

**APIキーの取得方法：**
- OpenAI: https://platform.openai.com/api-keys
- Cohere: https://dashboard.cohere.com/api-keys

### 5.4 実験ノートの取り込みテスト

1. サンプルノートを作成（Markdown形式）:

```markdown
# ID1-1 サンプル実験

## 目的
テスト用の実験ノートです。

## 材料
- 純水 100mL
- NaCl 10g

## 方法
1. 純水をビーカーに入れる
2. NaClを加えて撹拌する

## 結果
溶液が完成した。
```

2. 「ノート管理」ページにアクセス
3. ファイルをドラッグ&ドロップでアップロード
4. 「取り込み実行」をクリック

### 5.5 検索テスト

1. 「検索」ページにアクセス
2. 目的に「テスト」、材料に「NaCl」と入力
3. 「検索」ボタンをクリック
4. 結果が表示されることを確認

---

## トラブルシューティング

### バックエンドが起動しない

**エラー**: `ModuleNotFoundError: No module named 'xxx'`

```bash
# 仮想環境が有効になっているか確認
which python  # Mac/Linux
where python  # Windows

# 再インストール
pip install -r requirements.txt
```

**エラー**: `Firebase Admin SDK の秘密鍵が見つかりません`

```bash
# ファイルが正しい場所にあるか確認
ls -la backend/firebase-adminsdk.json
```

→ 手順2.4で取得したファイルを配置してください。

### フロントエンドが起動しない

**エラー**: `Module not found` 系

```bash
# node_modulesを再インストール
rm -rf node_modules package-lock.json
npm install
```

### ログインできない

1. Firebase Consoleで「Authentication」→「Sign-in method」を確認
2. 「Google」が有効になっていることを確認
3. 「Settings」→「Authorized domains」に`localhost`が含まれていることを確認

### 検索時にエラーが発生する

1. 「設定」ページでAPIキーが正しく保存されているか確認
2. OpenAI APIキーの残高を確認（https://platform.openai.com/account/billing）
3. バックエンドのターミナルでエラーログを確認

---

## ファイル構成

```
jikkennote-search/
├── backend/                    # バックエンド
│   ├── server.py              # メインAPIサーバー
│   ├── agent.py               # 検索エージェント
│   ├── requirements.txt       # Python依存パッケージ
│   ├── firebase-adminsdk.json # Firebase認証（※要配置）
│   └── teams/                 # チームデータ（自動生成）
│       └── {team_id}/
│           ├── notes/         # ノートファイル
│           ├── chroma_db/     # ベクトルDB
│           └── dictionary.yaml # 辞書
│
├── frontend/                   # フロントエンド
│   ├── app/                   # Next.js App Router
│   ├── lib/                   # ユーティリティ
│   ├── components/            # 共通コンポーネント
│   └── .env.local             # 環境変数（※要作成）
│
└── docs/                       # ドキュメント
```

---

## 次のステップ

- [USER_MANUAL.md](USER_MANUAL.md) - 詳細な使い方
- [CLAUDE.md](CLAUDE.md) - 開発者向け技術情報
- [docs/api-specification.md](docs/api-specification.md) - API仕様

---

**最終更新**: 2026-01-04
