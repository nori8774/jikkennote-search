"""
ChromaDB の GCS 同期モジュール
起動時にGCSからダウンロード、更新時にアップロード
"""
import os
import tempfile
import tarfile
from pathlib import Path
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


def get_chroma_vectorstore(embeddings, collection_name: str = "experiment_notes"):
    """
    ChromaDBのベクトルストアを取得（GCS同期付き）

    Args:
        embeddings: Embedding関数
        collection_name: コレクション名

    Returns:
        Chroma vectorstore
    """
    from langchain_chroma import Chroma

    # GCSから同期（起動時に一度だけ）
    sync_chroma_from_gcs()

    # Chromaインスタンスを作成
    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=config.CHROMA_DB_FOLDER
    )

    return vectorstore
