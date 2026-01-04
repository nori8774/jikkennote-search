# 設計書: サフィックス名寄せ機能

## アーキテクチャ概要

```
[入力テキスト]
    ↓
[第1階層: バリアント正規化]
  - "HbA1c捕捉抗体A" → "HbA1c捕捉抗体A" (variants未登録の場合)
    ↓
[第2階層: サフィックス正規化]
  - ベース名 "HbA1c捕捉抗体" + サフィックス "A"
  - suffix_equivalents で "A" → "1" に変換
  - 結果: "HbA1c捕捉抗体1"
    ↓
[正規化済みテキスト]
```

## データ構造

### 辞書エントリ（拡張後）

```yaml
- canonical: HbA1c捕捉抗体
  variants:
    - HbA1c捕捉抗体1
    - HbA1c捕捉抗体2
    - HbA1c捕捉抗体A
    - HbA1c捕捉抗体B
  category: 抗体
  note: 捕捉抗体
  suffix_equivalents:      # 新規追加
    - ["1", "A"]           # グループ1: 1とAは同等（1が代表）
    - ["2", "B"]           # グループ2: 2とBは同等（2が代表）
    - ["3", "C"]           # グループ3: 3とCは同等（3が代表）
```

### suffix_equivalents の仕様

- 各グループはリスト形式: `["代表サフィックス", "別名1", "別名2", ...]`
- 先頭要素が「代表サフィックス」として正規化先となる
- サフィックスは文字列（数字、アルファベット、記号など）

## モジュール設計

### dictionary.py

```python
@dataclass
class NormalizationEntry:
    canonical: str
    variants: List[str]
    category: Optional[str] = None
    note: Optional[str] = None
    suffix_equivalents: Optional[List[List[str]]] = None  # 追加
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class DictionaryManager:
    # 新規メソッド
    def get_suffix_map(self, canonical: str) -> Dict[str, str]:
        """サフィックス→代表サフィックスのマップを生成"""

    def normalize_with_suffix(self, term: str) -> str:
        """サフィックスを含む正規化"""

    def add_suffix_equivalent(self, canonical: str, group: List[str]) -> bool:
        """サフィックス同等グループを追加"""

    def remove_suffix_equivalent(self, canonical: str, group_index: int) -> bool:
        """サフィックス同等グループを削除"""
```

### utils.py

```python
def normalize_text_with_suffix(
    text: str,
    replace_map: Dict[str, str],
    suffix_map: Dict[str, Dict[str, str]]  # {canonical: {suffix: normalized_suffix}}
) -> str:
    """サフィックス対応のテキスト正規化"""
```

## API変更

### GET /dictionary

レスポンスに `suffix_equivalents` を含める（既存フィールドに追加）。

### POST /dictionary/update

リクエストボディに `suffix_equivalents` を追加可能。

## フロントエンド変更

### 辞書管理ページ（frontend/app/dictionary/page.tsx）

- エントリ詳細モーダルに「サフィックス同等グループ」セクションを追加
- グループの追加・編集・削除UI

```
┌─────────────────────────────────────┐
│ HbA1c捕捉抗体                        │
├─────────────────────────────────────┤
│ バリアント:                          │
│   HbA1c捕捉抗体1, HbA1c捕捉抗体A, ... │
├─────────────────────────────────────┤
│ サフィックス同等グループ:             │
│   グループ1: 1 ↔ A    [編集] [削除]  │
│   グループ2: 2 ↔ B    [編集] [削除]  │
│   [+ グループ追加]                   │
└─────────────────────────────────────┘
```

## 正規化フロー詳細

### ステップ1: ベース名とサフィックスの分離

```python
def extract_base_and_suffix(term: str, known_canonicals: List[str]) -> Tuple[str, str]:
    """
    例: "HbA1c捕捉抗体A" → ("HbA1c捕捉抗体", "A")

    ロジック:
    1. 既知のcanonicalの中で、termの先頭に一致する最長のものを探す
    2. 一致した部分をベース名、残りをサフィックスとする
    """
```

### ステップ2: サフィックスの正規化

```python
def normalize_suffix(suffix: str, suffix_equivalents: List[List[str]]) -> str:
    """
    例: "A" → "1" (suffix_equivalents = [["1", "A"], ...])

    ロジック:
    1. suffix_equivalentsの各グループを走査
    2. グループ内にサフィックスがあれば、グループの先頭要素を返す
    3. 見つからなければ元のサフィックスを返す
    """
```

### ステップ3: 再結合

```python
normalized_term = base_name + normalized_suffix
# "HbA1c捕捉抗体" + "1" = "HbA1c捕捉抗体1"
```

## テスト計画

1. **単体テスト**
   - `extract_base_and_suffix` の動作確認
   - `normalize_suffix` の動作確認
   - `normalize_with_suffix` の統合テスト

2. **統合テスト**
   - 検索時のサフィックス正規化確認
   - 辞書UI操作の確認

## リスクと対策

| リスク | 対策 |
|--------|------|
| 既存辞書との互換性 | `suffix_equivalents` はOptionalとし、未定義時は従来動作 |
| パフォーマンス低下 | キャッシュ機構の導入（suffix_mapを事前計算） |
| 誤った名寄せ | UIで明示的に設定させる（自動推測しない） |
