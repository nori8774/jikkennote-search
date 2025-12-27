"""
ChromaDB の GCS 同期モジュール
起動時にGCSからダウンロード、更新時にアップロード
"""
import os
import json
import tempfile
import tarfile
import shutil
from pathlib import Path
from datetime import datetime
from storage import storage
from config import config


def sync_chroma_from_gcs(local_chroma_path: str = None):
    """
    GCSからChromaDBをダウンロードしてローカルに展開

    Args:
        local_chroma_path: ローカルのChromaDBパス（デフォルト: config.CHROMA_DB_FOLDER）
    """
    local_chroma_path = local_chroma_path or config.CHROMA_DB_FOLDER

    # ローカルストレージの場合はスキップ
    if os.getenv("STORAGE_TYPE", "local") != "gcs":
        print("ローカルストレージモードのため、GCS同期をスキップ")
        return

    # GCS上のtarballパス
    gcs_tarball_path = "chroma_db/chroma_db.tar.gz"

    try:
        # GCSにファイルが存在するか確認
        if not storage.exists(gcs_tarball_path):
            print(f"GCSにChromaDBが見つかりません: {gcs_tarball_path}")
            print("新規作成モードで起動します")
            Path(local_chroma_path).mkdir(parents=True, exist_ok=True)
            return

        print(f"GCSからChromaDBをダウンロード中: {gcs_tarball_path}")

        # 一時ファイルにダウンロード
        with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
            tmp_path = tmp.name

        storage.download_to_local(gcs_tarball_path, tmp_path)

        # 展開先のディレクトリを作成
        Path(local_chroma_path).parent.mkdir(parents=True, exist_ok=True)

        # tar.gzを展開
        print(f"ChromaDBを展開中: {local_chroma_path}")
        with tarfile.open(tmp_path, 'r:gz') as tar:
            tar.extractall(Path(local_chroma_path).parent)

        # 一時ファイルを削除
        os.remove(tmp_path)

        print("ChromaDBの同期完了")

    except Exception as e:
        print(f"ChromaDB同期エラー: {e}")
        print("新規作成モードで起動します")
        Path(local_chroma_path).mkdir(parents=True, exist_ok=True)


def sync_chroma_to_gcs(local_chroma_path: str = None):
    """
    ローカルのChromaDBをtar.gzに圧縮してGCSにアップロード

    Args:
        local_chroma_path: ローカルのChromaDBパス（デフォルト: config.CHROMA_DB_FOLDER）
    """
    local_chroma_path = local_chroma_path or config.CHROMA_DB_FOLDER

    # ローカルストレージの場合はスキップ
    if os.getenv("STORAGE_TYPE", "local") != "gcs":
        print("ローカルストレージモードのため、GCS同期をスキップ")
        return

    # ChromaDBが存在しない場合はスキップ
    if not os.path.exists(local_chroma_path):
        print(f"ローカルにChromaDBが見つかりません: {local_chroma_path}")
        return

    # GCS上のtarballパス
    gcs_tarball_path = "chroma_db/chroma_db.tar.gz"

    try:
        print(f"ChromaDBを圧縮中: {local_chroma_path}")

        # 一時ファイルに圧縮
        with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
            tmp_path = tmp.name

        with tarfile.open(tmp_path, 'w:gz') as tar:
            # chroma_db フォルダ全体を追加
            tar.add(local_chroma_path, arcname=os.path.basename(local_chroma_path))

        print(f"GCSにアップロード中: {gcs_tarball_path}")
        storage.upload_from_local(tmp_path, gcs_tarball_path)

        # 一時ファイルを削除
        os.remove(tmp_path)

        print("ChromaDBのGCSアップロード完了")

    except Exception as e:
        print(f"ChromaDBアップロードエラー: {e}")
        raise


def get_chroma_config_path():
    """ChromaDB設定ファイルのパスを取得"""
    return os.path.join(os.path.dirname(__file__), "chroma_db_config.json")


def get_current_embedding_model():
    """
    ChromaDBに設定されている現在のembeddingモデルを取得

    Returns:
        str: embeddingモデル名（設定がない場合はNone）
    """
    config_path = get_chroma_config_path()
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                return config_data.get('embedding_model')
    except Exception as e:
        print(f"ChromaDB設定読み込みエラー: {e}")
    return None


def save_embedding_model_config(embedding_model: str):
    """
    ChromaDBのembeddingモデル設定を保存

    Args:
        embedding_model: 使用するembeddingモデル名
    """
    config_path = get_chroma_config_path()
    try:
        config_data = {
            "embedding_model": embedding_model,
            "last_updated": datetime.now().isoformat()
        }

        # 初回作成時のみcreated_atを設定
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
                config_data["created_at"] = existing.get("created_at", datetime.now().isoformat())
        else:
            config_data["created_at"] = datetime.now().isoformat()

        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)

        print(f"ChromaDB設定を保存: {embedding_model}")
    except Exception as e:
        print(f"ChromaDB設定保存エラー: {e}")


def reset_chroma_db(local_chroma_path: str = None):
    """
    ChromaDBを完全にリセット（削除して再作成）

    Args:
        local_chroma_path: ローカルのChromaDBパス（デフォルト: config.CHROMA_DB_FOLDER）

    Returns:
        bool: リセット成功の可否
    """
    local_chroma_path = local_chroma_path or config.CHROMA_DB_FOLDER

    try:
        # ChromaDBフォルダが存在する場合は削除
        if os.path.exists(local_chroma_path):
            print(f"ChromaDBを削除中: {local_chroma_path}")
            shutil.rmtree(local_chroma_path)

        # 新しいフォルダを作成
        Path(local_chroma_path).mkdir(parents=True, exist_ok=True)

        # 設定ファイルも削除
        config_path = get_chroma_config_path()
        if os.path.exists(config_path):
            os.remove(config_path)
            print("ChromaDB設定ファイルを削除")

        print("ChromaDBのリセット完了")
        return True

    except Exception as e:
        print(f"ChromaDBリセットエラー: {e}")
        return False


def get_chroma_vectorstore(embeddings, collection_name: str = "experiment_notes", embedding_model: str = None):
    """
    ChromaDBのベクトルストアを取得（GCS同期付き）

    Args:
        embeddings: Embedding関数
        collection_name: コレクション名
        embedding_model: 使用するembeddingモデル名（設定保存用）

    Returns:
        Chroma vectorstore
    """
    from langchain_chroma import Chroma

    # GCSから同期（起動時に一度だけ）
    sync_chroma_from_gcs()

    # embeddingモデル設定を保存（提供された場合）
    if embedding_model:
        current_model = get_current_embedding_model()
        if current_model is None:
            # 初回作成時
            save_embedding_model_config(embedding_model)
        elif current_model != embedding_model:
            # モデルが変更された場合（警告は呼び出し側で行う）
            print(f"⚠️  警告: embeddingモデルが変更されました: {current_model} -> {embedding_model}")
            print("   既存のベクトルDBとの互換性がなくなる可能性があります")

    # Chromaインスタンスを作成
    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=config.CHROMA_DB_FOLDER
    )

    return vectorstore
