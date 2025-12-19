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

    def extract_terms_from_text(self, text: str) -> List[str]:
        """
        テキストから化学物質名・試薬名を抽出

        Args:
            text: 抽出元のテキスト

        Returns:
            抽出された用語のリスト
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
            terms = data.get('terms', [])

            # 重複削除、空文字列除去
            terms = list(set([t.strip() for t in terms if t.strip()]))

            return terms

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
