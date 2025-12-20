"""
Storage abstraction layer
ローカルファイルシステムとGoogle Cloud Storageを抽象化
"""
import os
from pathlib import Path
from typing import List, Optional
from abc import ABC, abstractmethod
import tempfile
import shutil


class StorageBackend(ABC):
    """ストレージバックエンドの抽象基底クラス"""

    @abstractmethod
    def read_file(self, path: str) -> str:
        """ファイルを読み込む"""
        pass

    @abstractmethod
    def write_file(self, path: str, content: str) -> None:
        """ファイルに書き込む"""
        pass

    @abstractmethod
    def read_bytes(self, path: str) -> bytes:
        """バイナリファイルを読み込む"""
        pass

    @abstractmethod
    def write_bytes(self, path: str, content: bytes) -> None:
        """バイナリファイルに書き込む"""
        pass

    @abstractmethod
    def list_files(self, prefix: str = "", pattern: str = "*") -> List[str]:
        """ファイル一覧を取得"""
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        """ファイルの存在確認"""
        pass

    @abstractmethod
    def delete_file(self, path: str) -> None:
        """ファイルを削除"""
        pass

    @abstractmethod
    def move_file(self, src: str, dst: str) -> None:
        """ファイルを移動"""
        pass

    @abstractmethod
    def mkdir(self, path: str) -> None:
        """ディレクトリを作成"""
        pass

    @abstractmethod
    def download_to_local(self, remote_path: str, local_path: str) -> None:
        """リモートからローカルにダウンロード（GCS用）"""
        pass

    @abstractmethod
    def upload_from_local(self, local_path: str, remote_path: str) -> None:
        """ローカルからリモートにアップロード（GCS用）"""
        pass


class LocalStorage(StorageBackend):
    """ローカルファイルシステムのストレージバックエンド"""

    def __init__(self, base_path: str = "."):
        self.base_path = Path(base_path)

    def _get_path(self, path: str) -> Path:
        """相対パスから絶対パスを生成"""
        return self.base_path / path

    def read_file(self, path: str) -> str:
        """ファイルを読み込む"""
        with open(self._get_path(path), 'r', encoding='utf-8') as f:
            return f.read()

    def write_file(self, path: str, content: str) -> None:
        """ファイルに書き込む"""
        file_path = self._get_path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def read_bytes(self, path: str) -> bytes:
        """バイナリファイルを読み込む"""
        with open(self._get_path(path), 'rb') as f:
            return f.read()

    def write_bytes(self, path: str, content: bytes) -> None:
        """バイナリファイルに書き込む"""
        file_path = self._get_path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'wb') as f:
            f.write(content)

    def list_files(self, prefix: str = "", pattern: str = "*") -> List[str]:
        """ファイル一覧を取得"""
        search_path = self._get_path(prefix) if prefix else self.base_path
        if not search_path.exists():
            return []

        files = []
        if search_path.is_dir():
            for item in search_path.rglob(pattern):
                if item.is_file():
                    # ベースパスからの相対パスを返す
                    rel_path = item.relative_to(self.base_path)
                    files.append(str(rel_path))
        return sorted(files)

    def exists(self, path: str) -> bool:
        """ファイルの存在確認"""
        return self._get_path(path).exists()

    def delete_file(self, path: str) -> None:
        """ファイルを削除"""
        file_path = self._get_path(path)
        if file_path.exists():
            file_path.unlink()

    def move_file(self, src: str, dst: str) -> None:
        """ファイルを移動"""
        src_path = self._get_path(src)
        dst_path = self._get_path(dst)
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src_path), str(dst_path))

    def mkdir(self, path: str) -> None:
        """ディレクトリを作成"""
        self._get_path(path).mkdir(parents=True, exist_ok=True)

    def download_to_local(self, remote_path: str, local_path: str) -> None:
        """ローカルストレージでは単純にコピー"""
        shutil.copy(str(self._get_path(remote_path)), local_path)

    def upload_from_local(self, local_path: str, remote_path: str) -> None:
        """ローカルストレージでは単純にコピー"""
        dst_path = self._get_path(remote_path)
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(local_path, str(dst_path))


class GCSStorage(StorageBackend):
    """Google Cloud Storageのストレージバックエンド"""

    def __init__(self, bucket_name: str):
        from google.cloud import storage
        self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)
        self.bucket_name = bucket_name

    def _get_blob(self, path: str):
        """Blobオブジェクトを取得"""
        return self.bucket.blob(path)

    def read_file(self, path: str) -> str:
        """ファイルを読み込む"""
        blob = self._get_blob(path)
        return blob.download_as_text(encoding='utf-8')

    def write_file(self, path: str, content: str) -> None:
        """ファイルに書き込む"""
        blob = self._get_blob(path)
        blob.upload_from_string(content, content_type='text/plain')

    def read_bytes(self, path: str) -> bytes:
        """バイナリファイルを読み込む"""
        blob = self._get_blob(path)
        return blob.download_as_bytes()

    def write_bytes(self, path: str, content: bytes) -> None:
        """バイナリファイルに書き込む"""
        blob = self._get_blob(path)
        blob.upload_from_string(content, content_type='application/octet-stream')

    def list_files(self, prefix: str = "", pattern: str = "*") -> List[str]:
        """ファイル一覧を取得"""
        blobs = self.bucket.list_blobs(prefix=prefix)
        files = []

        # パターンマッチング（簡易実装）
        import fnmatch
        for blob in blobs:
            if pattern == "*" or fnmatch.fnmatch(blob.name, f"{prefix}{pattern}"):
                files.append(blob.name)

        return sorted(files)

    def exists(self, path: str) -> bool:
        """ファイルの存在確認"""
        blob = self._get_blob(path)
        return blob.exists()

    def delete_file(self, path: str) -> None:
        """ファイルを削除"""
        blob = self._get_blob(path)
        if blob.exists():
            blob.delete()

    def move_file(self, src: str, dst: str) -> None:
        """ファイルを移動（コピー後に元を削除）"""
        src_blob = self._get_blob(src)
        dst_blob = self.bucket.blob(dst)

        # コピー
        self.bucket.copy_blob(src_blob, self.bucket, dst)
        # 元を削除
        src_blob.delete()

    def mkdir(self, path: str) -> None:
        """GCSにはディレクトリの概念がないので何もしない"""
        pass

    def download_to_local(self, remote_path: str, local_path: str) -> None:
        """GCSからローカルにダウンロード"""
        blob = self._get_blob(remote_path)
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(local_path)

    def upload_from_local(self, local_path: str, remote_path: str) -> None:
        """ローカルからGCSにアップロード"""
        blob = self._get_blob(remote_path)
        blob.upload_from_filename(local_path)


class Storage:
    """
    統一ストレージインターフェース
    環境変数でローカル/GCSを自動切り替え
    """

    def __init__(self):
        storage_type = os.getenv("STORAGE_TYPE", "local")

        if storage_type == "gcs":
            bucket_name = os.getenv("GCS_BUCKET_NAME", "jikkennote-storage")
            self.backend = GCSStorage(bucket_name)
            print(f"Using GCS storage: gs://{bucket_name}")
        else:
            base_path = os.getenv("STORAGE_BASE_PATH", ".")
            self.backend = LocalStorage(base_path)
            print(f"Using local storage: {base_path}")

    def read_file(self, path: str) -> str:
        """ファイルを読み込む"""
        return self.backend.read_file(path)

    def write_file(self, path: str, content: str) -> None:
        """ファイルに書き込む"""
        self.backend.write_file(path, content)

    def read_bytes(self, path: str) -> bytes:
        """バイナリファイルを読み込む"""
        return self.backend.read_bytes(path)

    def write_bytes(self, path: str, content: bytes) -> None:
        """バイナリファイルに書き込む"""
        self.backend.write_bytes(path, content)

    def list_files(self, prefix: str = "", pattern: str = "*") -> List[str]:
        """ファイル一覧を取得"""
        return self.backend.list_files(prefix, pattern)

    def exists(self, path: str) -> bool:
        """ファイルの存在確認"""
        return self.backend.exists(path)

    def delete_file(self, path: str) -> None:
        """ファイルを削除"""
        self.backend.delete_file(path)

    def move_file(self, src: str, dst: str) -> None:
        """ファイルを移動"""
        self.backend.move_file(src, dst)

    def mkdir(self, path: str) -> None:
        """ディレクトリを作成"""
        self.backend.mkdir(path)

    def download_to_local(self, remote_path: str, local_path: str) -> None:
        """リモートからローカルにダウンロード"""
        self.backend.download_to_local(remote_path, local_path)

    def upload_from_local(self, local_path: str, remote_path: str) -> None:
        """ローカルからリモートにアップロード"""
        self.backend.upload_from_local(local_path, remote_path)


# グローバルストレージインスタンス
storage = Storage()
