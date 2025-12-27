"""
Configuration management
環境変数とフォルダパス設定を管理
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Config:
    """アプリケーション設定"""

    # フォルダパス設定（GCS環境では "notes/new" のようにパスを指定）
    NOTES_NEW_FOLDER = os.getenv("NOTES_NEW_FOLDER", "notes/new")
    NOTES_PROCESSED_FOLDER = os.getenv("NOTES_PROCESSED_FOLDER", "notes/processed")
    NOTES_ARCHIVE_FOLDER = os.getenv("NOTES_ARCHIVE_FOLDER", "notes/archived")  # 後方互換性のため残す
    CHROMA_DB_FOLDER = os.getenv("CHROMA_DB_FOLDER", "/tmp/chroma_db")
    MASTER_DICTIONARY_PATH = os.getenv("MASTER_DICTIONARY_PATH", "master_dictionary.yaml")

    # デフォルトモデル設定
    DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
    DEFAULT_LLM_MODEL = "gpt-4o-mini"
    DEFAULT_RERANK_MODEL = "rerank-multilingual-v3.0"

    # 検索設定
    VECTOR_SEARCH_K = 20  # 初期検索候補数
    RERANK_TOP_N = 10  # リランキング後の上位件数
    UI_DISPLAY_TOP_N = 3  # UI表示用の上位件数

    @classmethod
    def ensure_folders(cls):
        """必要なフォルダを作成"""
        Path(cls.NOTES_NEW_FOLDER).mkdir(parents=True, exist_ok=True)
        Path(cls.NOTES_PROCESSED_FOLDER).mkdir(parents=True, exist_ok=True)
        Path(cls.NOTES_ARCHIVE_FOLDER).mkdir(parents=True, exist_ok=True)
        Path(cls.CHROMA_DB_FOLDER).mkdir(parents=True, exist_ok=True)

    @classmethod
    def update_folder_paths(cls, notes_new: str = None, notes_processed: str = None, notes_archive: str = None, chroma_db: str = None):
        """フォルダパスを動的に更新"""
        if notes_new:
            cls.NOTES_NEW_FOLDER = notes_new
        if notes_processed:
            cls.NOTES_PROCESSED_FOLDER = notes_processed
        if notes_archive:
            cls.NOTES_ARCHIVE_FOLDER = notes_archive
        if chroma_db:
            cls.CHROMA_DB_FOLDER = chroma_db
        cls.ensure_folders()

config = Config()
