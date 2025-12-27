"""
Ingest notes into vector database
実験ノートをベクトルデータベースに取り込む
増分更新対応（既存ノートはスキップ）
"""
import os
import re
from typing import Dict, List, Tuple
from pathlib import Path

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

from config import config
from utils import load_master_dict, normalize_text
from storage import storage
from chroma_sync import get_chroma_vectorstore, sync_chroma_to_gcs


def parse_markdown_note(file_path: str, norm_map: dict) -> Dict:
    """マークダウンノートをパースして構造化データを返す"""
    content = storage.read_file(file_path)

    # パスから最後の部分を取得してノートIDに
    note_id = file_path.split('/')[-1].replace('.md', '')

    # 材料セクションから検索用キーワードを抽出して正規化
    materials_match = re.search(r'## 材料\n(.*?)\n##', content, re.DOTALL)
    materials_text = materials_match.group(1).strip() if materials_match else ""

    normalized_keywords = []
    if materials_text:
        lines = materials_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 簡易パース
            clean_line = re.sub(r'^[-・*]*\s*', '', line)
            parts = re.split(r'[:：]', clean_line, 1)
            raw_term = parts[0].strip()

            # 正規化
            norm_term = normalize_text(raw_term, norm_map)
            if norm_term:
                normalized_keywords.append(norm_term)

    return {
        "id": note_id,
        "full_content": content,
        "search_keywords": list(set(normalized_keywords))  # 重複排除
    }


def get_existing_ids(vectorstore) -> List[str]:
    """ChromaDBに既に登録されているドキュメントのソースID一覧を取得"""
    try:
        data = vectorstore.get()
        existing_ids = []
        if data and data['metadatas']:
            for meta in data['metadatas']:
                if meta and 'source' in meta:
                    existing_ids.append(meta['source'])
        return list(set(existing_ids))
    except Exception:
        return []


def ingest_notes(
    api_key: str,
    source_folder: str = None,
    post_action: str = 'move_to_processed',
    archive_folder: str = None,
    embedding_model: str = None,
    rebuild_mode: bool = False
) -> Tuple[List[str], List[str]]:
    """
    ノートをデータベースに取り込む（増分更新）

    Args:
        api_key: OpenAI APIキー
        source_folder: 新規ノートフォルダパス（デフォルト: notes/new）
        post_action: 取り込み後のアクション ('move_to_processed', 'delete', 'archive', 'keep')
        archive_folder: アーカイブ先フォルダパス（後方互換性のため残す）
        embedding_model: 使用するEmbeddingモデル
        rebuild_mode: ChromaDBリセット後の再構築モード（デフォルト: False）

    Returns:
        (new_notes, skipped_notes): 取り込んだノートIDと既存のノートID
    """
    # パラメータのデフォルト値設定
    if rebuild_mode:
        # 再構築モード：notes/processedから全て読み込む
        source_folder = source_folder or config.NOTES_PROCESSED_FOLDER
        post_action = 'keep'  # 再構築時はファイルを移動しない
    else:
        # 通常モード：notes/newから読み込む
        source_folder = source_folder or config.NOTES_NEW_FOLDER
        post_action = post_action or 'move_to_processed'

    archive_folder = archive_folder or config.NOTES_ARCHIVE_FOLDER
    processed_folder = config.NOTES_PROCESSED_FOLDER
    embedding_model = embedding_model or config.DEFAULT_EMBEDDING_MODEL

    # フォルダ確認（ストレージ抽象化に対応）
    storage.mkdir(source_folder)

    # 正規化辞書のロード
    norm_map, _ = load_master_dict()
    print(f"正規化辞書ロード: {len(norm_map)} エントリ")

    # ChromaDBの初期化（GCS同期付き）
    embeddings = OpenAIEmbeddings(model=embedding_model, api_key=api_key)
    vectorstore = get_chroma_vectorstore(embeddings, embedding_model=embedding_model)

    # 既存データの確認（増分更新のため）
    if rebuild_mode:
        # 再構築モード：既存IDのチェックをスキップ（全て取り込む）
        existing_ids = []
        print("再構築モード: 全てのノートを取り込みます")
    else:
        existing_ids = get_existing_ids(vectorstore)
        print(f"既存の登録ノート数: {len(existing_ids)}")

    # ファイルスキャンと新規判定
    files = storage.list_files(prefix=source_folder, pattern="*.md")
    new_docs = []
    skipped_ids = []
    new_ids = []

    for file in files:
        note_id = file.split('/')[-1].replace('.md', '')

        # 既にDBにあるIDならスキップ（再構築モードではスキップしない）
        if not rebuild_mode and note_id in existing_ids:
            print(f"Skip: {note_id} (既に存在します)")
            skipped_ids.append(note_id)
            continue

        # 新規ファイルのパース
        data = parse_markdown_note(file, norm_map)

        metadata = {
            "source": data["id"],
            "materials": ", ".join(data["search_keywords"])
        }

        print(f"Processing New File: {data['id']} -> Keywords: {metadata['materials']}")

        new_docs.append(Document(page_content=data["full_content"], metadata=metadata))
        new_ids.append(note_id)

    # DBへの追加登録（バッチ処理）
    if new_docs:
        print(f"{len(new_docs)} 件の新規ノートをデータベースに追加しています...")

        # バッチサイズ（トークン制限を考慮して50件ずつ処理）
        BATCH_SIZE = 50
        total_batches = (len(new_docs) + BATCH_SIZE - 1) // BATCH_SIZE

        for i in range(0, len(new_docs), BATCH_SIZE):
            batch = new_docs[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            print(f"  バッチ {batch_num}/{total_batches}: {len(batch)}件を処理中...")

            try:
                vectorstore.add_documents(documents=batch)
                print(f"  バッチ {batch_num}/{total_batches}: 完了")
            except Exception as e:
                print(f"  バッチ {batch_num}/{total_batches}: エラー - {str(e)}")
                # エラーが出てもそのバッチをスキップして続行
                continue

        print("登録完了。")

        # GCSに同期（本番環境のみ）
        sync_chroma_to_gcs()

        # ファイル処理（post_action に応じて）
        for note_id in new_ids:
            file_path = f"{source_folder}/{note_id}.md"

            if post_action == 'move_to_processed':
                # processedフォルダに移動（デフォルト動作）
                storage.mkdir(processed_folder)
                dest_path = f"{processed_folder}/{note_id}.md"
                storage.move_file(file_path, dest_path)
                print(f"  Moved to processed: {file_path} -> {dest_path}")

            elif post_action == 'delete':
                storage.delete_file(file_path)
                print(f"  Deleted: {file_path}")

            elif post_action == 'archive':
                # アーカイブフォルダ作成（後方互換性のため残す）
                storage.mkdir(archive_folder)
                dest_path = f"{archive_folder}/{note_id}.md"
                storage.move_file(file_path, dest_path)
                print(f"  Archived: {file_path} -> {dest_path}")

            elif post_action == 'keep':
                print(f"  Kept: {file_path}")

    else:
        print("新規に追加すべきノートはありませんでした。")

    return new_ids, skipped_ids
