"""
LangGraph Agent for Experiment Notes Search
実験ノート検索用のLangGraphエージェント
プロンプトとモデルを動的に設定可能
"""
import operator
import json
import re
import time
from typing import TypedDict, List, Annotated, Optional

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.messages import HumanMessage, BaseMessage
import cohere

from config import config
from utils import load_master_dict, normalize_text
from prompts import get_default_prompt
from chroma_sync import get_chroma_vectorstore


# --- State定義 ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]

    # 入力データ
    input_purpose: str
    input_materials: str
    input_methods: str

    # 処理データ
    normalized_materials: str
    user_focus_instruction: str
    search_query: str

    # 検索結果
    retrieved_docs: List[str]  # UI表示用の最終選抜（通常: Top 3、評価モード: Top 10）

    iteration: int
    evaluation_mode: bool  # 評価モードフラグ（True: 比較省略、Top10返却）


class SearchAgent:
    """検索エージェント（プロンプト・モデルを動的設定可能）"""

    def __init__(
        self,
        openai_api_key: str,
        cohere_api_key: str,
        embedding_model: str = None,
        llm_model: str = None,
        prompts: dict = None
    ):
        """
        Args:
            openai_api_key: OpenAI APIキー
            cohere_api_key: Cohere APIキー
            embedding_model: Embeddingモデル名
            llm_model: LLMモデル名
            prompts: カスタムプロンプト辞書 {"query_generation": "...", "compare": "..."}
        """
        self.openai_api_key = openai_api_key
        self.cohere_api_key = cohere_api_key

        # モデル設定
        self.embedding_model = embedding_model or config.DEFAULT_EMBEDDING_MODEL
        self.llm_model = llm_model or config.DEFAULT_LLM_MODEL

        # プロンプト設定（カスタムまたはデフォルト）
        self.prompts = prompts or {}

        # Cohere クライアント
        self.cohere_client = cohere.Client(cohere_api_key)

        # 正規化辞書
        self.norm_map, _ = load_master_dict()

        # Embedding関数
        self.embedding_function = OpenAIEmbeddings(
            model=self.embedding_model,
            api_key=self.openai_api_key
        )

        # Vector Store（GCS同期付き）
        self.vectorstore = get_chroma_vectorstore(self.embedding_function)

        # LLM
        self.llm = ChatOpenAI(
            model=self.llm_model,
            temperature=0,
            api_key=self.openai_api_key
        )

        # グラフを構築
        self.graph = self._build_graph()

    def _get_prompt(self, prompt_type: str) -> str:
        """プロンプトを取得（カスタムまたはデフォルト）"""
        return self.prompts.get(prompt_type, get_default_prompt(prompt_type))

    def _normalize_node(self, state: AgentState):
        """正規化ノード"""
        start_time = time.time()
        evaluation_mode = state.get("evaluation_mode", False)

        if evaluation_mode:
            print("\n" + "="*80)
            print("🔬 [評価モード] 性能評価実行中")
            print("="*80)
            print("\n--- 🚀 [1/3] 正規化 & JSON解析 ---")
        else:
            print("\n--- 🚀 [1/4] 正規化 & JSON解析 ---")

        updates = {}
        messages = state.get("messages", [])

        # JSON解析
        if messages:
            last_msg = messages[-1]
            content = ""
            if hasattr(last_msg, "content"):
                content = last_msg.content
            elif isinstance(last_msg, dict):
                content = last_msg.get("content", "")
            else:
                content = str(last_msg)

            if content.strip().startswith("{"):
                try:
                    data = json.loads(content)

                    if data.get("type") == "initial_search":
                        updates["input_purpose"] = data.get("purpose", "")
                        updates["input_materials"] = data.get("materials", "")
                        updates["input_methods"] = data.get("methods", "")

                        # 初回検索時のデフォルト指示
                        updates["user_focus_instruction"] = (
                            "使用されている材料(化学物質、容量）と、方法（化学物質、容量、手順）の記述が"
                            "類似している実験ノートを最優先して検索してください。"
                        )

                    elif data.get("type") == "refinement":
                        updates["user_focus_instruction"] = data.get("instruction", "")
                        updates["input_purpose"] = data.get("purpose", "")
                        updates["input_materials"] = data.get("materials", "")
                        updates["input_methods"] = data.get("methods", "")

                except json.JSONDecodeError:
                    print("  > ⚠️ JSON Decode Error")

        # 正規化処理
        raw_materials = updates.get("input_materials", state.get("input_materials", ""))
        normalized_parts = []

        if raw_materials:
            lines = raw_materials.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                parts = re.split(r'[:：]', line, 1)

                if len(parts) == 2:
                    left_part = parts[0]
                    amount_part = parts[1]
                    raw_name = re.sub(r'^[-・\s]*[①-⑨0-9.]*\s*', '', left_part).strip()
                    norm_name = normalize_text(raw_name, self.norm_map)
                    normalized_parts.append(f"- {norm_name}: {amount_part.strip()}")
                else:
                    clean_line = re.sub(r'^[-・\s]*[①-⑨0-9.]*\s*', '', line).strip()
                    norm_name = normalize_text(clean_line, self.norm_map)
                    normalized_parts.append(norm_name)

        normalized_str = "\n".join(normalized_parts) if normalized_parts else raw_materials
        updates["normalized_materials"] = normalized_str

        # 評価モード時に入力情報を詳細表示
        if evaluation_mode:
            print("\n  📋 [入力情報]")
            print(f"  目的: {updates.get('input_purpose', state.get('input_purpose', ''))}")
            print(f"  材料: {updates.get('input_materials', state.get('input_materials', ''))}")
            print(f"  実験手法: {updates.get('input_methods', state.get('input_methods', ''))}")
            print(f"  重点指示: {updates.get('user_focus_instruction', state.get('user_focus_instruction', ''))}")
            print(f"\n  📝 [正規化後の材料]")
            print(f"  {normalized_str}")

        elapsed_time = time.time() - start_time
        print(f"  ⏱️ Execution Time: {elapsed_time:.4f} sec")
        return updates

    def _generate_query_node(self, state: AgentState):
        """クエリ生成ノード"""
        start_time = time.time()
        evaluation_mode = state.get("evaluation_mode", False)

        if evaluation_mode:
            print("\n--- 🧠 [2/3] 多角的検索クエリ生成 ---")
        else:
            print("--- 🧠 [2/4] 多角的検索クエリ生成 ---")

        instruction = state.get('user_focus_instruction', '特になし')

        # カスタムプロンプトまたはデフォルトプロンプトを取得
        prompt_template = self._get_prompt("query_generation")

        # プロンプトに変数を埋め込む
        prompt = prompt_template.format(
            input_purpose=state.get('input_purpose'),
            normalized_materials=state.get('normalized_materials'),
            input_methods=state.get('input_methods'),
            user_focus_instruction=instruction
        )

        response = self.llm.invoke(prompt)

        content = response.content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()

        try:
            data = json.loads(content)
            queries = data.get("queries", [])
            if not queries:
                raise ValueError("Empty queries")

            combined_query = " ".join(queries)

            # 評価モード時はクエリ全体を表示
            if evaluation_mode:
                print(f"\n  🔍 [生成されたクエリ]")
                print(f"  統合クエリ（{len(queries)}個のクエリを結合）:")
                print(f"  {combined_query}")
                print(f"\n  各クエリの詳細:")
                for i, q in enumerate(queries, 1):
                    print(f"    {i}. {q}")
            else:
                print(f"  > Generated Query: {combined_query[:100]}...")

        except Exception as e:
            print(f"  > ⚠️ Query Parse Error: {e}")
            combined_query = f"{state.get('input_purpose')} {state.get('normalized_materials')} {instruction}"

        elapsed_time = time.time() - start_time
        print(f"  ⏱️ Execution Time: {elapsed_time:.4f} sec")
        return {"search_query": combined_query}

    def _search_node(self, state: AgentState):
        """検索 & Cohereリランキングノード"""
        start_time = time.time()
        evaluation_mode = state.get("evaluation_mode", False)

        if evaluation_mode:
            print("--- 🔍 [3/3] 検索 & Cohereリランキング実行（評価モード）---")
        else:
            print("--- 🔍 [3/4] 検索 & Cohereリランキング実行 ---")

        query = state["search_query"]

        try:
            # ベクトル検索
            candidates = self.vectorstore.similarity_search(query, k=config.VECTOR_SEARCH_K)

            if not candidates:
                print("  > No candidates found in vector search.")
                print(f"  ⏱️ Execution Time: {time.time() - start_time:.4f} sec")
                return {"retrieved_docs": [], "iteration": state.get("iteration", 0) + 1}

            print(f"  > Vector Search: Retrieved {len(candidates)} candidates.")

            # Cohere Rerank
            documents_content = [doc.page_content for doc in candidates]

            rerank_results = self.cohere_client.rerank(
                model=config.DEFAULT_RERANK_MODEL,
                query=query,
                documents=documents_content,
                top_n=config.RERANK_TOP_N
            )

            if evaluation_mode:
                print(f"\n  📊 [リランキング結果] Top {config.RERANK_TOP_N} 件")
                print(f"  " + "="*76)
            else:
                print(f"\n  📊 [Console Log] Top {config.RERANK_TOP_N} Cohere Rerank Results:")
                print(f"  --------------------------------------------------")

            docs_for_ui = []

            # 評価モードなら全件（Top10）、通常モードなら上位3件のみ
            display_limit = config.RERANK_TOP_N if evaluation_mode else config.UI_DISPLAY_TOP_N

            for i, result in enumerate(rerank_results.results):
                original_doc = candidates[result.index]
                source_id = original_doc.metadata.get('source', 'unknown')
                score = result.relevance_score
                snippet = original_doc.page_content[:50].replace('\n', ' ')

                if evaluation_mode:
                    print(f"  Rank {i+1:2d} | Score: {score:.6f} | ノートID: {source_id}")
                else:
                    print(f"  Rank {i+1:2d} | Score: {score:.4f} | ID: {source_id} | {snippet}...")

                # 評価モードなら全件、通常モードなら上位3件のみ保存
                if i < display_limit:
                    docs_for_ui.append(f"【実験ノートID: {source_id}】\n{original_doc.page_content}")

            if evaluation_mode:
                print(f"  " + "="*76)
                print(f"  ✅ 評価用に上位 {len(docs_for_ui)} 件を返却します。")
            else:
                print(f"  --------------------------------------------------")
                print(f"  > UI向けに上位 {len(docs_for_ui)} 件を選択しました。")

        except Exception as e:
            print(f"  > ⚠️ Search/Rerank Error: {e}")
            docs_for_ui = []

        elapsed_time = time.time() - start_time
        print(f"  ⏱️ Execution Time: {elapsed_time:.4f} sec")

        # 評価モード時は終了メッセージを表示
        if evaluation_mode:
            print("\n" + "="*80)
            print("✅ 評価モード終了 - 比較ノードをスキップして結果を返却します")
            print("="*80 + "\n")

        return {
            "retrieved_docs": docs_for_ui,
            "iteration": state.get("iteration", 0) + 1
        }

    def _compare_node(self, state: AgentState):
        """比較・要約生成ノード"""
        start_time = time.time()
        print("--- 📝 [4/4] 比較・要約生成 (Deep Analysis) ---")

        input_purpose = state.get('input_purpose')
        input_materials = state.get('normalized_materials')
        input_methods = state.get('input_methods')
        instruction = state.get('user_focus_instruction', '')

        docs_str = "\n\n".join(state.get("retrieved_docs", []))

        if not docs_str:
            print(f"  ⏱️ Execution Time: {time.time() - start_time:.4f} sec")
            return {"messages": [HumanMessage(content="該当するノートが見つかりませんでした。")]}

        # カスタムプロンプトまたはデフォルトプロンプトを取得
        prompt_template = self._get_prompt("compare")

        # プロンプトに変数を埋め込む
        prompt = prompt_template.format(
            input_purpose=input_purpose,
            normalized_materials=input_materials,
            input_methods=input_methods,
            user_focus_instruction=instruction,
            retrieved_docs=docs_str
        )

        response = self.llm.invoke(prompt)

        elapsed_time = time.time() - start_time
        print(f"  ⏱️ Execution Time: {elapsed_time:.4f} sec")
        return {"messages": [response]}

    def _should_compare(self, state: AgentState):
        """compareノードに進むべきかを判定"""
        evaluation_mode = state.get("evaluation_mode", False)
        if evaluation_mode:
            return END
        else:
            return "compare"

    def _build_graph(self):
        """グラフを構築"""
        workflow = StateGraph(AgentState)

        workflow.add_node("normalize", self._normalize_node)
        workflow.add_node("generate_query", self._generate_query_node)
        workflow.add_node("search", self._search_node)
        workflow.add_node("compare", self._compare_node)

        workflow.set_entry_point("normalize")
        workflow.add_edge("normalize", "generate_query")
        workflow.add_edge("generate_query", "search")

        # 評価モードならcompareをスキップ
        workflow.add_conditional_edges(
            "search",
            self._should_compare,
            {
                "compare": "compare",
                END: END
            }
        )
        workflow.add_edge("compare", END)

        return workflow.compile()

    def run(self, input_data: dict, evaluation_mode: bool = False):
        """エージェントを実行

        Args:
            input_data: 検索条件（purpose, materials, methods等）
            evaluation_mode: 評価モード（True: 比較省略、Top10返却、False: 通常動作）
        """
        initial_state = {
            "messages": [HumanMessage(content=json.dumps(input_data, ensure_ascii=False))],
            "input_purpose": "",
            "input_materials": "",
            "input_methods": "",
            "normalized_materials": "",
            "user_focus_instruction": "",
            "search_query": "",
            "retrieved_docs": [],
            "iteration": 0,
            "evaluation_mode": evaluation_mode
        }

        result = self.graph.invoke(initial_state)
        return result
