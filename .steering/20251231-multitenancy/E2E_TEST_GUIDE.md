# 認証・チーム管理機能 E2Eテストガイド

**作成日**: 2025-12-31
**対象**: Step 2 & Step 3 実装の動作確認

---

## 前提条件

以下が完了していることを確認してください：

- [x] Firebase Console でプロジェクト作成完了
- [x] `frontend/.env.local` に Firebase設定を記載
- [x] `backend/firebase-adminsdk.json` を配置
- [x] フロントエンドビルド成功（`npx next build`）

---

## テスト実行手順

### 1. バックエンド起動

```bash
cd /Users/nori8774/jikkennote-search_v1/backend
python3 server.py
```

**期待される出力**:
```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**確認**: ブラウザで `http://localhost:8000/health` にアクセスし、ヘルスチェックが成功することを確認

---

### 2. フロントエンド起動

別のターミナルで実行：

```bash
cd /Users/nori8774/jikkennote-search_v1/frontend
npm run dev
```

**期待される出力**:
```
  ▲ Next.js 15.5.9
  - Local:        http://localhost:3000
  - Environments: .env.local
```

**確認**: ブラウザで `http://localhost:3000` にアクセスし、ホームページが表示されることを確認

---

## テストシナリオ

### シナリオ1: ユーザーA - チーム作成とログイン

#### 1.1 ログイン
1. `http://localhost:3000/login` にアクセス
2. 「Googleでログイン」ボタンをクリック
3. Googleアカウントでログイン
4. ログイン成功後、`/search` ページにリダイレクトされることを確認

#### 1.2 ヘッダー確認
- ヘッダーにユーザー名とアバターが表示される
- ログアウトボタンが表示される
- チーム選択ドロップダウンは表示されない（チームが0件のため）

#### 1.3 チーム作成
1. ブラウザのコンソールを開く（開発者ツール）
2. 以下のコードを実行してチームを作成：

```javascript
// Firebase ID Tokenを取得
const auth = await import('firebase/auth');
const firebaseAuth = auth.getAuth();
const user = firebaseAuth.currentUser;
const token = await user.getIdToken();

// チーム作成APIを呼び出し
const response = await fetch('http://localhost:8000/teams/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'チームA',
    description: 'ユーザーAのチーム'
  })
});

const data = await response.json();
console.log('チーム作成結果:', data);
// 招待コードをメモ
console.log('招待コード:', data.team.inviteCode);
```

**期待される結果**:
```json
{
  "success": true,
  "team": {
    "id": "xxxxx",
    "name": "チームA",
    "inviteCode": "ABC-XYZ-123",
    ...
  },
  "message": "Team 'チームA' created successfully"
}
```

**招待コードをメモしてください**: `ABC-XYZ-123`

#### 1.4 チーム一覧確認

```javascript
const teamsResponse = await fetch('http://localhost:8000/teams', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const teamsData = await teamsResponse.json();
console.log('チーム一覧:', teamsData);
```

**期待される結果**:
```json
{
  "success": true,
  "teams": [
    {
      "id": "xxxxx",
      "name": "チームA",
      "role": "member",
      "createdAt": "2025-12-31T..."
    }
  ]
}
```

#### 1.5 ページリロード
1. ページをリロード（F5）
2. ヘッダーにチーム選択ドロップダウンが表示されることを確認
3. 「チームA」が選択されていることを確認

---

### シナリオ2: ユーザーB - 招待コードで参加

#### 2.1 別ブラウザでログイン
1. **別のブラウザ**（Chromeなら→Firefoxなど）を開く
2. `http://localhost:3000/login` にアクセス
3. **別のGoogleアカウント**でログイン

#### 2.2 チームに参加

```javascript
// Firebase ID Tokenを取得
const auth = await import('firebase/auth');
const firebaseAuth = auth.getAuth();
const user = firebaseAuth.currentUser;
const token = await user.getIdToken();

// チーム参加APIを呼び出し（ユーザーAの招待コードを使用）
const response = await fetch('http://localhost:8000/teams/join', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    inviteCode: 'ABC-XYZ-123'  // ユーザーAの招待コード
  })
});

const data = await response.json();
console.log('チーム参加結果:', data);
```

**期待される結果**:
```json
{
  "success": true,
  "teamId": "xxxxx",
  "message": "Successfully joined team: チームA"
}
```

#### 2.3 ページリロード
1. ページをリロード
2. ヘッダーに「チームA」が表示されることを確認

---

### シナリオ3: チーム脱退（エラーケース）

ユーザーBのブラウザで実行：

```javascript
// チーム一覧を取得
const teamsResponse = await fetch('http://localhost:8000/teams', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const teamsData = await teamsResponse.json();
const teamId = teamsData.teams[0].id;

// チームから脱退を試行
const response = await fetch(`http://localhost:8000/teams/${teamId}/leave`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log('脱退結果:', data);
```

**期待される結果**:
```json
{
  "detail": "Cannot leave the last team. Please join another team first."
}
```

**ステータスコード**: 400

---

### シナリオ4: ログアウト

1. ヘッダーの「ログアウト」ボタンをクリック
2. `/login` ページにリダイレクトされることを確認
3. 再度ログインできることを確認

---

## テスト完了チェックリスト

- [ ] ユーザーAがGoogleログインできた
- [ ] ユーザーAがチームを作成できた
- [ ] 招待コードが生成された
- [ ] ユーザーBが別のアカウントでログインできた
- [ ] ユーザーBが招待コードでチームに参加できた
- [ ] 最後のチームから脱退しようとするとエラーになった
- [ ] ログアウトできた
- [ ] 再ログインできた

---

## トラブルシューティング

### エラー: "Missing Authorization header"
→ Firebase ID Tokenの取得に失敗している。ログイン状態を確認。

### エラー: "Invalid or expired Firebase ID Token"
→ `firebase-adminsdk.json`のプロジェクトIDが`.env.local`のプロジェクトIDと一致しているか確認。

### エラー: "Team not found"
→ チームIDが間違っている。`GET /teams`で正しいIDを取得。

### エラー: "User is not a member of this team"
→ TeamMiddlewareが正しく動作している証拠。別のチームIDを指定している可能性。

---

## 次のステップ

全テストが成功したら、Step 4（GCSマルチテナント対応）に進みます。

**参考**:
- `.steering/20251231-multitenancy/tasklist.md`
- `.steering/20251231-multitenancy/design.md`
