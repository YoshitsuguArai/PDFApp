from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from datetime import datetime
from dotenv import load_dotenv
from pdf_processor import PDFProcessor
from search_engine import HybridSearchEngine
import openai

load_dotenv()

app = FastAPI(title="PDF Search API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバルインスタンス
pdf_processor = PDFProcessor(upload_dir="backend/uploads")
search_engine = HybridSearchEngine()

# OpenAI クライアント
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class SearchQuery(BaseModel):
    query: str
    top_k: Optional[int] = 5
    search_type: Optional[str] = "hybrid"  # "semantic", "keyword", "hybrid"

class SearchResult(BaseModel):
    content: str
    score: float
    source: str
    page: Optional[int] = None
    search_type: Optional[str] = None

class FileSearchResult(BaseModel):
    source: str
    score: float
    max_score: float
    avg_score: float
    chunk_count: int
    best_chunk: str
    pages: List[int]
    search_type: str

class GenerateDocumentRequest(BaseModel):
    search_results: List[FileSearchResult]
    document_type: str  # "summary", "report", "presentation"
    query: str
    custom_prompt: Optional[str] = None

class GeneratedDocument(BaseModel):
    content: str
    document_type: str
    source_files: List[str]
    generated_at: str
    query: str

@app.get("/")
async def root():
    return {"message": "PDF Search API"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        print(f"Starting upload process for: {file.filename}")
        
        # ファイルを保存
        file_path = os.path.join(pdf_processor.upload_dir, file.filename)
        print(f"Saving file to: {file_path}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"File saved successfully")
        
        # PDFを処理してチャンクに分割
        print("Processing PDF and creating chunks...")
        chunks = pdf_processor.process_pdf_file(file_path)
        print(f"Created {len(chunks)} chunks")
        
        # 検索エンジンにドキュメントを追加
        print("Adding documents to search engine...")
        print(f"Total chunks to add: {len(chunks)}")
        search_engine.add_documents(chunks)
        print("Documents added successfully")
        
        return {
            "message": f"File {file.filename} uploaded and processed successfully",
            "chunks_created": len(chunks),
            "total_documents": search_engine.get_document_count()
        }
    
    except Exception as e:
        print(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"処理エラー: {str(e)}")

@app.post("/search", response_model=List[SearchResult])
async def search_documents(query: SearchQuery):
    try:
        if query.search_type == "semantic":
            results = search_engine.semantic_search(query.query, query.top_k)
        elif query.search_type == "keyword":
            results = search_engine.keyword_search(query.query, query.top_k)
        else:  # hybrid
            results = search_engine.hybrid_search(query.query, query.top_k)
        
        return [SearchResult(**result) for result in results]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"検索エラー: {str(e)}")

@app.post("/search/files", response_model=List[FileSearchResult])
async def search_files(query: SearchQuery):
    try:
        if query.search_type == "semantic":
            results = search_engine.semantic_search_by_file(query.query, query.top_k)
        elif query.search_type == "keyword":
            results = search_engine.keyword_search_by_file(query.query, query.top_k)
        else:  # hybrid
            results = search_engine.hybrid_search_by_file(query.query, query.top_k)
        
        return [FileSearchResult(**result) for result in results]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ファイル検索エラー: {str(e)}")

@app.get("/documents/count")
async def get_document_count():
    return {"count": search_engine.get_document_count()}

@app.get("/debug/sample-chunks/{filename}")
async def get_sample_chunks(filename: str, limit: int = 5):
    """デバッグ用：指定ファイルのサンプルチャンクを表示"""
    try:
        safe_filename = os.path.basename(filename)
        chunks = search_engine.get_documents_by_source(safe_filename)
        
        sample_chunks = chunks[:limit]
        return {
            "filename": safe_filename,
            "total_chunks": len(chunks),
            "sample_chunks": [
                {
                    "id": chunk["id"],
                    "page": chunk["page"],
                    "content_preview": chunk["content"][:200] + "..." if len(chunk["content"]) > 200 else chunk["content"],
                    "content_length": len(chunk["content"])
                }
                for chunk in sample_chunks
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"チャンク取得エラー: {str(e)}")

@app.post("/debug/test-search")
async def test_search(query: dict):
    """デバッグ用：検索の詳細情報を返す"""
    try:
        search_query = query.get("query", "")
        
        # 各検索手法を個別にテスト
        semantic_results = search_engine.semantic_search(search_query, 5)
        keyword_results = search_engine.keyword_search(search_query, 5)
        hybrid_results = search_engine.hybrid_search(search_query, 5)
        
        return {
            "query": search_query,
            "total_documents": search_engine.get_document_count(),
            "semantic_results": [
                {
                    "score": r["score"],
                    "source": r["source"],
                    "page": r["page"],
                    "content_preview": r["content"][:100] + "..."
                }
                for r in semantic_results
            ],
            "keyword_results": [
                {
                    "score": r["score"], 
                    "source": r["source"],
                    "page": r["page"],
                    "content_preview": r["content"][:100] + "..."
                }
                for r in keyword_results
            ],
            "hybrid_results": [
                {
                    "score": r["score"],
                    "source": r["source"], 
                    "page": r["page"],
                    "content_preview": r["content"][:100] + "..."
                }
                for r in hybrid_results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"テスト検索エラー: {str(e)}")

@app.get("/documents")
async def get_documents():
    """アップロードされたPDFファイル一覧を取得"""
    try:
        sources = search_engine.get_document_sources()
        documents_info = []
        
        for source in sources:
            file_path = os.path.join(pdf_processor.upload_dir, source)
            file_exists = os.path.exists(file_path)
            file_size = os.path.getsize(file_path) if file_exists else 0
            doc_count = len(search_engine.get_documents_by_source(source))
            
            documents_info.append({
                "filename": source,
                "file_exists": file_exists,
                "file_size": file_size,
                "document_chunks": doc_count
            })
        
        return {
            "documents": documents_info,
            "total_files": len(sources),
            "total_chunks": search_engine.get_document_count()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ファイル一覧取得エラー: {str(e)}")

@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """指定されたPDFファイルとそのドキュメントを削除"""
    try:
        # セキュリティのためパスを正規化
        safe_filename = os.path.basename(filename)
        file_path = os.path.join(pdf_processor.upload_dir, safe_filename)
        
        # 検索エンジンからドキュメントを削除
        removed_count = search_engine.remove_documents_by_source(safe_filename)
        
        # PDFファイルを削除
        file_deleted = False
        if os.path.exists(file_path):
            os.remove(file_path)
            file_deleted = True
        
        if removed_count > 0 or file_deleted:
            return {
                "message": f"File {safe_filename} and its documents deleted successfully",
                "file_deleted": file_deleted,
                "documents_removed": removed_count,
                "remaining_documents": search_engine.get_document_count()
            }
        else:
            raise HTTPException(status_code=404, detail=f"File {safe_filename} not found")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"削除エラー: {str(e)}")

@app.delete("/documents")
async def clear_documents():
    """すべてのドキュメントとPDFファイルをクリア"""
    try:
        # すべてのPDFファイルを削除
        upload_dir = pdf_processor.upload_dir
        deleted_files = []
        if os.path.exists(upload_dir):
            for filename in os.listdir(upload_dir):
                if filename.endswith('.pdf'):
                    file_path = os.path.join(upload_dir, filename)
                    os.remove(file_path)
                    deleted_files.append(filename)
        
        # データベースをクリア
        search_engine.clear_database()
        
        return {
            "message": "All documents and files cleared successfully",
            "files_deleted": deleted_files,
            "count": len(deleted_files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"クリアエラー: {str(e)}")

@app.get("/pdf/{filename}")
async def get_pdf(filename: str):
    """PDFファイルを返す"""
    # セキュリティのためパスを正規化
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(pdf_processor.upload_dir, safe_filename)
    
    # デバッグ情報を追加
    print(f"Looking for PDF: {safe_filename}")
    print(f"Full path: {file_path}")
    print(f"File exists: {os.path.exists(file_path)}")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"PDF file not found: {safe_filename} at {file_path}")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=safe_filename
    )

def get_document_generation_prompt(document_type: str, query: str, search_results: List[FileSearchResult], custom_prompt: Optional[str] = None) -> str:
    """ドキュメント生成用のプロンプトを作成"""
    
    # 検索結果から詳細なコンテンツを取得
    detailed_content = []
    source_files = []
    
    for result in search_results:
        source_files.append(result.source)
        # 各ファイルの詳細チャンクを取得
        file_chunks = search_engine.get_documents_by_source(result.source)
        # 関連性の高いチャンクを抽出（スコアでソート）
        relevant_chunks = []
        for chunk in file_chunks:
            if any(page in result.pages for page in [chunk.get('page', 0)]):
                relevant_chunks.append(chunk)
        
        # 最大3チャンクまで
        for chunk in relevant_chunks[:3]:
            detailed_content.append(f"【{result.source} - ページ{chunk.get('page', '?')}】\n{chunk['content']}")
    
    # ドキュメントタイプ別のプロンプト
    type_prompts = {
        "summary": """以下の検索結果を基に、簡潔で分かりやすい要約レポートを作成してください。

**要求事項:**
- 主要なポイントを3-5個にまとめる
- 各ポイントは具体的な根拠を含める
- 読みやすい構造（見出し、箇条書きを活用）
- 重要な数値やデータがあれば強調""",

        "report": """以下の検索結果を基に、詳細な分析レポートを作成してください。

**要求事項:**
- 背景・現状分析
- 主要な発見事項と考察
- 課題と提言
- 参考データの明示
- 論理的な構成と客観的な分析""",

        "presentation": """以下の検索結果を基に、プレゼンテーション用の資料を作成してください。

**要求事項:**
- スライド構成で作成（各セクションを明確に区分）
- 要点を視覚的に分かりやすく整理
- 聴衆が理解しやすい流れ
- 重要なポイントは強調表示
- 各スライドにタイトルを付ける"""
    }
    
    base_prompt = type_prompts.get(document_type, type_prompts["summary"])
    
    content_text = "\n\n".join(detailed_content)
    
    prompt = f"""{base_prompt}

**検索クエリ:** {query}

**参考資料:**
{content_text}

**カスタム指示:**
{custom_prompt if custom_prompt else "特になし"}

**出力形式:** Markdown形式で見やすく整理してください。"""

    return prompt

@app.post("/generate-document", response_model=GeneratedDocument)
async def generate_document(request: GenerateDocumentRequest):
    """検索結果を基にAI資料を生成"""
    try:
        if not request.search_results:
            raise HTTPException(status_code=400, detail="検索結果が提供されていません")
        
        # プロンプトを生成
        prompt = get_document_generation_prompt(
            request.document_type,
            request.query,
            request.search_results,
            request.custom_prompt
        )
        
        # OpenAI APIで資料生成
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "あなたは優秀な資料作成アシスタントです。提供された情報を基に、正確で分かりやすい資料を作成してください。情報の出典を明記し、客観的で論理的な内容にしてください。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=3000,
            temperature=0.3
        )
        
        generated_content = response.choices[0].message.content
        source_files = list(set([result.source for result in request.search_results]))
        
        return GeneratedDocument(
            content=generated_content,
            document_type=request.document_type,
            source_files=source_files,
            generated_at=datetime.now().isoformat(),
            query=request.query
        )
        
    except Exception as e:
        print(f"Document generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"資料生成エラー: {str(e)}")

@app.get("/favicon.ico")
async def favicon():
    """Faviconリクエストを無視"""
    raise HTTPException(status_code=204, detail="No favicon")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9000)