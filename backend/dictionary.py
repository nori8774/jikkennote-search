"""
正規化辞書管理モジュール

機能:
- YAML辞書の読み込み・保存
- エントリの追加・更新・削除
- 類似単語の検索（編集距離 + Embeddingベースの類似度）
- エクスポート/インポート（YAML, JSON, CSV）
"""

import os
import yaml
import json
import csv
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from difflib import SequenceMatcher
from dataclasses import dataclass, asdict
from io import StringIO

from config import config
from storage import storage


@dataclass
class NormalizationEntry:
    """正規化辞書のエントリ"""
    canonical: str  # 正規化後の名称
    variants: List[str]  # 表記揺れのリスト
    category: Optional[str] = None  # カテゴリ（試薬、溶媒、etc）
    note: Optional[str] = None  # メモ
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def to_dict(self) -> Dict:
        """辞書形式に変換"""
        result = {
            'canonical': self.canonical,
            'variants': self.variants
        }
        if self.category:
            result['category'] = self.category
        if self.note:
            result['note'] = self.note
        if self.created_at:
            result['created_at'] = self.created_at
        if self.updated_at:
            result['updated_at'] = self.updated_at
        return result


class DictionaryManager:
    """正規化辞書マネージャー"""

    def __init__(self, team_id: Optional[str] = None, dictionary_path: Optional[str] = None):
        """
        Args:
            team_id: チームID（マルチテナント対応）
            dictionary_path: 辞書ファイルのパス（デフォルト: チームディレクトリまたはconfig.MASTER_DICTIONARY_PATH）
        """
        if dictionary_path:
            self.dictionary_path = dictionary_path
        elif team_id:
            # チーム専用の辞書パス
            self.dictionary_path = f"teams/{team_id}/master_dictionary.yaml"
        else:
            # デフォルトパス（後方互換性のため）
            self.dictionary_path = config.MASTER_DICTIONARY_PATH

        self.team_id = team_id
        self.entries: List[NormalizationEntry] = []
        self.load()

    def load(self):
        """YAML辞書を読み込む"""
        if not storage.exists(self.dictionary_path):
            print(f"辞書ファイルが見つかりません: {self.dictionary_path}")
            return

        try:
            content = storage.read_file(self.dictionary_path)
            data = yaml.safe_load(content) or []

            self.entries = []
            for item in data:
                entry = NormalizationEntry(
                    canonical=item['canonical'],
                    variants=item.get('variants', []),
                    category=item.get('category'),
                    note=item.get('note'),
                    created_at=item.get('created_at'),
                    updated_at=item.get('updated_at')
                )
                self.entries.append(entry)

            print(f"辞書を読み込みました: {len(self.entries)}エントリ")

        except Exception as e:
            print(f"辞書の読み込みに失敗: {e}")
            self.entries = []

    def save(self):
        """YAML辞書を保存"""
        try:
            # バックアップ作成
            if storage.exists(self.dictionary_path):
                backup_path = f"{self.dictionary_path}.backup"
                content = storage.read_file(self.dictionary_path)
                storage.write_file(backup_path, content)

            # 保存
            data = [entry.to_dict() for entry in self.entries]
            yaml_content = yaml.dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False)
            storage.write_file(self.dictionary_path, yaml_content)

            print(f"辞書を保存しました: {len(self.entries)}エントリ")
            return True

        except Exception as e:
            print(f"辞書の保存に失敗: {e}")
            return False

    def get_all_entries(self) -> List[Dict]:
        """全エントリを取得"""
        return [entry.to_dict() for entry in self.entries]

    def get_all_terms(self) -> List[str]:
        """全ての正規化名とバリアントを取得"""
        terms = []
        for entry in self.entries:
            terms.append(entry.canonical)
            terms.extend(entry.variants)
        return terms

    def find_entry_by_canonical(self, canonical: str) -> Optional[NormalizationEntry]:
        """正規化名でエントリを検索"""
        for entry in self.entries:
            if entry.canonical == canonical:
                return entry
        return None

    def find_entry_by_term(self, term: str) -> Optional[NormalizationEntry]:
        """用語（正規化名またはバリアント）でエントリを検索"""
        for entry in self.entries:
            if entry.canonical == term or term in entry.variants:
                return entry
        return None

    def add_entry(self, canonical: str, variants: List[str] = None,
                  category: Optional[str] = None, note: Optional[str] = None) -> bool:
        """新規エントリを追加"""
        # 既存チェック
        if self.find_entry_by_canonical(canonical):
            print(f"エントリが既に存在します: {canonical}")
            return False

        now = datetime.now().isoformat()
        entry = NormalizationEntry(
            canonical=canonical,
            variants=variants or [],
            category=category,
            note=note,
            created_at=now,
            updated_at=now
        )
        self.entries.append(entry)
        return self.save()

    def update_entry(self, canonical: str, variants: Optional[List[str]] = None,
                     category: Optional[str] = None, note: Optional[str] = None) -> bool:
        """エントリを更新"""
        entry = self.find_entry_by_canonical(canonical)
        if not entry:
            print(f"エントリが見つかりません: {canonical}")
            return False

        if variants is not None:
            entry.variants = variants
        if category is not None:
            entry.category = category
        if note is not None:
            entry.note = note
        entry.updated_at = datetime.now().isoformat()

        return self.save()

    def add_variant(self, canonical: str, variant: str) -> bool:
        """既存エントリにバリアントを追加"""
        entry = self.find_entry_by_canonical(canonical)
        if not entry:
            print(f"エントリが見つかりません: {canonical}")
            return False

        if variant in entry.variants:
            print(f"バリアントが既に存在します: {variant}")
            return False

        entry.variants.append(variant)
        entry.updated_at = datetime.now().isoformat()
        return self.save()

    def delete_entry(self, canonical: str) -> bool:
        """エントリを削除"""
        entry = self.find_entry_by_canonical(canonical)
        if not entry:
            print(f"エントリが見つかりません: {canonical}")
            return False

        self.entries.remove(entry)
        return self.save()

    def search_entries(self, query: str) -> List[Dict]:
        """エントリを検索（正規化名、バリアント、カテゴリから）"""
        results = []
        query_lower = query.lower()

        for entry in self.entries:
            if (query_lower in entry.canonical.lower() or
                any(query_lower in v.lower() for v in entry.variants) or
                (entry.category and query_lower in entry.category.lower())):
                results.append(entry.to_dict())

        return results

    def calculate_string_similarity(self, s1: str, s2: str) -> float:
        """
        文字列の類似度を計算（編集距離ベース）

        Returns:
            0.0-1.0の類似度スコア
        """
        return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()

    def find_similar_terms(self, term: str, threshold: float = 0.6, top_k: int = 5) -> List[Tuple[str, float, str]]:
        """
        類似する用語を検索

        Args:
            term: 検索する用語
            threshold: 類似度の閾値
            top_k: 返す最大数

        Returns:
            [(term, similarity, canonical), ...] のリスト
        """
        results = []

        for entry in self.entries:
            # 正規化名との類似度
            sim = self.calculate_string_similarity(term, entry.canonical)
            if sim >= threshold:
                results.append((entry.canonical, sim, entry.canonical))

            # バリアントとの類似度
            for variant in entry.variants:
                sim = self.calculate_string_similarity(term, variant)
                if sim >= threshold:
                    results.append((variant, sim, entry.canonical))

        # 類似度でソート
        results.sort(key=lambda x: x[1], reverse=True)

        return results[:top_k]

    def normalize_term(self, term: str) -> str:
        """
        用語を正規化

        Args:
            term: 正規化する用語

        Returns:
            正規化された用語（見つからない場合は元の用語）
        """
        entry = self.find_entry_by_term(term)
        if entry:
            return entry.canonical
        return term

    def export_to_json(self, output_path: Optional[str] = None) -> str:
        """JSON形式でエクスポート"""
        data = self.get_all_entries()
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return output_path
        else:
            return json.dumps(data, ensure_ascii=False, indent=2)

    def export_to_csv(self, output_path: Optional[str] = None) -> str:
        """CSV形式でエクスポート"""
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['canonical', 'variants', 'category', 'note'])

        for entry in self.entries:
            writer.writerow([
                entry.canonical,
                '|'.join(entry.variants),  # バリアントを | で結合
                entry.category or '',
                entry.note or ''
            ])

        csv_content = output.getvalue()
        output.close()

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(csv_content)
            return output_path
        else:
            return csv_content

    def import_from_json(self, json_data: str or List[Dict]) -> bool:
        """JSON形式からインポート"""
        try:
            if isinstance(json_data, str):
                data = json.loads(json_data)
            else:
                data = json_data

            for item in data:
                canonical = item.get('canonical')
                if not canonical:
                    continue

                # 既存エントリは更新、新規は追加
                existing = self.find_entry_by_canonical(canonical)
                if existing:
                    self.update_entry(
                        canonical=canonical,
                        variants=item.get('variants', []),
                        category=item.get('category'),
                        note=item.get('note')
                    )
                else:
                    self.add_entry(
                        canonical=canonical,
                        variants=item.get('variants', []),
                        category=item.get('category'),
                        note=item.get('note')
                    )

            return True

        except Exception as e:
            print(f"JSONインポートに失敗: {e}")
            return False

    def import_from_csv(self, csv_content: str) -> bool:
        """CSV形式からインポート"""
        try:
            reader = csv.DictReader(StringIO(csv_content))

            for row in reader:
                canonical = row.get('canonical')
                if not canonical:
                    continue

                variants_str = row.get('variants', '')
                variants = [v.strip() for v in variants_str.split('|') if v.strip()]

                # 既存エントリは更新、新規は追加
                existing = self.find_entry_by_canonical(canonical)
                if existing:
                    self.update_entry(
                        canonical=canonical,
                        variants=variants,
                        category=row.get('category'),
                        note=row.get('note')
                    )
                else:
                    self.add_entry(
                        canonical=canonical,
                        variants=variants,
                        category=row.get('category'),
                        note=row.get('note')
                    )

            return True

        except Exception as e:
            print(f"CSVインポートに失敗: {e}")
            return False

    def apply_variant_updates(self, variant_decisions: List[Dict]) -> Dict:
        """
        表記揺れ判定結果を辞書に適用

        Args:
            variant_decisions: [
                {
                    "term": "新出単語",
                    "decision": "variant" or "new",
                    "canonical": "紐付け先の正規化名",
                    "category": "カテゴリ",
                    "note": "メモ"
                },
                ...
            ]

        Returns:
            {"added": 件数, "updated": 件数, "errors": [エラーメッセージ]}
        """
        added_count = 0
        updated_count = 0
        errors = []

        for decision in variant_decisions:
            term = decision.get('term')
            decision_type = decision.get('decision')
            canonical = decision.get('canonical')
            category = decision.get('category')
            note = decision.get('note')

            try:
                if decision_type == 'variant':
                    # 表記揺れとして既存エントリに追加
                    if not canonical:
                        errors.append(f"{term}: 紐付け先が指定されていません")
                        continue

                    entry = self.find_entry_by_canonical(canonical)
                    if entry:
                        # 既存エントリにバリアントを追加
                        if term not in entry.variants and term != canonical:
                            entry.variants.append(term)
                            entry.updated_at = datetime.now().isoformat()
                            updated_count += 1
                    else:
                        # 正規化名が存在しない場合は新規作成
                        self.entries.append(NormalizationEntry(
                            canonical=canonical,
                            variants=[term] if term != canonical else [],
                            category=category,
                            note=note,
                            created_at=datetime.now().isoformat(),
                            updated_at=datetime.now().isoformat()
                        ))
                        added_count += 1

                elif decision_type == 'new':
                    # 新規物質として追加
                    existing = self.find_entry_by_canonical(term)
                    if not existing:
                        self.entries.append(NormalizationEntry(
                            canonical=term,
                            variants=[],
                            category=category,
                            note=note,
                            created_at=datetime.now().isoformat(),
                            updated_at=datetime.now().isoformat()
                        ))
                        added_count += 1

            except Exception as e:
                errors.append(f"{term}: {str(e)}")

        # 保存
        if added_count > 0 or updated_count > 0:
            self.save()

        return {
            'added': added_count,
            'updated': updated_count,
            'errors': errors
        }

    def auto_update_from_patterns(self, all_patterns: List[str]) -> Dict:
        """
        複数パターンから自動的に辞書を更新

        Args:
            all_patterns: 抽出された全パターンのリスト

        Returns:
            {"added": 件数, "variants_detected": 表記揺れ候補リスト}
        """
        added_count = 0
        new_patterns = []

        # 既存辞書にないパターンを抽出
        known_terms = set(self.get_all_terms())

        for pattern in all_patterns:
            if pattern not in known_terms:
                new_patterns.append(pattern)

        # 新規パターンを辞書に追加（重複チェック付き）
        for pattern in new_patterns:
            existing = self.find_entry_by_canonical(pattern)
            if not existing:
                self.entries.append(NormalizationEntry(
                    canonical=pattern,
                    variants=[],
                    category=None,
                    note='自動生成',
                    created_at=datetime.now().isoformat(),
                    updated_at=datetime.now().isoformat()
                ))
                added_count += 1

        if added_count > 0:
            self.save()

        return {
            'added': added_count,
            'new_patterns': new_patterns
        }


def get_dictionary_manager(team_id: Optional[str] = None) -> DictionaryManager:
    """
    辞書マネージャーのインスタンスを取得

    Args:
        team_id: チームID（マルチテナント対応）

    Returns:
        DictionaryManagerインスタンス
    """
    return DictionaryManager(team_id=team_id)
