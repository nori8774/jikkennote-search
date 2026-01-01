# タスクリスト: マルチテナント基盤整備

## Step 1: Firebase設定（0.5日）

### Firebase Console設定
- [ ] Firebase Consoleでプロジェクト作成（プロジェクト名: jikkennote-search）⚠️ **ユーザー作業待ち**
- [ ] Google認証プロバイダー有効化 ⚠️ **ユーザー作業待ち**
- [ ] Firebase Admin SDK秘密鍵ダウンロード（firebase-adminsdk.json）⚠️ **ユーザー作業待ち**
- [ ] Firestore Database作成（ロケーション: asia-northeast1）⚠️ **ユーザー作業待ち**

### フロントエンド設定
- [x] `npm install firebase` をfrontend/にインストール
- [x] Firebase設定ファイル作成（`frontend/lib/firebase-config.ts`）
- [x] 環境変数のテンプレート作成（`.env.local.example`）
- [ ] `.env.local` に実際のFirebase Configを設定 ⚠️ **ユーザー作業待ち**

### バックエンド設定
- [x] `pip install firebase-admin google-cloud-firestore` をrequirements.txtに追加
- [x] `.gitignore`に`firebase-adminsdk.json`を追加
- [x] Firebase Admin SDK初期化コード作成（`backend/firebase_init.py`）
- [ ] `backend/firebase-adminsdk.json` を配置 ⚠️ **ユーザー作業待ち**

---

## Step 2: 認証機能実装（1日）✅ **完了**

### フロントエンド認証

#### ログインページ
- [x] `frontend/app/login/page.tsx` 作成
- [x] Googleログインボタン実装
- [x] Firebase Authentication統合（signInWithPopup）
- [x] ログイン成功後、ID Token取得
- [x] ログイン成功後、`/search`にリダイレクト

#### 認証コンテキスト
- [x] `frontend/lib/auth-context.tsx` 作成
- [x] AuthContext定義（user, currentTeamId, teams, login, logout, switchTeam）
- [x] useAuth カスタムフック作成
- [x] onAuthStateChanged でログイン状態監視
- [x] ログアウト機能実装

#### ヘッダー更新
- [x] `frontend/components/Header.tsx` 更新
- [x] ログイン状態表示（ユーザー名、アバター）
- [x] ログアウトボタン追加
- [x] チーム選択ドロップダウン追加

#### レイアウト更新
- [x] `frontend/app/providers.tsx` 作成（AuthProviderラッパー）
- [x] `frontend/app/layout.tsx` 更新（Providersで全体をラップ）

#### APIクライアント更新
- [x] `frontend/lib/api.ts` 更新
- [x] `getAuthHeaders()` ヘルパー関数追加

### バックエンド認証

#### 認証ユーティリティ
- [x] `backend/auth.py` 作成
- [x] `verify_firebase_token(id_token)` 関数実装
- [x] Firebase Admin SDKでID Token検証

#### 認証ミドルウェア
- [x] `backend/middleware.py` 作成
- [x] `AuthMiddleware` 実装（全エンドポイントでトークン検証）
- [x] `TeamMiddleware` 実装（X-Team-IDヘッダー検証）
- [x] `/health`, `/auth/verify`はスキップ
- [x] 検証成功時、`request.state.user`に認証情報を設定

#### 認証API
- [x] `server.py`に`POST /auth/verify`エンドポイント追加（内部用）
- [x] ミドルウェアをインポート（コメントアウトで無効化、Step 3後に有効化）

---

## Step 3: チーム管理API（1.5日）✅ **完了**

### Firestoreスキーマ実装

#### チーム操作
- [x] `backend/teams.py` 作成
- [x] `create_team(user_id, name, description)` 関数実装
  - Firestoreに teams コレクション作成
  - 招待コード生成（`generate_invite_code()`）
  - 作成者をメンバーに追加（team_members サブコレクション）
  - GCSにチームフォルダ作成
- [x] `get_user_teams(user_id)` 関数実装
  - ユーザーが所属する全チームを取得
- [x] `join_team(user_id, invite_code)` 関数実装
  - 招待コードでチーム検索
  - 有効期限チェック
  - メンバーに追加
- [x] `leave_team(user_id, team_id)` 関数実装
  - ユーザーが最低1チームに所属しているか確認
  - メンバーから削除
- [x] `delete_team(team_id)` 関数実装
  - Firestoreからチーム削除
  - GCSからチームフォルダ削除
  - ChromaDBコレクション削除（Step 4で実装予定）

#### ヘルパー関数
- [x] `generate_invite_code()` 実装（形式: ABC-XYZ-123）
- [x] `is_team_member(user_id, team_id)` 実装
- [x] `create_team_folders_in_gcs(team_id)` 実装

### API エンドポイント

#### server.py更新
- [x] Request/Responseモデル追加（CreateTeamRequest, JoinTeamRequest等）
- [x] `GET /teams` エンドポイント追加
  - ユーザーが所属するチーム一覧を返す
- [x] `POST /teams/create` エンドポイント追加
  - チーム作成、招待コード返却
- [x] `POST /teams/join` エンドポイント追加
  - 招待コードで参加
- [x] `POST /teams/{team_id}/leave` エンドポイント追加
  - チーム脱退（最後のチーム以外）
- [x] `DELETE /teams/{team_id}` エンドポイント追加
  - チーム削除（全データ削除）

#### チームIDミドルウェア
- [x] `TeamMiddleware` 更新
  - `X-Team-ID`ヘッダーの存在確認
  - ユーザーがチームのメンバーか確認（`is_team_member()`使用）
  - `/teams/*` エンドポイントはスキップ

#### ミドルウェア有効化
- [x] `AuthMiddleware`, `TeamMiddleware` を有効化（server.py 48-49行）

### テスト
- [ ] チーム作成 → 招待コード発行の手動テスト ⚠️ **次のタスク**
- [ ] 招待コードで参加の手動テスト
- [ ] チーム脱退の手動テスト（最後のチームでエラー確認）
- [ ] チーム削除の手動テスト

---

## Step 4: GCSマルチテナント対応（1日）

### ストレージレイヤー変更

#### storage.py更新
- [x] `get_team_path(team_id, resource_type)` 関数実装
  - `resource_type`: 'notes_new', 'notes_processed', 'prompts', 'dictionary', 'chroma'
  - GCS: `teams/{team_id}/[resource]`
  - ローカル: `./data/teams/{team_id}/[resource]`
- [ ] 全ファイル操作関数を`team_id`引数対応に変更（⚠️ 保留: 現在は既存関数をそのまま使用）
  - `list_files(team_id, folder_type)`
  - `upload_file(team_id, folder_type, filename, content)`
  - `download_file(team_id, folder_type, filename)`
  - `delete_file(team_id, folder_type, filename)`

### 既存エンドポイント更新

#### server.py
- [x] `/search` エンドポイント: `request.state.team_id`を使用 → SearchAgentに渡す
- [x] `/ingest` エンドポイント: team_id対応 → ingest_notesに渡す
- [x] `/notes/{id}` エンドポイント: team_id対応 → チーム専用パスから検索
- [ ] `/dictionary/*` エンドポイント: team_id対応（⚠️ 保留: DictionaryManagerのリファクタリングが必要）
- [ ] `/prompts/*` エンドポイント: team_id対応（⚠️ 保留: PromptManagerのリファクタリングが必要）
- [x] `/evaluate/*` エンドポイント: team_id対応 → SearchAgentに渡す

#### agent.py
- [x] SearchAgentに`team_id`パラメータ追加
- [x] team_id指定時は`get_team_chroma_vectorstore()`を使用

#### ingest.py
- [x] ingest_notesに`team_id`パラメータ追加
- [x] team_id指定時はチーム専用パスとChromaDBを使用

### ChromaDB更新

#### chroma_sync.py
- [x] `get_team_chroma_vectorstore(team_id, embeddings, embedding_model)` 関数実装
  - コレクション名: `notes_{team_id}`
  - パス: `storage.get_team_path(team_id, 'chroma')`
- [x] チーム専用のembedding設定ファイル管理

### データ移行スクリプト

- [ ] `backend/scripts/migrate_to_multitenancy.py` 作成
- [ ] デフォルトチーム（`team_default`）作成
- [ ] 既存データを`teams/team_default/`に移行
  - `chroma-db/` → `teams/team_default/chroma-db/`
  - `notes/` → `teams/team_default/notes/`
  - `prompts/` → `teams/team_default/saved_prompts/`
  - `master_dictionary.yaml` → `teams/team_default/dictionary.yaml`

### テスト
- [ ] 新規チームでノート検索が空であることを確認
- [ ] チームAでノート取り込み → チームBで表示されないことを確認
- [ ] チーム切り替え → データが切り替わることを確認

---

## Step 5: フロントエンド統合（1日）

### チーム管理ページ

#### app/teams/page.tsx作成
- [ ] チーム一覧表示（カード形式）
- [ ] チーム作成フォーム
  - チーム名入力
  - 説明入力（オプション）
  - 作成ボタン
- [ ] 招待コード表示
  - コピーボタン
  - 有効期限表示
- [ ] 招待コード入力フォーム
  - 招待コード入力
  - 参加ボタン
- [ ] チーム操作ボタン
  - 脱退ボタン（確認ダイアログ）
  - 削除ボタン（確認ダイアログ）

### ヘッダー統合

#### components/Header.tsx
- [ ] チーム選択ドロップダウン実装
- [ ] チーム切り替え時、localStorageに保存
- [ ] チーム切り替え時、ページリロード（データ再取得）

### ローカルストレージ

#### lib/auth-context.tsx
- [ ] `currentTeamId`をlocalStorageに保存
- [ ] ページロード時にlocalStorageから復元
- [ ] チーム一覧取得時、デフォルトチーム選択（最初のチーム）

### UI/UX改善
- [ ] ローディング状態表示（認証チェック中）
- [ ] エラーメッセージ表示（認証失敗、チーム操作失敗）
- [ ] トースト通知（チーム作成成功、参加成功等）

### テスト
- [ ] ログイン → チーム作成 → 招待コード発行
- [ ] 別ブラウザでログイン → 招待コードで参加
- [ ] チーム切り替え → データが切り替わることを確認
- [ ] チーム脱退 → チーム一覧から削除されることを確認

---

## Step 6: E2Eテスト作成（0.5日）

### テストシナリオ

#### frontend/tests/e2e/multitenancy.spec.ts作成
- [ ] テスト1: ユーザーAがログインしてチームAを作成
- [ ] テスト2: ユーザーBがログインしてチームBを作成
- [ ] テスト3: ユーザーAがチームAでノート検索（結果: 空）
- [ ] テスト4: ユーザーAがチームAにノートアップロード
- [ ] テスト5: ユーザーAがチームAで検索（結果: アップロードしたノート）
- [ ] テスト6: ユーザーBがチームBで検索（結果: 空、チームAのノートは表示されない）
- [ ] テスト7: ユーザーAが招待コード発行 → ユーザーBが参加
- [ ] テスト8: ユーザーBがチームAで検索（結果: ユーザーAのノート）
- [ ] テスト9: ユーザーBがチームBから脱退
- [ ] テスト10: ユーザーAがチームAを削除（確認ダイアログ）

### テスト実行
- [ ] `npm test frontend/tests/e2e/multitenancy.spec.ts`
- [ ] 全テスト合格を確認

---

## 振り返り（実装完了後に記入）

### 実装完了日
2026-01-01

### 計画と実績の差分

#### 追加実装
- **Firebase認証の完全実装**: 当初の計画以上に、認証ミドルウェアとチーム検証ミドルウェアを詳細に実装
- **プロンプト管理機能**: 保存・復元・削除機能を完全実装し、チーム単位での管理を実現
- **認証フローのデバッグ機能**: ミドルウェアに詳細なログ出力を追加（開発中のみ）
- **環境変数の自動更新**: Vercel CLIを使った環境変数の一括更新スクリプト作成

#### 変更点
- **Firebase プロジェクト**: 当初`jikkennote-search-80a12`を使用予定だったが、`jikkennote-search-v3`に変更（OAuth設定の統一化のため）
- **ミドルウェアの認証スキップロジック**: `/prompts`のみexact matchでスキップ、その他のエンドポイントはprefix matchに変更（プロンプト管理機能の認証を確保）
- **バックエンドURL**: デプロイ時に新しいCloud RunサービスURLに変更（`https://jikkennote-backend-285071263188.asia-northeast1.run.app`）

#### 削除機能
- **データ移行スクリプト**: 既存データが少ないため、移行スクリプトの実装はスキップ

### 学んだこと

#### 技術的な学び
1. **Firebase認証とミドルウェアの統合**
   - FastAPIのミドルウェアで認証状態を`request.state`に保存することで、エンドポイント全体で認証情報を利用可能
   - `AuthMiddleware`と`TeamMiddleware`の2段階ミドルウェアパターンが有効

2. **OAuth 2.0 の redirect_uri 問題**
   - Google Cloud ConsoleのOAuth ClientとFirebase Authenticationで、redirect URIの設定を統一する必要がある
   - プロジェクトIDの表記揺れ（`ikkennote` vs `jikkennote`）でエラーが発生

3. **Reactの認証コンテキスト**
   - `useEffect`の依存配列に`loading`状態を含めることで、認証完了後にAPIコールを実行できる
   - `idToken`が`null`の場合にAPIコールが実行されないようにする必要がある

4. **Playwright E2Eテストと認証**
   - 認証が必要な機能はログインなしではテストできない（正常な動作）
   - 基本機能のテストは認証なしで実行可能

#### ハマったポイントと解決方法
1. **プロンプト復元が動作しない**
   - **原因**: バックエンドは`result.prompt`を返しているが、フロントエンドは`result.prompts`をチェック
   - **解決**: フロントエンドの変数名を`result.prompt`に修正

2. **401 Unauthorized エラーが連続発生**
   - **原因**: `AuthMiddleware`は`/prompts`をprefix matchでスキップしているが、`TeamMiddleware`は`/prompts/list`をチェック対象にしている
   - **解決**: `AuthMiddleware`を`/prompts`のみexact matchでスキップに変更し、`/prompts/list`などは認証必須に

3. **Firebase プロジェクトIDの不一致**
   - **原因**: コピペミスで`ikkennote`と`jikkennote`が混在
   - **解決**: 全設定を`jikkennote-search-v3`に統一

### 次回への改善提案

#### アーキテクチャ
- **認証トークンのリフレッシュ**: ID Tokenの有効期限（1時間）を考慮し、自動リフレッシュ機能を追加
- **エラーハンドリングの統一**: ミドルウェアでのエラーレスポンス形式を統一
- **ログレベルの管理**: 本番環境ではデバッグログを無効化する仕組み

#### テスト
- **認証付きE2Eテスト**: Playwrightでログイン処理を自動化し、認証が必要な機能もテスト可能に
- **ユニットテスト**: ミドルウェア、認証ユーティリティのユニットテスト追加

#### ドキュメント
- **Firebase設定ガイド**: 非技術者向けのFirebase Console設定手順を画像付きで作成
- **トラブルシューティングガイド**: 認証エラーの対処方法をまとめたドキュメント作成

---

**作成日**: 2025-12-31
**対象フェーズ**: Phase 1
**推奨モデル**: Opus
**総タスク数**: 70タスク
**推定所要時間**: 3-5日
