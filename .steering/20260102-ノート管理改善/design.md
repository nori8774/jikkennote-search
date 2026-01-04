# 設計書: ノート管理改善（Phase 3）

## 概要

**機能名**: ノート管理改善
**作成日**: 2026-01-02
**設計者**: Claude

---

## アーキテクチャ

### コンポーネント構成

```
frontend/
├── components/
│   └── FileDropZone.tsx  # 新規作成: ドラッグ&ドロップコンポーネント
└── app/
    └── ingest/
        └── page.tsx      # 修正: FileDropZoneを統合
```

### データフロー

```
User: ファイルをドロップ
  ↓
FileDropZone: ドラッグイベント検知
  ↓
Validation: .mdファイルのみ許可
  ↓
API Call: POST /upload/notes (multipart/form-data)
  ↓
Backend: notes/newフォルダに保存
  ↓
Frontend: 成功通知 + 取り込み提案
```

---

## コンポーネント設計

### FileDropZone コンポーネント

```typescript
// components/FileDropZone.tsx
interface FileDropZoneProps {
  onFilesSelected: (files: FileList) => void;
  accept?: string;           // デフォルト: ".md"
  multiple?: boolean;        // デフォルト: true
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}
```

**状態管理**:
- `isDragging`: boolean - ドラッグ中かどうか
- `dragCounter`: number - ドラッグイベントの入れ子対応

**イベント**:
- `onDragEnter`: ドロップ領域に入った
- `onDragLeave`: ドロップ領域から出た
- `onDragOver`: ドロップ領域上でホバー中
- `onDrop`: ファイルがドロップされた

**バリデーション**:
- ファイル拡張子チェック（.mdのみ）
- エラー時はトースト通知

---

## UI設計

### ドロップゾーンの状態

1. **通常状態**:
   - 点線ボーダー
   - アイコン + "ファイルをドラッグ&ドロップ"テキスト
   - "またはクリックして選択"リンク

2. **ドラッグ中**:
   - 青色ハイライトボーダー
   - 背景色変更（青色薄め）
   - "ここにドロップ"テキスト

3. **アップロード中**:
   - スピナー表示
   - "アップロード中..."テキスト
   - 操作無効化

4. **エラー**:
   - 赤色ボーダー
   - エラーメッセージ表示

### レイアウト

```
┌─────────────────────────────────────────┐
│  📤 ファイルアップロード                │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │        📁                        │   │
│  │                                  │   │
│  │   ファイルをドラッグ&ドロップ    │   │
│  │   またはクリックして選択         │   │
│  │                                  │   │
│  │   Markdown (.md) のみ対応        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ✓ 複数ファイル同時アップロード対応     │
└─────────────────────────────────────────┘
```

---

## API設計

### 既存API（変更なし）

```
POST /upload/notes
Content-Type: multipart/form-data

Request:
  files: File[]  # 複数ファイル

Response:
{
  "success": boolean,
  "message": string,
  "uploaded_files": string[]
}
```

---

## 実装詳細

### FileDropZone.tsx

```typescript
'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';

interface FileDropZoneProps {
  onFilesSelected: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export default function FileDropZone({
  onFilesSelected,
  accept = '.md',
  multiple = true,
  disabled = false,
  loading = false,
  className = '',
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const validateFiles = (files: FileList): boolean => {
    const acceptedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());

    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedExtensions.includes(ext)) {
        setError(`無効なファイル形式: ${file.name}。${accept}のみアップロード可能です。`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (disabled || loading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (validateFiles(files)) {
        onFilesSelected(files);
      }
    }
  };

  const handleClick = () => {
    if (!disabled && !loading) {
      inputRef.current?.click();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (validateFiles(files)) {
        onFilesSelected(files);
      }
    }
    // リセット（同じファイルを再選択できるように）
    e.target.value = '';
  };

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${error ? 'border-red-500' : ''}
        ${className}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled || loading}
        className="hidden"
      />

      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">アップロード中...</span>
        </div>
      ) : isDragging ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">📥</span>
          <span className="text-blue-600 font-medium">ここにドロップ</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">📁</span>
          <span className="text-gray-700">ファイルをドラッグ&ドロップ</span>
          <span className="text-sm text-gray-500">またはクリックして選択</span>
          <span className="text-xs text-gray-400 mt-2">Markdown (.md) のみ対応</span>
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
```

---

## テスト計画

### 手動テスト
1. 単一ファイルのドラッグ&ドロップ
2. 複数ファイルの同時ドラッグ&ドロップ
3. 無効なファイル形式（.txt, .pdf等）の拒否
4. クリックによるファイル選択（フォールバック）
5. アップロード中の操作無効化

### E2Eテスト（将来）
- Playwright: ドラッグ&ドロップのシミュレーション
