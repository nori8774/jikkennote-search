"""
Ingest notes into vector database
実験ノートをベクトルデータベースに取り込む
増分更新対応（既存ノートはスキップ）
"""
import os
import re
import glob
import shutil
from typing import Dict, List, Tuple
from pathlib import Path

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

from config import config
from utils import load_master_dict, normalize_text


def parse_markdown_note(file_path: str, norm_map: dict) -> Dict:
    """マークダウンノートをパースして構造化データを返す"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    note_id = os.path.basename(file_path).replace('.md', '')

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
    post_action: str = 'keep',
    archive_folder: str = None,
    embedding_model: str = None
) -> Tuple[List[str], List[str]]:
    """
    ノートをデータベースに取り込む（増分更新）

    Args:
        api_key: OpenAI APIキー
        source_folder: 新規ノートフォルダパス
        post_action: 取り込み後のアクション ('delete', 'archive', 'keep')
        archive_folder: アーカイブ先フォルダパス
        embedding_model: 使用するEmbeddingモデル

    Returns:
        (new_notes, skipped_notes): 取り込んだノートIDと既存のノートID
    """
    # パラメータのデフォルト値設定
    source_folder = source_folder or config.NOTES_NEW_FOLDER
    archive_folder = archive_folder or config.NOTES_ARCHIVE_FOLDER
    embedding_model = embedding_model or config.DEFAULT_EMBEDDING_MODEL

    # フォルダ確認
    if not os.path.exists(source_folder):
        raise FileNotFoundError(f"Source folder not found: {source_folder}")

    # 正規化辞書のロード
    norm_map, _ = load_master_dict()
    print(f"正規化辞書ロード: {len(norm_map)} エントリ")

    # ChromaDBの初期化
    embeddings = OpenAIEmbeddings(model=embedding_model, api_key=api_key)
    vectorstore = Chroma(
        collection_name="experiment_notes",
        embedding_function=embeddings,
        persist_directory=config.CHROMA_DB_FOLDER
    )

    # 既存データの確認（増分更新のため）
    existing_ids = get_existing_ids(vectorstore)
    print(f"既存の登録ノート数: {len(existing_ids)}")

    # ファイルスキャンと新規判定
    files = glob.glob(os.path.join(source_folder, "*.md"))
    new_docs = []
    skipped_ids = []
    new_ids = []

    for file in files:
        note_id = os.path.basename(file).replace('.md', '')

        # 既にDBにあるIDならスキップ
        if note_id in existing_ids:
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

    # DBへの追加登録
    if new_docs:
        print(f"{len(new_docs)} 件の新規ノートをデータベースに追加しています...")
        vectorstore.add_documents(documents=new_docs)
        print("登録完了。")

        # ファイル処理（post_action に応じて）
        for note_id in new_ids:
            file_path = os.path.join(source_folder, f"{note_id}.md")

            if post_action == 'delete':
                os.remove(file_path)
                print(f"  Deleted: {file_path}")

            elif post_action == 'archive':
                # アーカイブフォルダ作成
                Path(archive_folder).mkdir(parents=True, exist_ok=True)
                dest_path = os.path.join(archive_folder, f"{note_id}.md")
                shutil.move(file_path, dest_path)
                print(f"  Archived: {file_path} -> {dest_path}")

            elif post_action == 'keep':
                print(f"  Kept: {file_path}")

    else:
        print("新規に追加すべきノートはありませんでした。")

    return new_ids, skipped_ids
