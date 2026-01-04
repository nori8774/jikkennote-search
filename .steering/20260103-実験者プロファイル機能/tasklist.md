# タスクリスト: 実験者プロファイル機能

## タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: バックエンド - プロファイル管理モジュール

- [x] experimenter_profile.pyを新規作成
  - [x] ExperimenterProfileデータクラスを定義
  - [x] ExperimenterProfileManagerクラスを実装
    - [x] load(): YAMLからプロファイル読み込み
    - [x] save(): YAMLへプロファイル保存
    - [x] get_experimenter_id(): ノートIDから実験者ID抽出
    - [x] get_profile(): プロファイル取得
    - [x] create_profile(): プロファイル作成
    - [x] update_profile(): プロファイル更新
    - [x] delete_profile(): プロファイル削除
    - [x] set_id_pattern(): IDパターン設定

## フェーズ2: バックエンド - LLM学習機能

- [x] experimenter_profile.pyにLLM学習機能を追加
  - [x] learn_shortcuts_from_materials(): 材料セクションから省略形を学習
  - [x] プロンプト設計（①②③等と材料の対応を抽出）
  - [x] JSONパースとエラーハンドリング

- [x] expand_shortcuts(): 省略形展開機能
  - [x] テキスト内の省略形を材料名に置換
  - [x] 複数の記法に対応（①、(1)、1.等）

## フェーズ3: バックエンド - 取り込み処理統合

- [x] ingest.pyを更新
  - [x] ExperimenterProfileManagerの初期化
  - [x] ノートIDから実験者IDを抽出
  - [x] プロファイル存在確認と自動学習
  - [x] 方法セクションの省略形展開
  - [x] 展開済みテキストをmethods_collectionに格納

## フェーズ4: バックエンド - APIエンドポイント

- [x] server.pyにプロファイル管理エンドポイントを追加
  - [x] GET /experimenter-profiles: 一覧取得
  - [x] GET /experimenter-profiles/{id}: 詳細取得
  - [x] POST /experimenter-profiles: 作成
  - [x] PUT /experimenter-profiles/{id}: 更新
  - [x] DELETE /experimenter-profiles/{id}: 削除
  - [x] PUT /experimenter-profiles/id-pattern: パターン更新

## フェーズ5: フロントエンド - API連携

- [x] frontend/lib/api.tsを更新
  - [x] ExperimenterProfile型定義
  - [x] プロファイル一覧取得
  - [x] プロファイル作成・更新・削除

## フェーズ6: フロントエンド - 管理UI

- [x] frontend/app/settings/page.tsxに実験者プロファイルセクションを追加
  - [x] プロファイル一覧表示
  - [x] IDパターン編集
  - [x] プロファイル編集モーダル
  - [x] プロファイル削除

## フェーズ7: 品質チェック

- [x] バックエンドのエラーがないことを確認
- [x] フロントエンドの型エラーがないことを確認
- [x] フロントエンドのビルドが成功することを確認

---

## 実装後の振り返り

### 実装完了日
2026-01-03

### 計画と実績の差分
- 計画通りに全フェーズを実装完了
- **設計変更**: 省略形（①②③）はノートごとに異なるため、事前登録ではなく**動的解析**に変更
  - 材料セクションからLLMが自動で省略形を抽出
  - 同じノートの方法セクションで展開
- 実験者プロファイルは**サフィックス表記揺れ**（1/A/α等）の管理に特化

### 学んだこと
- 省略形（①②③）は**ノート単位**で意味が異なる → 事前登録ではなく動的解析が必要
- サフィックス（HbA1c捕捉抗体1 vs HbA1c捕捉抗体A）は**実験者ごとのクセ** → プロファイルで管理
- 2つの機能は目的が異なるため、別々のアプローチを取る必要があった
