from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from dotenv import load_dotenv
from pdf_processor import PDFProcessor
from search_engine import HybridSearchEngine

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

@app.get("/documents/count")
async def get_document_count():
    return {"count": search_engine.get_document_count()}

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

@app.get("/favicon.ico")
async def favicon():
    """Faviconリクエストを無視"""
    raise HTTPException(status_code=204, detail="No favicon")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9000)