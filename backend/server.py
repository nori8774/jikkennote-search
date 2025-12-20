"""
FastAPI Server for Experiment Notes Search System
実験ノート検索システムのメインAPIサーバー
"""
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
import json
import re

from config import config
from agent import SearchAgent
from prompts import get_all_default_prompts
from ingest import ingest_notes
from dictionary import get_dictionary_manager
from term_extractor import TermExtractor
from history import get_history_manager
from evaluation import get_evaluator

app = FastAPI(
    title="実験ノート検索システム API",
    version="2.0.0",
    description="LangChainを活用した高精度な実験ノート検索システム"
)

# CORS設定
# 環境変数からCORS originsを取得（カンマ区切り）
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Request/Response Models ===

class HealthResponse(BaseModel):
    status: str
    message: str
    version: str
    config: dict


class FolderPathsRequest(BaseModel):
    notes_new: Optional[str] = None
    notes_archive: Optional[str] = None
    chroma_db: Optional[str] = None


class FolderPathsResponse(BaseModel):
    success: bool
    message: str
    paths: dict


class SearchRequest(BaseModel):
    purpose: str
    materials: str
    methods: str
    type: str = "initial_search"
    instruction: Optional[str] = ""
    openai_api_key: str
    cohere_api_key: str
    embedding_model: Optional[str] = None
    llm_model: Optional[str] = None
    custom_prompts: Optional[Dict[str, str]] = None


class SearchResponse(BaseModel):
    success: bool
    message: str
    retrieved_docs: List[str]
    normalized_materials: Optional[str] = None
    search_query: Optional[str] = None


class PromptsResponse(BaseModel):
    success: bool
    prompts: Dict[str, dict]


class IngestRequest(BaseModel):
    openai_api_key: str
    source_folder: Optional[str] = None
    post_action: str = 'keep'  # 'delete', 'archive', 'keep'
    archive_folder: Optional[str] = None
    embedding_model: Optional[str] = None


class IngestResponse(BaseModel):
    success: bool
    message: str
    new_notes: List[str]
    skipped_notes: List[str]


class NoteResponse(BaseModel):
    success: bool
    note: Optional[Dict] = None
    error: Optional[str] = None


class AnalyzeRequest(BaseModel):
    note_ids: List[str]
    note_contents: List[str]  # ノートIDに対応する全文コンテンツ
    openai_api_key: str


class AnalyzeResponse(BaseModel):
    success: bool
    new_terms: List[Dict]


class DictionaryUpdateRequest(BaseModel):
    updates: List[Dict]  # [{"term": "...", "decision": "new" or "variant", "canonical": "...", ...}, ...]


class DictionaryUpdateResponse(BaseModel):
    success: bool
    message: str
    updated_entries: int


class DictionaryResponse(BaseModel):
    success: bool
    entries: List[Dict]


class HistoryRequest(BaseModel):
    query: Dict[str, str]
    results: List[Dict]
    normalized_materials: Optional[str] = None
    search_query: Optional[str] = None


class HistoryResponse(BaseModel):
    success: bool
    history_id: str


class HistoryListResponse(BaseModel):
    success: bool
    histories: List[Dict]
    total: int


class TestCaseImportRequest(BaseModel):
    file_type: str  # 'csv' or 'excel'


class TestCaseResponse(BaseModel):
    success: bool
    test_cases: List[Dict]


class EvaluateRequest(BaseModel):
    test_case_id: str
    openai_api_key: str
    cohere_api_key: str
    embedding_model: Optional[str] = None
    llm_model: Optional[str] = None


class EvaluateResponse(BaseModel):
    success: bool
    metrics: Dict
    ranking: List[Dict]
    comparison: List[Dict]


class BatchEvaluateRequest(BaseModel):
    test_case_ids: List[str]
    openai_api_key: str
    cohere_api_key: str
    embedding_model: Optional[str] = None
    llm_model: Optional[str] = None


class BatchEvaluateResponse(BaseModel):
    success: bool
    average_metrics: Dict
    individual_results: List[Dict]


# === Endpoints ===

@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "実験ノート検索システム API",
        "version": "2.0.0",
        "status": "Phase 1: 基盤整備中",
        "endpoints": {
            "health": "/health - ヘルスチェック",
            "config": "/config/folders - フォルダパス設定",
            "search": "/search - 実験ノート検索",
            "prompts": "/prompts - デフォルトプロンプト取得",
            "ingest": "/ingest - ノート取り込み",
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """ヘルスチェックエンドポイント"""
    config.ensure_folders()

    return HealthResponse(
        status="healthy",
        message="Server is running",
        version="2.0.0",
        config={
            "notes_new": config.NOTES_NEW_FOLDER,
            "notes_archive": config.NOTES_ARCHIVE_FOLDER,
            "chroma_db": config.CHROMA_DB_FOLDER,
            "master_dict": config.MASTER_DICTIONARY_PATH,
        }
    )


@app.post("/config/folders", response_model=FolderPathsResponse)
async def update_folder_paths(request: FolderPathsRequest):
    """フォルダパス設定を更新"""
    try:
        config.update_folder_paths(
            notes_new=request.notes_new,
            notes_archive=request.notes_archive,
            chroma_db=request.chroma_db
        )

        return FolderPathsResponse(
            success=True,
            message="フォルダパス設定を更新しました",
            paths={
                "notes_new": config.NOTES_NEW_FOLDER,
                "notes_archive": config.NOTES_ARCHIVE_FOLDER,
                "chroma_db": config.CHROMA_DB_FOLDER,
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"フォルダパス更新エラー: {str(e)}"
        )


@app.get("/config/folders")
async def get_folder_paths():
    """現在のフォルダパス設定を取得"""
    return {
        "success": True,
        "paths": {
            "notes_new": config.NOTES_NEW_FOLDER,
            "notes_archive": config.NOTES_ARCHIVE_FOLDER,
            "chroma_db": config.CHROMA_DB_FOLDER,
            "master_dict": config.MASTER_DICT_PATH,
        }
    }


@app.post("/search", response_model=SearchResponse)
async def search_experiments(request: SearchRequest):
    """実験ノート検索"""
    try:
        # エージェント初期化
        agent = SearchAgent(
            openai_api_key=request.openai_api_key,
            cohere_api_key=request.cohere_api_key,
            embedding_model=request.embedding_model,
            llm_model=request.llm_model,
            prompts=request.custom_prompts
        )

        # 検索実行
        input_data = {
            "type": request.type,
            "purpose": request.purpose,
            "materials": request.materials,
            "methods": request.methods,
            "instruction": request.instruction
        }

        result = agent.run(input_data)

        # 結果から最後のメッセージを取得
        final_message = ""
        if result.get("messages"):
            last_msg = result["messages"][-1]
            if hasattr(last_msg, "content"):
                final_message = last_msg.content
            else:
                final_message = str(last_msg)

        return SearchResponse(
            success=True,
            message=final_message,
            retrieved_docs=result.get("retrieved_docs", []),
            normalized_materials=result.get("normalized_materials", ""),
            search_query=result.get("search_query", "")
        )

    except Exception as e:
        print(f"Error in search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"検索エラー: {str(e)}")


@app.get("/prompts", response_model=PromptsResponse)
async def get_default_prompts():
    """デフォルトプロンプトを取得"""
    try:
        prompts = get_all_default_prompts()
        return PromptsResponse(
            success=True,
            prompts=prompts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"プロンプト取得エラー: {str(e)}")


@app.post("/ingest", response_model=IngestResponse)
async def ingest_notes_endpoint(request: IngestRequest):
    """ノート取り込み（増分更新）"""
    try:
        new_notes, skipped_notes = ingest_notes(
            api_key=request.openai_api_key,
            source_folder=request.source_folder,
            post_action=request.post_action,
            archive_folder=request.archive_folder,
            embedding_model=request.embedding_model
        )

        return IngestResponse(
            success=True,
            message=f"{len(new_notes)}件の新規ノートを追加しました。{len(skipped_notes)}件はスキップされました。",
            new_notes=new_notes,
            skipped_notes=skipped_notes
        )

    except Exception as e:
        print(f"Error in ingest: {str(e)}")
        raise HTTPException(status_code=500, detail=f"ノート取り込みエラー: {str(e)}")


@app.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str):
    """実験ノートを取得"""
    try:
        # ノートファイルを検索（notes_new または notes_archive から）
        note_file = None
        for folder in [config.NOTES_NEW_FOLDER, config.NOTES_ARCHIVE_FOLDER]:
            potential_file = os.path.join(folder, f"{note_id}.md")
            if os.path.exists(potential_file):
                note_file = potential_file
                break

        if not note_file:
            return NoteResponse(
                success=False,
                error=f"ノートが見つかりません: {note_id}"
            )

        # ファイルを読み込み
        with open(note_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # セクションを抽出
        def extract_section(pattern: str, text: str) -> Optional[str]:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            return match.group(1).strip() if match else None

        sections = {
            'purpose': extract_section(r'##\s*目的[・･]?背景\s*\n(.*?)(?:\n##|$)', content),
            'materials': extract_section(r'##\s*材料\s*\n(.*?)(?:\n##|$)', content),
            'methods': extract_section(r'##\s*方法\s*\n(.*?)(?:\n##|$)', content),
            'results': extract_section(r'##\s*結果\s*\n(.*?)(?:\n##|$)', content),
        }

        return NoteResponse(
            success=True,
            note={
                'id': note_id,
                'content': content,
                'sections': sections
            }
        )

    except Exception as e:
        print(f"Error in get_note: {str(e)}")
        return NoteResponse(
            success=False,
            error=f"ノート読み込みエラー: {str(e)}"
        )


@app.post("/ingest/analyze", response_model=AnalyzeResponse)
async def analyze_new_terms(request: AnalyzeRequest):
    """新出単語を分析"""
    try:
        dict_manager = get_dictionary_manager()
        extractor = TermExtractor(dict_manager, request.openai_api_key)

        all_new_terms = []

        for note_id, note_content in zip(request.note_ids, request.note_contents):
            result = extractor.analyze_note(note_id, note_content)
            if result.get('new_terms'):
                all_new_terms.extend(result['new_terms'])

        return AnalyzeResponse(
            success=True,
            new_terms=all_new_terms
        )

    except Exception as e:
        print(f"Error in analyze: {str(e)}")
        raise HTTPException(status_code=500, detail=f"新出単語分析エラー: {str(e)}")


@app.get("/dictionary", response_model=DictionaryResponse)
async def get_dictionary():
    """正規化辞書の全エントリを取得"""
    try:
        dict_manager = get_dictionary_manager()
        entries = dict_manager.get_all_entries()

        return DictionaryResponse(
            success=True,
            entries=entries
        )

    except Exception as e:
        print(f"Error in get_dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"辞書取得エラー: {str(e)}")


@app.post("/dictionary/update", response_model=DictionaryUpdateResponse)
async def update_dictionary(request: DictionaryUpdateRequest):
    """正規化辞書を更新"""
    try:
        dict_manager = get_dictionary_manager()
        updated_count = 0

        for update in request.updates:
            term = update.get('term')
            decision = update.get('decision')  # 'new' or 'variant'
            canonical = update.get('canonical')
            category = update.get('category')
            note = update.get('note')

            if decision == 'new':
                # 新規物質として登録
                success = dict_manager.add_entry(
                    canonical=term,
                    variants=[],
                    category=category,
                    note=note
                )
                if success:
                    updated_count += 1

            elif decision == 'variant' and canonical:
                # 既存物質の表記揺れとして登録
                success = dict_manager.add_variant(canonical, term)
                if success:
                    updated_count += 1

        return DictionaryUpdateResponse(
            success=True,
            message=f"{updated_count}件のエントリを更新しました",
            updated_entries=updated_count
        )

    except Exception as e:
        print(f"Error in update_dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"辞書更新エラー: {str(e)}")


@app.get("/dictionary/export")
async def export_dictionary(format: str = "yaml"):
    """正規化辞書をエクスポート"""
    try:
        dict_manager = get_dictionary_manager()

        if format == "json":
            content = dict_manager.export_to_json()
            media_type = "application/json"
            filename = "dictionary.json"
        elif format == "csv":
            content = dict_manager.export_to_csv()
            media_type = "text/csv"
            filename = "dictionary.csv"
        else:  # yaml
            with open(config.MASTER_DICTIONARY_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
            media_type = "text/yaml"
            filename = "dictionary.yaml"

        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        print(f"Error in export_dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"辞書エクスポートエラー: {str(e)}")


@app.post("/dictionary/import")
async def import_dictionary(file: UploadFile = File(...)):
    """正規化辞書をインポート"""
    try:
        dict_manager = get_dictionary_manager()
        content = await file.read()
        content_str = content.decode('utf-8')

        filename = file.filename.lower()
        if filename.endswith('.json'):
            success = dict_manager.import_from_json(content_str)
        elif filename.endswith('.csv'):
            success = dict_manager.import_from_csv(content_str)
        elif filename.endswith('.yaml') or filename.endswith('.yml'):
            import yaml
            data = yaml.safe_load(content_str)
            success = dict_manager.import_from_json(data)
        else:
            raise HTTPException(status_code=400, detail="サポートされていないファイル形式です")

        if success:
            return {"success": True, "message": "辞書をインポートしました"}
        else:
            raise HTTPException(status_code=500, detail="辞書のインポートに失敗しました")

    except Exception as e:
        print(f"Error in import_dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"辞書インポートエラー: {str(e)}")


@app.post("/history", response_model=HistoryResponse)
async def add_search_history(request: HistoryRequest):
    """検索履歴を追加"""
    try:
        history_manager = get_history_manager()

        history_id = history_manager.add_history(
            query=request.query,
            results=request.results,
            normalized_materials=request.normalized_materials,
            search_query=request.search_query
        )

        return HistoryResponse(
            success=True,
            history_id=history_id
        )

    except Exception as e:
        print(f"Error in add_history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"履歴追加エラー: {str(e)}")


@app.get("/history", response_model=HistoryListResponse)
async def get_search_histories(limit: int = 50, offset: int = 0, keyword: Optional[str] = None):
    """検索履歴を取得"""
    try:
        history_manager = get_history_manager()

        if keyword:
            histories = history_manager.search_histories(keyword=keyword)
        else:
            histories = history_manager.get_all_histories(limit=limit, offset=offset)

        stats = history_manager.get_statistics()

        return HistoryListResponse(
            success=True,
            histories=histories,
            total=stats['total_count']
        )

    except Exception as e:
        print(f"Error in get_histories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"履歴取得エラー: {str(e)}")


@app.get("/history/{history_id}")
async def get_search_history(history_id: str):
    """特定の検索履歴を取得"""
    try:
        history_manager = get_history_manager()
        history = history_manager.get_history(history_id)

        if not history:
            raise HTTPException(status_code=404, detail="履歴が見つかりません")

        from dataclasses import asdict
        return {
            "success": True,
            "history": asdict(history)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"履歴取得エラー: {str(e)}")


@app.delete("/history/{history_id}")
async def delete_search_history(history_id: str):
    """検索履歴を削除"""
    try:
        history_manager = get_history_manager()
        success = history_manager.delete_history(history_id)

        if not success:
            raise HTTPException(status_code=404, detail="履歴が見つかりません")

        return {"success": True, "message": "履歴を削除しました"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in delete_history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"履歴削除エラー: {str(e)}")


@app.get("/evaluate/cases", response_model=TestCaseResponse)
async def get_test_cases():
    """評価用テストケースを取得"""
    try:
        evaluator = get_evaluator()
        test_cases = evaluator.get_all_test_cases()

        return TestCaseResponse(
            success=True,
            test_cases=test_cases
        )

    except Exception as e:
        print(f"Error in get_test_cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"テストケース取得エラー: {str(e)}")


@app.post("/evaluate/import")
async def import_test_cases(file: UploadFile = File(...)):
    """テストケースをインポート（CSV/Excel）"""
    try:
        evaluator = get_evaluator()
        content = await file.read()

        filename = file.filename.lower()
        if filename.endswith('.csv'):
            content_str = content.decode('utf-8')
            count = evaluator.import_from_csv(content_str)
        elif filename.endswith(('.xlsx', '.xls')):
            # 一時ファイルに保存してインポート
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            count = evaluator.import_from_excel(tmp_path)
            os.unlink(tmp_path)
        else:
            raise HTTPException(status_code=400, detail="サポートされていないファイル形式です")

        return {
            "success": True,
            "message": f"{count}件のテストケースをインポートしました",
            "imported_count": count
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in import_test_cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"テストケースインポートエラー: {str(e)}")


@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_rag(request: EvaluateRequest):
    """RAG性能を評価"""
    try:
        evaluator = get_evaluator()

        # テストケースを取得
        test_case = evaluator.get_test_case(request.test_case_id)
        if not test_case:
            raise HTTPException(status_code=404, detail="テストケースが見つかりません")

        # 検索を実行
        agent = SearchAgent(
            openai_api_key=request.openai_api_key,
            cohere_api_key=request.cohere_api_key,
            embedding_model=request.embedding_model,
            llm_model=request.llm_model
        )

        input_data = {
            "type": "initial_search",
            "purpose": test_case.query.get('purpose', ''),
            "materials": test_case.query.get('materials', ''),
            "methods": test_case.query.get('methods', ''),
            "instruction": ""
        }

        result = agent.run(input_data)

        # 検索結果を整形
        retrieved_docs = result.get("retrieved_docs", [])
        retrieved_results = []

        for i, doc in enumerate(retrieved_docs[:10]):
            # ノートIDを抽出（例: "# 実験ノート ID3-14" から "ID3-14" を抽出）
            note_id_match = re.search(r'ID[\d-]+', doc)
            note_id = note_id_match.group(0) if note_id_match else f"unknown_{i+1}"

            retrieved_results.append({
                'note_id': note_id,
                'score': 1.0 - (i * 0.05),  # スコアは仮の値
                'rank': i + 1
            })

        # 評価
        eval_result = evaluator.evaluate(test_case, retrieved_results)

        from dataclasses import asdict
        return EvaluateResponse(
            success=True,
            metrics=asdict(eval_result.metrics),
            ranking=eval_result.ranking,
            comparison=eval_result.comparison
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in evaluate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"評価エラー: {str(e)}")


@app.post("/evaluate/batch", response_model=BatchEvaluateResponse)
async def batch_evaluate_rag(request: BatchEvaluateRequest):
    """バッチ評価"""
    try:
        evaluator = get_evaluator()
        results = []

        for test_case_id in request.test_case_ids:
            # テストケースを取得
            test_case = evaluator.get_test_case(test_case_id)
            if not test_case:
                print(f"テストケースが見つかりません: {test_case_id}")
                continue

            # 検索を実行
            agent = SearchAgent(
                openai_api_key=request.openai_api_key,
                cohere_api_key=request.cohere_api_key,
                embedding_model=request.embedding_model,
                llm_model=request.llm_model
            )

            input_data = {
                "type": "initial_search",
                "purpose": test_case.query.get('purpose', ''),
                "materials": test_case.query.get('materials', ''),
                "methods": test_case.query.get('methods', ''),
                "instruction": ""
            }

            result = agent.run(input_data)

            # 検索結果を整形
            retrieved_docs = result.get("retrieved_docs", [])
            retrieved_results = []

            for i, doc in enumerate(retrieved_docs[:10]):
                note_id_match = re.search(r'ID[\d-]+', doc)
                note_id = note_id_match.group(0) if note_id_match else f"unknown_{i+1}"

                retrieved_results.append({
                    'note_id': note_id,
                    'score': 1.0 - (i * 0.05),
                    'rank': i + 1
                })

            results.append((test_case, retrieved_results))

        # バッチ評価
        batch_result = evaluator.batch_evaluate(results)

        return BatchEvaluateResponse(
            success=True,
            average_metrics=batch_result['average_metrics'],
            individual_results=batch_result['individual_results']
        )

    except Exception as e:
        print(f"Error in batch_evaluate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"バッチ評価エラー: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    print("🚀 実験ノート検索システム API サーバー起動中...")
    print("📍 Server: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("🔧 Phase 4: 履歴・評価機能実装中\n")

    # 必要なフォルダを作成
    config.ensure_folders()

    uvicorn.run(app, host="0.0.0.0", port=8000)
