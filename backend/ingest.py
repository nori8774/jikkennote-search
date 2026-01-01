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
from chroma_sync import get_chroma_vectorstore, get_team_chroma_vectorstore, sync_chroma_to_gcs
from term_extractor import TermExtractor
from dictionary import get_dictionary_manager


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
    rebuild_mode: bool = False,
    team_id: str = None  # v3.0: マルチテナント対応
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
        team_id: チームID（v3.0）

    Returns:
        (new_notes, skipped_notes): 取り込んだノートIDと既存のノートID
    """
    # パラメータのデフォルト値設定（v3.0: チーム対応）
    if team_id:
        # マルチテナントモード: チーム専用パスを使用
        if rebuild_mode:
            source_folder = source_folder or storage.get_team_path(team_id, 'notes_processed')
            post_action = 'keep'
        else:
            source_folder = source_folder or storage.get_team_path(team_id, 'notes_new')
            post_action = post_action or 'move_to_processed'

        archive_folder = archive_folder or f"{storage.get_team_path(team_id, 'notes_new')}/archive"
        processed_folder = storage.get_team_path(team_id, 'notes_processed')
    else:
        # 後方互換性: グローバルパスを使用
        if rebuild_mode:
            source_folder = source_folder or config.NOTES_PROCESSED_FOLDER
            post_action = 'keep'
        else:
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

    # ChromaDBの初期化（v3.0: チーム対応）
    embeddings = OpenAIEmbeddings(model=embedding_model, api_key=api_key)
    if team_id:
        vectorstore = get_team_chroma_vectorstore(
            team_id=team_id,
            embeddings=embeddings,
            embedding_model=embedding_model
        )
    else:
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


def ingest_notes_with_auto_dictionary(
    api_key: str,
    source_folder: str = None,
    post_action: str = 'move_to_processed',
    archive_folder: str = None,
    embedding_model: str = None,
    rebuild_mode: bool = False,
    auto_update_dictionary: bool = True
) -> Tuple[List[str], List[str], Dict]:
    """
    ノートを取り込み、自動的に辞書を更新する（拡張版）

    Args:
        api_key: OpenAI APIキー
        source_folder: 新規ノートフォルダパス
        post_action: 取り込み後のアクション
        archive_folder: アーカイブ先フォルダパス
        embedding_model: Embeddingモデル
        rebuild_mode: 再構築モード
        auto_update_dictionary: 辞書の自動更新を有効にするか

    Returns:
        (new_notes, skipped_notes, dictionary_update_result)
    """
    # 通常のingestを実行
    new_ids, skipped_ids = ingest_notes(
        api_key=api_key,
        source_folder=source_folder,
        post_action=post_action,
        archive_folder=archive_folder,
        embedding_model=embedding_model,
        rebuild_mode=rebuild_mode
    )

    dictionary_result = {
        'patterns_added': 0,
        'variants_detected': 0,
        'auto_updated': False
    }

    # 辞書自動更新が有効で、新規ノートがある場合
    if auto_update_dictionary and new_ids:
        print("\n=== 新出単語抽出と辞書自動更新を開始 ===")

        try:
            # 辞書マネージャーとTerm Extractorを初期化
            dict_manager = get_dictionary_manager()
            term_extractor = TermExtractor(dict_manager, api_key)

            # 全ての新出パターンを収集
            all_patterns = set()
            all_new_notes_content = []

            # 各新規ノートを分析
            processed_folder = config.NOTES_PROCESSED_FOLDER if post_action == 'move_to_processed' else source_folder

            for note_id in new_ids:
                # ノートのパスを決定
                if post_action == 'move_to_processed':
                    note_path = f"{processed_folder}/{note_id}.md"
                else:
                    note_path = f"{source_folder}/{note_id}.md"

                if not storage.exists(note_path):
                    print(f"警告: ノートが見つかりません: {note_path}")
                    continue

                # ノート内容を読み込み
                note_content = storage.read_file(note_path)
                all_new_notes_content.append({'id': note_id, 'content': note_content})

                # 材料セクションを抽出
                materials_section = term_extractor.extract_materials_section(note_content)
                if materials_section:
                    # 用語を抽出（複数パターン生成）
                    patterns = term_extractor.extract_terms_from_text(materials_section)
                    all_patterns.update(patterns)
                    print(f"  {note_id}: {len(patterns)}個のパターンを抽出")

            # パターンを辞書に追加
            if all_patterns:
                result = dict_manager.auto_update_from_patterns(list(all_patterns))
                dictionary_result['patterns_added'] = result['added']
                print(f"\n新規パターンを辞書に追加: {result['added']}個")

                # 表記揺れを自動検出
                print("\n表記揺れを検出中...")
                all_terms = list(all_patterns)
                variant_candidates = term_extractor.auto_detect_variants(
                    all_terms,
                    threshold=0.7
                )

                if variant_candidates:
                    print(f"表記揺れ候補を{len(variant_candidates)}個検出しました")
                    dictionary_result['variants_detected'] = len(variant_candidates)
                    dictionary_result['variant_candidates'] = variant_candidates

                    # 自動承認された表記揺れを辞書に反映（LLMが"variant"と判定したもの）
                    auto_approved = [
                        {
                            'term': cand['term2'],
                            'decision': 'variant',
                            'canonical': cand['recommended_canonical'] or cand['term1'],
                            'note': f"自動検出 (類似度: {cand['combined_similarity']:.2f})"
                        }
                        for cand in variant_candidates
                        if cand['llm_suggestion'] == 'variant'
                    ]

                    if auto_approved:
                        update_result = dict_manager.apply_variant_updates(auto_approved)
                        print(f"表記揺れを自動反映: {update_result['updated']}個更新")
                        dictionary_result['auto_updated'] = True

                print("\n辞書を保存しました")

        except Exception as e:
            print(f"辞書自動更新エラー: {e}")
            import traceback
            traceback.print_exc()

    return new_ids, skipped_ids, dictionary_result
