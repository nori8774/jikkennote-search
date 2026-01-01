# 設計書: マルチテナント基盤整備

## 1. アーキテクチャ概要

### システム構成図

```
┌─────────────────────────────────────────────────┐
│ Frontend (Next.js + Firebase SDK)              │
│  ├─ Login Page (Google OAuth)                  │
│  ├─ Team Selector (Header)                     │
│  ├─ Team Management Page                       │
│  └─ Auth Context (認証状態管理)                 │
└──────────────┬──────────────────────────────────┘
               │ Firebase ID Token
               │ X-Team-ID Header
               ▼
┌─────────────────────────────────────────────────┐
│ Backend (FastAPI + Firebase Admin SDK)         │
│  ├─ Auth Middleware (Token検証)                │
│  ├─ Team API (teams.py)                        │
│  ├─ Storage Layer (storage.py)                 │
│  └─ ChromaDB Manager (chroma_sync.py)          │
└──────────┬──────────────────┬───────────────────┘
           │                  │
           ▼                  ▼
   ┌─────────────┐    ┌──────────────────┐
   │ Firestore   │    │ Google Cloud     │
   │ (Teams,     │    │ Storage          │
   │  Members)   │    │ teams/{team_id}/ │
   └─────────────┘    └──────────────────┘
```

## 2. データモデル

### 2.1 Firestore スキーマ

#### teams コレクション
```typescript
interface Team {
  id: string;                    // 自動生成
  name: string;                  // チーム名
  description?: string;          // チーム説明
  createdAt: Timestamp;          // 作成日時
  updatedAt: Timestamp;          // 更新日時
  inviteCode: string;            // 招待コード (7日間有効)
  inviteCodeExpiresAt: Timestamp; // 招待コード有効期限
}
```

#### team_members サブコレクション
```typescript
// Path: teams/{teamId}/members/{userId}
interface TeamMember {
  userId: string;                // Firebase UID
  email: string;                 // メールアドレス
  displayName?: string;          // 表示名
  joinedAt: Timestamp;           // 参加日時
  role: 'member';                // v3.0では固定（将来拡張）
}
```

### 2.2 GCS ストレージ構造

```
gs://jikkennote-storage/
└── teams/
    └── {team_id}/
        ├── chroma-db/           # ChromaDB永続化
        │   └── chroma.sqlite3
        ├── notes/
        │   ├── new/             # 新規ノート
        │   └── processed/       # 取り込み済み
        ├── saved_prompts/       # 保存されたプロンプト
        │   └── *.yaml
        └── dictionary.yaml      # 正規化辞書
```

### 2.3 ChromaDB コレクション命名

```python
collection_name = f"notes_{team_id}"
```

各チームが独立したコレクションを持つ。

## 3. API設計

### 3.1 認証関連

#### POST /auth/verify
Firebase ID Tokenを検証する（内部用）

**Request**:
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```

**Response**:
```json
{
  "success": true,
  "uid": "firebase_uid_123",
  "email": "user@example.com",
  "displayName": "User Name"
}
```

### 3.2 チーム管理

#### GET /teams
ユーザーが所属するチーム一覧を取得

**Headers**:
```
Authorization: Bearer {firebase_id_token}
```

**Response**:
```json
{
  "success": true,
  "teams": [
    {
      "id": "team_abc123",
      "name": "材料科学研究室",
      "role": "member",
      "createdAt": "2025-12-31T10:00:00Z"
    }
  ]
}
```

#### POST /teams/create
新しいチームを作成

**Headers**:
```
Authorization: Bearer {firebase_id_token}
```

**Request**:
```json
{
  "name": "新規研究チーム",
  "description": "次世代材料の研究開発"
}
```

**Response**:
```json
{
  "success": true,
  "team": {
    "id": "team_new456",
    "name": "新規研究チーム",
    "inviteCode": "ABC-XYZ-123"
  }
}
```

#### POST /teams/join
招待コードでチームに参加

**Headers**:
```
Authorization: Bearer {firebase_id_token}
```

**Request**:
```json
{
  "inviteCode": "ABC-XYZ-123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "チーム「新規研究チーム」に参加しました",
  "teamId": "team_new456"
}
```

#### POST /teams/{team_id}/leave
チームから脱退

**Headers**:
```
Authorization: Bearer {firebase_id_token}
```

**Response**:
```json
{
  "success": true,
  "message": "チームから脱退しました"
}
```

**Error (最後のチーム)**:
```json
{
  "success": false,
  "error": "最後のチームからは脱退できません"
}
```

#### DELETE /teams/{team_id}
チームを削除

**Headers**:
```
Authorization: Bearer {firebase_id_token}
X-Team-ID: {team_id}
```

**Response**:
```json
{
  "success": true,
  "message": "チームを削除しました"
}
```

### 3.3 既存APIの変更

全エンドポイントに以下を追加：
- **Headers**: `X-Team-ID: {team_id}` (必須)
- **Middleware**: Firebase ID Token検証
- **Middleware**: Team ID検証（ユーザーがチームのメンバーか確認）

## 4. フロントエンド設計

### 4.1 認証状態管理

#### AuthContext
```typescript
// lib/auth-context.tsx
interface AuthContextType {
  user: User | null;
  currentTeamId: string | null;
  teams: Team[];
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchTeam: (teamId: string) => void;
  loading: boolean;
}
```

### 4.2 ページ構成

#### app/login/page.tsx
- Googleログインボタン
- Firebase Authentication統合
- ログイン後は検索ページにリダイレクト

#### app/teams/page.tsx
- チーム一覧表示
- チーム作成フォーム
- 招待コード表示・コピー
- 招待コード入力・参加
- チーム脱退・削除ボタン

#### components/Header.tsx
```typescript
// ヘッダーにチーム選択ドロップダウンを追加
<select value={currentTeamId} onChange={handleTeamChange}>
  {teams.map(team => (
    <option key={team.id} value={team.id}>{team.name}</option>
  ))}
</select>
```

### 4.3 ローカルストレージ

```typescript
// 選択中のチームIDを保存
localStorage.setItem('currentTeamId', teamId);

// ページロード時に復元
const teamId = localStorage.getItem('currentTeamId');
```

## 5. バックエンド設計

### 5.1 認証ミドルウェア

```python
# backend/auth.py
from firebase_admin import auth, credentials
import firebase_admin

# 初期化
cred = credentials.Certificate('firebase-adminsdk.json')
firebase_admin.initialize_app(cred)

async def verify_firebase_token(id_token: str):
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# ミドルウェア
async def auth_middleware(request: Request, call_next):
    if request.url.path in ["/health", "/auth/verify"]:
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = auth_header.split("Bearer ")[1]
    decoded = await verify_firebase_token(token)
    request.state.user = decoded

    return await call_next(request)
```

### 5.2 チーム管理ロジック

```python
# backend/teams.py
from google.cloud import firestore

db = firestore.Client()

def create_team(user_id: str, name: str, description: str = None):
    # 招待コード生成
    invite_code = generate_invite_code()

    # チーム作成
    team_ref = db.collection('teams').document()
    team_ref.set({
        'name': name,
        'description': description,
        'createdAt': firestore.SERVER_TIMESTAMP,
        'updatedAt': firestore.SERVER_TIMESTAMP,
        'inviteCode': invite_code,
        'inviteCodeExpiresAt': datetime.now() + timedelta(days=7)
    })

    # 作成者をメンバーに追加
    team_ref.collection('members').document(user_id).set({
        'userId': user_id,
        'email': user_email,
        'joinedAt': firestore.SERVER_TIMESTAMP,
        'role': 'member'
    })

    # GCSにチームフォルダ作成
    create_team_folders_in_gcs(team_ref.id)

    return team_ref.id, invite_code

def join_team(user_id: str, invite_code: str):
    # 招待コードでチーム検索
    teams = db.collection('teams').where('inviteCode', '==', invite_code).get()

    if not teams:
        raise ValueError("Invalid invite code")

    team = teams[0]

    # 有効期限チェック
    if team.to_dict()['inviteCodeExpiresAt'] < datetime.now():
        raise ValueError("Invite code expired")

    # メンバーに追加
    team.reference.collection('members').document(user_id).set({
        'userId': user_id,
        'email': user_email,
        'joinedAt': firestore.SERVER_TIMESTAMP,
        'role': 'member'
    })

    return team.id
```

### 5.3 ストレージレイヤー変更

```python
# backend/storage.py
def get_team_path(team_id: str, resource_type: str) -> str:
    """
    チームスコープのパスを生成

    Args:
        team_id: チームID
        resource_type: 'notes_new' | 'notes_processed' | 'prompts' | 'dictionary' | 'chroma'

    Returns:
        GCSパス or ローカルパス
    """
    if STORAGE_TYPE == 'gcs':
        base = f"teams/{team_id}"
    else:
        base = f"./data/teams/{team_id}"

    paths = {
        'notes_new': f"{base}/notes/new",
        'notes_processed': f"{base}/notes/processed",
        'prompts': f"{base}/saved_prompts",
        'dictionary': f"{base}/dictionary.yaml",
        'chroma': f"{base}/chroma-db"
    }

    return paths[resource_type]
```

### 5.4 ChromaDB変更

```python
# backend/chroma_sync.py
def get_collection(team_id: str):
    collection_name = f"notes_{team_id}"

    client = chromadb.PersistentClient(
        path=get_team_path(team_id, 'chroma')
    )

    return client.get_or_create_collection(name=collection_name)
```

## 6. データ移行計画

### 既存データの移行

```bash
# 既存データを team_default に移行
gsutil -m mv gs://jikkennote-storage/chroma-db gs://jikkennote-storage/teams/team_default/chroma-db
gsutil -m mv gs://jikkennote-storage/notes gs://jikkennote-storage/teams/team_default/notes
gsutil -m mv gs://jikkennote-storage/prompts gs://jikkennote-storage/teams/team_default/saved_prompts
gsutil cp gs://jikkennote-storage/master_dictionary.yaml gs://jikkennote-storage/teams/team_default/dictionary.yaml
```

## 7. テスト計画

### 単体テスト
- `auth.py`: Firebase ID Token検証
- `teams.py`: チームCRUD操作
- `storage.py`: チームスコープのパス生成

### E2Eテスト
- ユーザーA（チーム1）とユーザーB（チーム2）が独立して動作
- チーム1のノートがチーム2の検索結果に表示されない
- チーム切り替え時にデータが正しく切り替わる

---

**作成日**: 2025-12-31
**対象フェーズ**: Phase 1
**推奨モデル**: Opus
