# 設計書: UI/UX機能改善（Phase 4）

## 概要

**機能名**: UI/UX機能改善
**作成日**: 2026-01-02
**設計者**: Claude

---

## アーキテクチャ

### コンポーネント構成

```
frontend/
├── app/
│   ├── search/
│   │   └── page.tsx      # 修正: 再検索モーダル、コピー反映機能追加
│   ├── viewer/
│   │   └── page.tsx      # 修正: 検索条件コピーボタン追加
│   └── evaluate/
│       └── page.tsx      # 修正: CSV出力強化、履歴拡張
└── lib/
    └── storage.ts        # 修正: 評価履歴50件対応
```

---

## FR-113: 再検索機能

### UI設計

#### 検索結果画面

```
┌─────────────────────────────────────────────────────────┐
│  検索結果 (3件)                                          │
│                                                          │
│  [重点指示を追加して再検索]  ← 新規ボタン                │
│                                                          │
│  ┌─────────────────────────────────────────┐            │
│  │ ノート1: XXX実験...                      │            │
│  └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

#### 再検索モーダル

```
┌───────────────────────────────────────────┐
│  重点指示を追加して再検索                  │
├───────────────────────────────────────────┤
│                                            │
│  現在の検索条件:                           │
│  目的: [表示]                              │
│  材料: [表示]                              │
│  方法: [表示]                              │
│                                            │
│  重点指示:                                 │
│  ┌─────────────────────────────────────┐ │
│  │ [テキストエリア]                      │ │
│  └─────────────────────────────────────┘ │
│                                            │
│  [キャンセル]  [再検索]                    │
└───────────────────────────────────────────┘
```

### 状態管理

```typescript
// search/page.tsx
const [showResearchModal, setShowResearchModal] = useState(false);
const [researchEmphasis, setResearchEmphasis] = useState('');

// 再検索実行
const handleResearch = () => {
  setEmphasis(researchEmphasis);  // 重点指示を更新
  handleSearch();                  // 検索実行（既存関数）
  setShowResearchModal(false);
};
```

---

## FR-114: コピー機能強化

### UI設計

#### ビューワー画面

```
┌─────────────────────────────────────────────────────────┐
│  ## 目的                          [検索条件にコピー]    │
│  ○○の合成を行い、収率を向上させる                      │
├─────────────────────────────────────────────────────────┤
│  ## 材料                          [検索条件にコピー]    │
│  - エタノール 100mL                                     │
│  - 酢酸ナトリウム 5g                                    │
├─────────────────────────────────────────────────────────┤
│  ## 方法                          [検索条件にコピー]    │
│  1. 室温で30分間攪拌...                                 │
├─────────────────────────────────────────────────────────┤
│                     [一括コピー]                        │
└─────────────────────────────────────────────────────────┘
```

#### 検索画面のノートカード

```
┌─────────────────────────────────────────────────────────┐
│  ノート: XXX実験_20251201                               │
│  ─────────────────────────────────────────              │
│  目的: ○○の合成...                                      │
│  類似度: 0.92                                           │
│                                                          │
│  [目的] [材料] [方法] [一括]  ← 新規ボタン群             │
└─────────────────────────────────────────────────────────┘
```

### データフロー

```
ビューワー:
User clicks "検索条件にコピー"
  ↓
Router.push('/search?purpose=XXX&materials=YYY')
  ↓
Search page: URLパラメータから初期値設定

検索画面:
User clicks [目的] button
  ↓
setPurpose(note.purpose)  ← 即座にフォーム更新
  ↓
Visual feedback (ハイライト)
```

### 実装詳細

```typescript
// viewer/page.tsx
const copyToSearch = (field: 'purpose' | 'materials' | 'methods' | 'all') => {
  const params = new URLSearchParams();

  if (field === 'all' || field === 'purpose') {
    params.set('purpose', extractSection('目的'));
  }
  if (field === 'all' || field === 'materials') {
    params.set('materials', extractSection('材料'));
  }
  if (field === 'all' || field === 'methods') {
    params.set('methods', extractSection('方法'));
  }

  router.push(`/search?${params.toString()}`);
};

// search/page.tsx
// URLパラメータ処理
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('purpose')) setPurpose(searchParams.get('purpose')!);
  if (searchParams.get('materials')) setMaterials(searchParams.get('materials')!);
  if (searchParams.get('methods')) setMethods(searchParams.get('methods')!);
}, []);

// ノートカードからのコピー
const copyFromNote = (note: any, field: 'purpose' | 'materials' | 'methods' | 'all') => {
  if (field === 'all' || field === 'purpose') {
    setPurpose(note.purpose || '');
  }
  if (field === 'all' || field === 'materials') {
    setMaterials(note.materials || '');
  }
  if (field === 'all' || field === 'methods') {
    setMethods(note.methods || '');
  }
};
```

---

## FR-115: 評価機能改善

### CSV出力形式

```csv
条件ID,Embeddingモデル,LLMモデル,プロンプト名,nDCG@5,nDCG@10,Precision@5,Precision@10,Recall@10,MRR,実行日時
1,text-embedding-3-small,gpt-4o-mini,default,0.85,0.82,0.80,0.75,0.90,0.88,2026-01-02T10:30:00
```

### 実装詳細

```typescript
// evaluate/page.tsx

// CSV出力関数
const exportToCSV = () => {
  const headers = [
    '条件ID', 'Embeddingモデル', 'LLMモデル', 'プロンプト名',
    'nDCG@5', 'nDCG@10', 'Precision@5', 'Precision@10', 'Recall@10', 'MRR',
    '実行日時'
  ];

  const rows = evaluationHistory.map((result, index) => [
    index + 1,
    result.embeddingModel,
    result.llmModel,
    result.promptName || 'default',
    result.ndcg5?.toFixed(4) || '',
    result.ndcg10?.toFixed(4) || '',
    result.precision5?.toFixed(4) || '',
    result.precision10?.toFixed(4) || '',
    result.recall10?.toFixed(4) || '',
    result.mrr?.toFixed(4) || '',
    result.timestamp
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `evaluation_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
};
```

### 履歴拡張

```typescript
// lib/storage.ts

// 変更前
const MAX_EVALUATION_HISTORY = 5;

// 変更後
const MAX_EVALUATION_HISTORY = 50;
```

---

## テスト計画

### 手動テスト項目

**FR-113: 再検索機能**
1. 検索実行後、「重点指示を追加して再検索」ボタンが表示される
2. ボタンクリックでモーダルが開く
3. 重点指示入力後、再検索が実行される
4. 目的・材料・方法は維持される

**FR-114: コピー機能強化**
1. ビューワーで「検索条件にコピー」クリック → 検索ページに遷移
2. 検索フォームに該当セクションが反映される
3. 「一括コピー」で全セクションが反映される
4. 検索結果の[目的]ボタンで左側フォームに反映

**FR-115: 評価機能改善**
1. 評価実行後、CSV出力ボタンが機能する
2. CSVに全カラムが含まれる
3. 評価履歴が50件まで保存される

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| frontend/app/search/page.tsx | 再検索モーダル、コピー反映、URLパラメータ処理 |
| frontend/app/viewer/page.tsx | 検索条件コピーボタン |
| frontend/app/evaluate/page.tsx | CSV出力、デバッグ削除、履歴拡張 |
| frontend/lib/storage.ts | 評価履歴上限変更 |
