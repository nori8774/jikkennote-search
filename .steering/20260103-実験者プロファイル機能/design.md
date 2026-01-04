# 設計書: 実験者プロファイル機能

## アーキテクチャ概要

```
ノート取り込みフロー:

[ノートファイル]
    ↓
[ノートIDから実験者ID抽出]
  例: "ID2-5" → 実験者ID "2"
    ↓
[プロファイル存在確認]
    ├─ 存在しない → [LLMで材料セクション解析] → [プロファイル作成]
    │                    ↓
    │              [ユーザー確認（オプション）]
    │                    ↓
    └─ 存在する ───→ [プロファイル読み込み]
                          ↓
                   [方法セクションの省略形展開]
                          ↓
                   [展開済みテキストをmethods_collectionに格納]
```

## データ構造

### プロファイルファイル

```yaml
# backend/teams/{team_id}/experimenter_profiles.yaml

# ノートIDから実験者IDを抽出するパターン
# キャプチャグループ1が実験者IDになる
id_pattern: "^ID(\\d+)-"

# 実験者ごとの設定
experimenters:
  "1":
    name: "実験者1（任意の表示名）"

    # サフィックス同等グループ（辞書のsuffix_equivalentsと連携）
    suffix_conventions:
      - ["1", "A"]   # この実験者の"1"は、実験者2の"A"と同等
      - ["2", "B"]
      - ["3", "C"]

    # 省略形 → 材料名の対応
    material_shortcuts:
      "①": "HbA1c捕捉抗体1（マウスモノクローナル，全長IgG）: 1mL"
      "②": "HbA1c検出抗体1（ウサギポリクローナル，Fab）: 0.5mL"
      "③": "発色基質TMB: 2mL"
      "(1)": "..."  # 括弧形式にも対応

    # メタデータ
    learned_from: "ID1-1"  # 学習元ノート
    created_at: "2026-01-03T10:00:00"
    updated_at: "2026-01-03T10:00:00"

  "2":
    name: "実験者2"
    suffix_conventions:
      - ["A", "1"]   # 逆方向（実験者2視点）
      - ["B", "2"]
    material_shortcuts:
      "①": "HbA1c捕捉抗体A: 1mL"
      "②": "HbA1c検出抗体A: 0.5mL"
    learned_from: "ID2-1"
    created_at: "2026-01-03T11:00:00"
    updated_at: "2026-01-03T11:00:00"
```

## モジュール設計

### experimenter_profile.py（新規作成）

```python
@dataclass
class ExperimenterProfile:
    experimenter_id: str
    name: str
    suffix_conventions: List[List[str]]
    material_shortcuts: Dict[str, str]
    learned_from: Optional[str]
    created_at: str
    updated_at: str

class ExperimenterProfileManager:
    def __init__(self, team_id: str):
        self.team_id = team_id
        self.profile_path = f"teams/{team_id}/experimenter_profiles.yaml"
        self.id_pattern = None
        self.experimenters = {}
        self.load()

    def load(self) -> None:
        """プロファイルをYAMLから読み込む"""

    def save(self) -> bool:
        """プロファイルをYAMLに保存"""

    def get_experimenter_id(self, note_id: str) -> Optional[str]:
        """ノートIDから実験者IDを抽出"""

    def get_profile(self, experimenter_id: str) -> Optional[ExperimenterProfile]:
        """実験者プロファイルを取得"""

    def create_profile(self, experimenter_id: str, name: str,
                       material_shortcuts: Dict[str, str],
                       learned_from: str) -> bool:
        """新規プロファイルを作成"""

    def update_profile(self, experimenter_id: str, **kwargs) -> bool:
        """プロファイルを更新"""

    def delete_profile(self, experimenter_id: str) -> bool:
        """プロファイルを削除"""

    def learn_shortcuts_from_materials(self, materials_text: str,
                                        llm, experimenter_id: str) -> Dict[str, str]:
        """LLMを使って材料セクションから省略形を学習"""

    def expand_shortcuts(self, text: str, experimenter_id: str) -> str:
        """テキスト内の省略形を展開"""
```

### ingest.py の更新

```python
def ingest_notes(...):
    profile_manager = ExperimenterProfileManager(team_id)

    for note in notes:
        # 実験者IDを抽出
        experimenter_id = profile_manager.get_experimenter_id(note.id)

        if experimenter_id:
            profile = profile_manager.get_profile(experimenter_id)

            if not profile:
                # 新しい実験者: LLMで学習
                materials_text = extract_sections(note.content)["materials"]
                shortcuts = profile_manager.learn_shortcuts_from_materials(
                    materials_text, llm, experimenter_id
                )
                profile_manager.create_profile(
                    experimenter_id=experimenter_id,
                    name=f"実験者{experimenter_id}",
                    material_shortcuts=shortcuts,
                    learned_from=note.id
                )

            # 方法セクションの省略形を展開
            methods_text = extract_sections(note.content)["methods"]
            expanded_methods = profile_manager.expand_shortcuts(methods_text, experimenter_id)

            # 展開済みテキストをmethods_collectionに格納
            ...
```

## LLMプロンプト設計

### 省略形学習プロンプト

```
あなたは実験ノートの解析専門家です。
以下の材料リストを読み、番号や記号（①②③、(1)(2)(3)、1.2.3.など）と
それが指す材料名・容量の対応を抽出してください。

# 材料リスト
{materials_text}

# 出力形式（JSON）
{
  "shortcuts": {
    "①": "材料名: 容量",
    "②": "材料名: 容量",
    ...
  }
}

番号や記号がない場合は空のオブジェクトを返してください。
```

## API設計

### エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /experimenter-profiles | プロファイル一覧取得 |
| GET | /experimenter-profiles/{id} | プロファイル詳細取得 |
| POST | /experimenter-profiles | プロファイル作成 |
| PUT | /experimenter-profiles/{id} | プロファイル更新 |
| DELETE | /experimenter-profiles/{id} | プロファイル削除 |
| PUT | /experimenter-profiles/id-pattern | IDパターン更新 |

## UI設計

### プロファイル管理画面（設定ページに追加）

```
┌─────────────────────────────────────────────────┐
│ 実験者プロファイル                                │
├─────────────────────────────────────────────────┤
│ IDパターン: ^ID(\d+)-     [編集]                 │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 実験者1 (ID1-x系)              [編集][削除] │ │
│ │ 学習元: ID1-1                               │ │
│ │ サフィックス: 1↔A, 2↔B, 3↔C               │ │
│ │ 省略形: ① → HbA1c捕捉抗体1: 1mL            │ │
│ │         ② → HbA1c検出抗体1: 0.5mL          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 実験者2 (ID2-x系)              [編集][削除] │ │
│ │ 学習元: ID2-1                               │ │
│ │ サフィックス: A↔1, B↔2, C↔3               │ │
│ │ 省略形: ① → HbA1c捕捉抗体A: 1mL            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [+ 手動でプロファイル追加]                       │
└─────────────────────────────────────────────────┘
```

## 辞書機能との連携

実験者プロファイルのsuffix_conventionsは、正規化辞書のsuffix_equivalentsと連携：

1. プロファイル作成時に、対応するsuffix_equivalentsを辞書に自動追加
2. または、UIで明示的にリンクを設定

## テスト計画

1. **IDパターンのテスト**
   - 様々なノートID形式での実験者ID抽出

2. **省略形学習のテスト**
   - 様々な記法（①、(1)、1.、A.）での学習

3. **展開のテスト**
   - 「①を添加」→「HbA1c捕捉抗体1: 1mLを添加」

4. **プロファイル再利用のテスト**
   - 同じ実験者の2つ目のノートで学習済みプロファイルが使われること
