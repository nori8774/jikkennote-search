# Firebase セットアップガイド

このガイドに従って、Firebase Consoleでプロジェクトを作成し、必要な設定を行ってください。

## ステップ1: Firebaseプロジェクト作成

1. **Firebase Consoleにアクセス**
   https://console.firebase.google.com/

2. **新しいプロジェクトを作成**
   - 「プロジェクトを追加」をクリック
   - プロジェクト名: `jikkennote-search`
   - Google Analyticsは「無効」でOK
   - 「プロジェクトを作成」をクリック

3. **プロジェクトが作成されるまで待機**（約30秒）

---

## ステップ2: 認証設定

1. **左メニューから「Authentication」を選択**

2. **「始める」をクリック**

3. **Sign-in method タブを選択**

4. **Googleプロバイダーを有効化**
   - 「Google」をクリック
   - 「有効にする」トグルをON
   - プロジェクトのサポートメール: （自分のメールアドレスを選択）
   - 「保存」をクリック

---

## ステップ3: Firestore Database作成

1. **左メニューから「Firestore Database」を選択**

2. **「データベースの作成」をクリック**

3. **ロケーション選択**
   - ロケーション: `asia-northeast1（東京）`
   - 「次へ」をクリック

4. **セキュリティルール**
   - 「本番環境モード」を選択
   - 「作成」をクリック

5. **データベースが作成されるまで待機**（約1分）

---

## ステップ4: Firebase Admin SDK秘密鍵の取得

### 4-1: サービスアカウント作成

1. **左メニューの「プロジェクトの設定」（⚙️アイコン）をクリック**

2. **「サービス アカウント」タブを選択**

3. **「新しい秘密鍵の生成」をクリック**
   - 確認ダイアログが表示される
   - 「キーを生成」をクリック

4. **JSONファイルがダウンロードされる**
   - ファイル名: `jikkennote-search-xxxxx-firebase-adminsdk-xxxxx.json`
   - **このファイルを安全な場所に保管**

### 4-2: 秘密鍵をプロジェクトに配置

```bash
# ダウンロードしたJSONファイルを以下のパスに配置
cp ~/Downloads/jikkennote-search-*-firebase-adminsdk-*.json \
   /Users/nori8774/jikkennote-search_v1/backend/firebase-adminsdk.json
```

**重要**: このファイルは絶対にGitにコミットしないでください！

---

## ステップ5: Web アプリの設定（フロントエンド用）

1. **プロジェクトの設定に戻る**
   - 左メニューの「プロジェクトの設定」（⚙️アイコン）をクリック

2. **「全般」タブを選択**

3. **「アプリを追加」セクションまでスクロール**
   - 「</>」（Webアイコン）をクリック

4. **アプリ登録**
   - アプリのニックネーム: `jikkennote-frontend`
   - Firebase Hostingは「設定しない」でOK
   - 「アプリを登録」をクリック

5. **Firebase SDK設定をコピー**
   - 表示される設定コードをコピー
   - 以下の形式で表示されます：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "jikkennote-search.firebaseapp.com",
  projectId: "jikkennote-search",
  storageBucket: "jikkennote-search.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

6. **このconfigを `.env.local` に保存**
   - 後のステップで使用します

---

## ステップ6: セキュリティルールの設定（Firestore）

1. **Firestore Databaseに戻る**
   - 左メニューから「Firestore Database」を選択

2. **「ルール」タブを選択**

3. **以下のルールを設定**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // teams コレクション
    match /teams/{teamId} {
      // 認証済みユーザーは自分が所属するチームのみ読み取り可能
      allow read: if request.auth != null &&
                     exists(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid));

      // 認証済みユーザーは誰でもチーム作成可能
      allow create: if request.auth != null;

      // メンバーのみ更新・削除可能
      allow update, delete: if request.auth != null &&
                               exists(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid));

      // team_members サブコレクション
      match /members/{userId} {
        allow read: if request.auth != null &&
                       exists(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid));
        allow write: if request.auth != null;
      }
    }
  }
}
```

4. **「公開」をクリック**

---

## ステップ7: 確認事項チェックリスト

以下をすべて完了したことを確認してください：

- [v] Firebaseプロジェクト「jikkennote-search」が作成されている
- [v] Authentication > Sign-in method で「Google」が有効になっている
- [v] Firestore Databaseが作成されている（ロケーション: asia-northeast1）
- [v] Firebase Admin SDK秘密鍵（JSON）がダウンロードされている
- [v] 秘密鍵が `backend/firebase-adminsdk.json` に配置されている
- [v] Web アプリの設定で `firebaseConfig` が取得できている
- [v] Firestoreセキュリティルールが設定されている

---

## 次のステップ

すべて完了したら、実装を継続します。

**必要な情報**:
1. `backend/firebase-adminsdk.json` が配置されていること
2. `firebaseConfig` の内容（`.env.local`に設定します）

---

**作成日**: 2025-12-31
**所要時間**: 約10-15分
