"""
単語抽出モジュール

機能:
- 実験ノートの材料セクションから単語を抽出
- 既存辞書との照合
- LLMを使った類似単語検索と表記揺れ判定
"""

import re
from typing import List, Dict, Optional, Tuple
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import numpy as np

from dictionary import DictionaryManager


class TermExtractor:
    """単語抽出クラス"""

    def __init__(self, dictionary_manager: DictionaryManager, openai_api_key: str):
        """
        Args:
            dictionary_manager: 辞書マネージャー
            openai_api_key: OpenAI APIキー
        """
        self.dictionary_manager = dictionary_manager
        self.openai_api_key = openai_api_key
        self.llm = ChatOpenAI(
            api_key=openai_api_key,
            model="gpt-4o-mini",
            temperature=0
        )
        self.embeddings = OpenAIEmbeddings(
            api_key=openai_api_key,
            model="text-embedding-3-small"
        )

    def extract_materials_section(self, note_content: str) -> Optional[str]:
        """
        実験ノートから材料セクションを抽出

        Args:
            note_content: ノートの全文（Markdown形式）

        Returns:
            材料セクションのテキスト（見つからない場合はNone）
        """
        # Markdownのセクション見出しを探す
        patterns = [
            r'##\s*材料\s*\n(.*?)(?:\n##|$)',
            r'##\s*Material[s]?\s*\n(.*?)(?:\n##|$)',
            r'##\s*試薬\s*\n(.*?)(?:\n##|$)',
            r'##\s*Reagent[s]?\s*\n(.*?)(?:\n##|$)',
        ]

        for pattern in patterns:
            match = re.search(pattern, note_content, re.DOTALL | re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return None

    def generate_term_patterns(self, term: str) -> List[str]:
        """
        複数パターンの単語を生成

        ルール:
        1. 完全形を必ず含める
        2. 英数字と日本語の境界で分割
        3. 化学接尾辞（〜酸、〜塩、〜抗体、など）を含む部分を抽出
        4. 意味のある部分文字列を抽出

        Args:
            term: 元の用語

        Returns:
            パターンのリスト
        """
        patterns = set()
        patterns.add(term)  # 完全形

        # 短すぎる用語はパターン生成しない
        if len(term) <= 2:
            return [term]

        # 英数字と日本語の境界で分割
        parts = re.split(r'([a-zA-Z0-9]+)', term)
        for i, part in enumerate(parts):
            if not part or len(part) <= 1:
                continue

            # 単独のパートを追加
            if len(part) >= 2:
                patterns.add(part)

            # 前後の組み合わせも追加
            if i > 0 and parts[i-1] and len(parts[i-1]) >= 1:
                combined = parts[i-1] + part
                if len(combined) >= 2:
                    patterns.add(combined)

            if i < len(parts) - 1 and parts[i+1] and len(parts[i+1]) >= 1:
                combined = part + parts[i+1]
                if len(combined) >= 2:
                    patterns.add(combined)

        # 化学接尾辞を含む部分を抽出
        suffixes = ['酸', '塩', '抗体', '試薬', '溶媒', '液', 'エステル', '化合物', '溶液']
        for suffix in suffixes:
            if suffix in term:
                # 接尾辞の最後の出現位置を取得
                idx = term.rindex(suffix)
                extracted = term[:idx+len(suffix)]
                if len(extracted) >= 2:
                    patterns.add(extracted)

                    # 接尾辞の前の部分も抽出
                    prefix_part = term[:idx]
                    if len(prefix_part) >= 2:
                        patterns.add(prefix_part)

        # 1文字のパターンを除外（あまり意味がないため）
        patterns = {p for p in patterns if len(p) >= 2}

        return sorted(list(patterns), key=len, reverse=True)  # 長い順にソート

    def extract_terms_from_text(self, text: str) -> List[str]:
        """
        テキストから化学物質名・試薬名を抽出し、複数パターンを生成

        Args:
            text: 抽出元のテキスト

        Returns:
            抽出された用語のリスト（パターン展開済み）
        """
        if not text:
            return []

        # LLMを使って化学物質名を抽出
        prompt = f"""以下のテキストから、化学物質名、試薬名、溶媒名を抽出してください。
一般名称、慣用名、化学式、CAS番号など、すべての形式を含めてください。

テキスト:
{text}

出力形式: JSON形式で出力してください
{{"terms": ["物質名1", "物質名2", ...]}}
"""

        try:
            response = self.llm.invoke(prompt)
            content = response.content

            # JSONパース
            import json
            # コードブロックから抽出
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            data = json.loads(content)
            base_terms = data.get('terms', [])

            # 各用語について複数パターンを生成
            all_patterns = set()
            for term in base_terms:
                term = term.strip()
                if term:
                    patterns = self.generate_term_patterns(term)
                    all_patterns.update(patterns)

            return sorted(list(all_patterns))

        except Exception as e:
            print(f"用語抽出に失敗: {e}")
            # フォールバック: 簡易的なパターンマッチング
            return self._extract_terms_fallback(text)

    def _extract_terms_fallback(self, text: str) -> List[str]:
        """
        フォールバック: 簡易的な用語抽出（正規表現ベース）

        Args:
            text: 抽出元のテキスト

        Returns:
            抽出された用語のリスト
        """
        terms = []

        # 箇条書きの項目を抽出
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            # - で始まる行、または数字. で始まる行
            if line.startswith('- ') or line.startswith('* ') or re.match(r'^\d+\.', line):
                # : の前の部分を抽出（例: "水酸化ナトリウム: 100ml"）
                if ':' in line:
                    term = line.split(':')[0].strip('- *0123456789. ')
                    if term:
                        terms.append(term)

        return list(set(terms))

    def find_new_terms(self, terms: List[str]) -> List[str]:
        """
        既存辞書にない新出単語を抽出

        Args:
            terms: チェックする用語のリスト

        Returns:
            新出単語のリスト
        """
        known_terms = set(self.dictionary_manager.get_all_terms())
        new_terms = []

        for term in terms:
            # 完全一致チェック
            if term not in known_terms:
                # 正規化してチェック（大文字小文字の違いなど）
                term_lower = term.lower()
                found = False
                for known in known_terms:
                    if known.lower() == term_lower:
                        found = True
                        break
                if not found:
                    new_terms.append(term)

        return new_terms

    def calculate_embedding_similarity(self, term1: str, term2: str) -> float:
        """
        Embeddingベースの類似度を計算

        Args:
            term1: 比較する用語1
            term2: 比較する用語2

        Returns:
            コサイン類似度（0.0-1.0）
        """
        try:
            embeddings = self.embeddings.embed_documents([term1, term2])
            vec1 = np.array(embeddings[0])
            vec2 = np.array(embeddings[1])

            # コサイン類似度
            similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
            return float(similarity)

        except Exception as e:
            print(f"Embedding類似度計算に失敗: {e}")
            return 0.0

    def find_similar_candidates(self, new_term: str, top_k: int = 5) -> List[Dict]:
        """
        新出単語の類似候補を検索（編集距離 + Embedding類似度）

        Args:
            new_term: 新出単語
            top_k: 返す候補数

        Returns:
            類似候補のリスト [{"term": "...", "canonical": "...", "similarity": 0.8, "embedding_similarity": 0.9}, ...]
        """
        # 編集距離ベースの類似検索
        string_similar = self.dictionary_manager.find_similar_terms(new_term, threshold=0.5, top_k=top_k * 2)

        # Embeddingベースの類似度を追加計算
        candidates = []
        for term, string_sim, canonical in string_similar:
            embedding_sim = self.calculate_embedding_similarity(new_term, term)
            # 総合スコア（編集距離とEmbedding類似度の平均）
            combined_score = (string_sim + embedding_sim) / 2

            candidates.append({
                'term': term,
                'canonical': canonical,
                'similarity': string_sim,
                'embedding_similarity': embedding_sim,
                'combined_score': combined_score
            })

        # 総合スコアでソート
        candidates.sort(key=lambda x: x['combined_score'], reverse=True)

        return candidates[:top_k]

    def analyze_with_llm(self, new_term: str, similar_candidates: List[Dict]) -> Dict:
        """
        LLMを使って新出単語が表記揺れか新規物質かを判定

        Args:
            new_term: 新出単語
            similar_candidates: 類似候補のリスト

        Returns:
            判定結果 {"decision": "variant" or "new", "reason": "...", "suggested_canonical": "..."}
        """
        if not similar_candidates:
            return {
                'decision': 'new',
                'reason': '類似する既存単語が見つかりませんでした',
                'suggested_canonical': None
            }

        # 候補リストを整形
        candidates_text = '\n'.join([
            f"- {c['term']} (正規化名: {c['canonical']}, 類似度: {c['combined_score']:.2f})"
            for c in similar_candidates[:3]
        ])

        prompt = f"""あなたは化学・生物学分野の専門家です。
以下の新出単語が、既存の化学物質の表記揺れなのか、それとも新規物質なのかを判定してください。

新出単語: {new_term}

類似する既存単語:
{candidates_text}

判定基準:
1. 化学式の表記違い（例: NaOH と 水酸化ナトリウム）→ 表記揺れ
2. 同義語・別名（例: エタノール と エチルアルコール）→ 表記揺れ
3. 明らかに異なる物質 → 新規物質
4. 類似度が低い、または物質が異なる → 新規物質

出力形式（JSON）:
{{
  "decision": "variant" または "new",
  "reason": "判定理由",
  "suggested_canonical": "表記揺れの場合、紐付ける正規化名（variantの場合のみ）"
}}
"""

        try:
            response = self.llm.invoke(prompt)
            content = response.content

            # JSONパース
            import json
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            result = json.loads(content)

            return {
                'decision': result.get('decision', 'new'),
                'reason': result.get('reason', ''),
                'suggested_canonical': result.get('suggested_canonical')
            }

        except Exception as e:
            print(f"LLM判定に失敗: {e}")
            # デフォルトは「新規物質」とする
            return {
                'decision': 'new',
                'reason': f'LLM判定エラー: {e}',
                'suggested_canonical': None
            }

    def calculate_edit_distance_similarity(self, term1: str, term2: str) -> float:
        """
        編集距離ベースの類似度を計算（レーベンシュタイン距離）

        Args:
            term1: 比較する用語1
            term2: 比較する用語2

        Returns:
            類似度（0.0-1.0）
        """
        # レーベンシュタイン距離を計算
        def levenshtein_distance(s1: str, s2: str) -> int:
            if len(s1) < len(s2):
                return levenshtein_distance(s2, s1)

            if len(s2) == 0:
                return len(s1)

            previous_row = range(len(s2) + 1)
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    # 挿入、削除、置換のコストを計算
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row

            return previous_row[-1]

        distance = levenshtein_distance(term1, term2)
        max_len = max(len(term1), len(term2))

        # 類似度に変換（0.0-1.0）
        similarity = 1.0 - (distance / max_len) if max_len > 0 else 1.0
        return similarity

    def auto_detect_variants(
        self,
        all_terms: List[str],
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        表記揺れ候補を自動検出（文字数フィルタリング付き）

        Args:
            all_terms: すべての用語のリスト
            threshold: 類似度の閾値（デフォルト: 0.7）

        Returns:
            候補のリスト [{"term1": "...", "term2": "...", "similarity": 0.8, "llm_suggestion": {...}}, ...]
        """
        from collections import defaultdict

        candidates = []

        # 文字数でグルーピング
        term_groups = defaultdict(list)
        for term in all_terms:
            length = len(term)
            term_groups[length].append(term)

        # 文字数が近い単語同士を比較（±2文字以内）
        processed_pairs = set()  # 重複チェック用

        for length, terms in term_groups.items():
            # 近い文字数の用語を集める
            nearby_terms = []
            for l in range(max(1, length-2), length+3):
                nearby_terms.extend(term_groups.get(l, []))

            # 重複を除去
            nearby_terms = list(set(nearby_terms))

            # ペアごとに類似度計算
            for i, term1 in enumerate(terms):
                for term2 in nearby_terms:
                    # 同じ単語はスキップ
                    if term1 == term2:
                        continue

                    # 重複ペアをスキップ
                    pair_key = tuple(sorted([term1, term2]))
                    if pair_key in processed_pairs:
                        continue
                    processed_pairs.add(pair_key)

                    # 編集距離とEmbedding類似度を計算
                    edit_sim = self.calculate_edit_distance_similarity(term1, term2)
                    emb_sim = self.calculate_embedding_similarity(term1, term2)

                    # 総合スコア
                    combined = (edit_sim + emb_sim) / 2

                    if combined >= threshold:
                        # LLMで判定
                        llm_result = self.llm_judge_variant_pair(term1, term2)

                        candidates.append({
                            "term1": term1,
                            "term2": term2,
                            "edit_similarity": edit_sim,
                            "embedding_similarity": emb_sim,
                            "combined_similarity": combined,
                            "llm_suggestion": llm_result["suggestion"],
                            "recommended_canonical": llm_result["canonical"]
                        })

        # 類似度でソート
        candidates.sort(key=lambda x: x['combined_similarity'], reverse=True)

        return candidates

    def llm_judge_variant_pair(self, term1: str, term2: str) -> Dict:
        """
        LLMで2つの用語が表記揺れかどうかを判定

        Args:
            term1: 用語1
            term2: 用語2

        Returns:
            {"suggestion": "variant" or "different", "canonical": "...", "reason": "..."}
        """
        prompt = f"""あなたは化学・生物学分野の専門家です。
以下の2つの用語が同じ物質の表記揺れなのか、それとも異なる物質なのかを判定してください。

用語1: {term1}
用語2: {term2}

判定基準:
1. 化学式の表記違い（例: NaOH と 水酸化ナトリウム）→ 表記揺れ
2. 同義語・別名（例: エタノール と エチルアルコール）→ 表記揺れ
3. 部分一致（例: HbA1c と HbA1c捕捉抗体）→ 異なる物質
4. 明らかに異なる物質 → 異なる物質

出力形式（JSON）:
{{
  "suggestion": "variant" または "different",
  "canonical": "表記揺れの場合、推奨する正規化名（より正式な名称）",
  "reason": "判定理由"
}}
"""

        try:
            response = self.llm.invoke(prompt)
            content = response.content

            # JSONパース
            import json
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            result = json.loads(content)

            return {
                'suggestion': result.get('suggestion', 'different'),
                'canonical': result.get('canonical', ''),
                'reason': result.get('reason', '')
            }

        except Exception as e:
            print(f"LLM判定に失敗: {e}")
            return {
                'suggestion': 'different',
                'canonical': '',
                'reason': f'LLM判定エラー: {e}'
            }

    def analyze_note(self, note_id: str, note_content: str) -> Dict:
        """
        実験ノートを分析し、新出単語を抽出

        Args:
            note_id: ノートID
            note_content: ノートの全文

        Returns:
            分析結果 {
                "note_id": "...",
                "materials_section": "...",
                "all_terms": [...],
                "new_terms": [
                    {
                        "term": "...",
                        "similar_candidates": [...],
                        "llm_suggestion": {...}
                    },
                    ...
                ]
            }
        """
        # 材料セクションを抽出
        materials_section = self.extract_materials_section(note_content)
        if not materials_section:
            return {
                'note_id': note_id,
                'materials_section': None,
                'all_terms': [],
                'new_terms': []
            }

        # 用語を抽出
        all_terms = self.extract_terms_from_text(materials_section)

        # 新出単語を抽出
        new_terms_list = self.find_new_terms(all_terms)

        # 各新出単語について類似候補とLLM判定を取得
        new_terms_analysis = []
        for term in new_terms_list:
            similar_candidates = self.find_similar_candidates(term)
            llm_suggestion = self.analyze_with_llm(term, similar_candidates)

            new_terms_analysis.append({
                'term': term,
                'similar_candidates': similar_candidates,
                'llm_suggestion': llm_suggestion
            })

        return {
            'note_id': note_id,
            'materials_section': materials_section,
            'all_terms': all_terms,
            'new_terms': new_terms_analysis
        }
