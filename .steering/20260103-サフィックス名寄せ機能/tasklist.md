# タスクリスト: サフィックス名寄せ機能

## タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: バックエンド - データ構造拡張

- [x] dictionary.pyのNormalizationEntryを拡張
  - [x] suffix_equivalentsフィールドを追加（Optional[List[List[str]]]）
  - [x] to_dict()メソッドを更新
  - [x] load()メソッドでsuffix_equivalentsを読み込む

- [x] dictionary.pyにサフィックス関連メソッドを追加
  - [x] get_suffix_map(canonical: str) -> Dict[str, str]
  - [x] normalize_with_suffix(term: str) -> str
  - [x] add_suffix_equivalent(canonical: str, group: List[str]) -> bool
  - [x] remove_suffix_equivalent(canonical: str, group_index: int) -> bool
  - [x] update_suffix_equivalent(canonical: str, group_index: int, group: List[str]) -> bool

## フェーズ2: バックエンド - 正規化ロジック

- [x] utils.pyにサフィックス対応正規化を追加
  - [x] normalize_text_with_suffix()を実装（extract_base_and_suffixはDictionaryManagerに実装）

- [x] agent.pyの正規化ノードを更新
  - [x] サフィックス正規化を適用（検索クエリ生成時）
  - [x] DictionaryManagerからsuffix_mapsを取得

## フェーズ3: バックエンド - API更新

- [x] server.pyの辞書関連エンドポイントを更新
  - [x] GET /dictionary: suffix_equivalentsを含めて返す（既存実装で対応）
  - [x] PUT /dictionary/entry: suffix_equivalentsの更新に対応
  - [x] POST /dictionary/suffix-equivalent: サフィックス同等グループの追加
  - [x] PUT /dictionary/suffix-equivalent: サフィックス同等グループの更新
  - [x] DELETE /dictionary/suffix-equivalent: サフィックス同等グループの削除

## フェーズ4: フロントエンド - 辞書管理UI

- [x] frontend/app/dictionary/page.tsxを更新
  - [x] エントリ一覧にサフィックス同等グループセクションを追加
  - [x] グループの表示（["1", "A"] → "1 ↔ A"）
  - [x] 編集モーダルでグループ追加機能
  - [x] 編集モーダルでグループ編集機能
  - [x] 編集モーダルでグループ削除機能

- [x] frontend/lib/api.tsを更新
  - [x] DictionaryEntryにsuffix_equivalentsの型定義を追加

## フェーズ5: 品質チェック

- [x] バックエンドのエラーがないことを確認（Python構文チェック）
- [x] フロントエンドの型エラーがないことを確認
- [x] フロントエンドのビルドが成功することを確認

---

## 実装後の振り返り

### 実装完了日
2026-01-03

### 計画と実績の差分

**計画と異なった点**:
- `extract_base_and_suffix`と`normalize_suffix`はDictionaryManagerのメソッドとして実装（utils.pyではなく）
- PUT /dictionary/suffix-equivalentエンドポイントを追加（計画になかった更新用エンドポイント）

**新たに必要になったタスク**:
- dictionary.pyの`update_entry`メソッドにsuffix_equivalentsパラメータを追加
- server.pyにSuffixEquivalent系のリクエストモデル3種を追加

### 学んだこと

**技術的な学び**:
- 辞書のネストしたデータ構造（List[List[str]]）のYAML/JSON対応
- フロントエンドでの配列の配列の状態管理
- 長い順にソートして最長一致を行うパターン（サフィックス抽出）

**プロセス上の改善点**:
- 既存のエントリ編集フローにうまく統合できた
- API設計は既存パターンに合わせると実装がスムーズ
