"""
プロンプト管理機能
YAMLファイルでプロンプトを保存・読み込み
"""
import os
import yaml
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path


class PromptManager:
    """プロンプト管理クラス"""

    def __init__(self, prompts_dir: str = "./saved_prompts"):
        """
        Args:
            prompts_dir: プロンプトを保存するディレクトリ
        """
        self.prompts_dir = Path(prompts_dir)
        self.prompts_dir.mkdir(parents=True, exist_ok=True)

    def save_prompt(
        self,
        name: str,
        prompts: Dict[str, str],
        description: str = ""
    ) -> Dict[str, any]:
        """
        プロンプトをYAMLファイルとして保存

        Args:
            name: プロンプト名（ファイル名になる）
            prompts: プロンプト辞書 {"query_generation": "...", "compare": "..."}
            description: プロンプトの説明

        Returns:
            保存結果 {"success": bool, "error": str (optional), "file_path": str}
        """
        try:
            # ファイル名のサニタイズ（特殊文字を除去）
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')

            if not safe_name:
                return {"success": False, "error": "無効なプロンプト名です"}

            file_path = self.prompts_dir / f"{safe_name}.yaml"

            # 既存ファイルのチェック
            if file_path.exists():
                return {"success": False, "error": "同じ名前のプロンプトが既に存在します"}

            # YAMLデータの作成
            data = {
                "name": name,
                "description": description,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "prompts": prompts
            }

            # YAMLファイルに保存
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, allow_unicode=True, sort_keys=False)

            return {
                "success": True,
                "file_path": str(file_path),
                "name": name
            }

        except Exception as e:
            return {"success": False, "error": f"保存エラー: {str(e)}"}

    def load_prompt(self, name: str) -> Optional[Dict]:
        """
        プロンプトをYAMLファイルから読み込み

        Args:
            name: プロンプト名

        Returns:
            プロンプトデータ または None
        """
        try:
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')

            file_path = self.prompts_dir / f"{safe_name}.yaml"

            if not file_path.exists():
                return None

            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)

            return data

        except Exception as e:
            print(f"プロンプト読み込みエラー: {e}")
            return None

    def list_prompts(self) -> List[Dict]:
        """
        保存されているプロンプトの一覧を取得

        Returns:
            プロンプト一覧 [{"name": "...", "description": "...", ...}]
        """
        prompts = []

        try:
            for file_path in self.prompts_dir.glob("*.yaml"):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                    prompts.append({
                        "id": file_path.stem,  # ファイル名（拡張子なし）
                        "name": data.get("name", file_path.stem),
                        "description": data.get("description", ""),
                        "created_at": data.get("created_at", ""),
                        "updated_at": data.get("updated_at", ""),
                    })

            # 更新日時でソート（新しい順）
            prompts.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

        except Exception as e:
            print(f"プロンプト一覧取得エラー: {e}")

        return prompts

    def delete_prompt(self, name: str) -> Dict[str, any]:
        """
        プロンプトを削除

        Args:
            name: プロンプト名

        Returns:
            削除結果 {"success": bool, "error": str (optional)}
        """
        try:
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')

            file_path = self.prompts_dir / f"{safe_name}.yaml"

            if not file_path.exists():
                return {"success": False, "error": "プロンプトが見つかりません"}

            file_path.unlink()

            return {"success": True}

        except Exception as e:
            return {"success": False, "error": f"削除エラー: {str(e)}"}

    def update_prompt(
        self,
        name: str,
        prompts: Optional[Dict[str, str]] = None,
        description: Optional[str] = None
    ) -> Dict[str, any]:
        """
        プロンプトを更新

        Args:
            name: プロンプト名
            prompts: 新しいプロンプト辞書（Noneの場合は変更なし）
            description: 新しい説明（Noneの場合は変更なし）

        Returns:
            更新結果 {"success": bool, "error": str (optional)}
        """
        try:
            # 既存データを読み込み
            data = self.load_prompt(name)
            if not data:
                return {"success": False, "error": "プロンプトが見つかりません"}

            # 更新
            if prompts is not None:
                data["prompts"] = prompts

            if description is not None:
                data["description"] = description

            data["updated_at"] = datetime.now().isoformat()

            # 保存
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')
            file_path = self.prompts_dir / f"{safe_name}.yaml"

            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, allow_unicode=True, sort_keys=False)

            return {"success": True}

        except Exception as e:
            return {"success": False, "error": f"更新エラー: {str(e)}"}
