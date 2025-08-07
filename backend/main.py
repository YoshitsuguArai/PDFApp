from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from datetime import datetime
from dotenv import load_dotenv
from pdf_processor import PDFProcessor
from search_engine import HybridSearchEngine
import openai
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import black, blue
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import tempfile
import urllib.request

load_dotenv()

app = FastAPI(title="Retrieve API", version="1.1.0")

# Remove X-Frame-Options middleware with comprehensive handling
class RemoveXFrameOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Remove X-Frame-Options header in all possible forms
        headers_to_remove = [
            "x-frame-options", 
            "X-Frame-Options", 
            "X-FRAME-OPTIONS",
            "x-Frame-Options"
        ]
        
        for header in headers_to_remove:
            if header in response.headers:
                print(f"[MIDDLEWARE] Removing header: {header}")
                del response.headers[header]
        
        # For PDF endpoints, add explicit frame-allowing headers
        if "/pdf/view/" in str(request.url):
            print(f"[MIDDLEWARE] Adding frame-friendly headers for PDF: {request.url}")
            # Explicitly allow framing
            response.headers["X-Frame-Options"] = "ALLOWALL"
            # Add CSP to allow framing from any origin
            response.headers["Content-Security-Policy"] = "frame-ancestors *;"
            
        print(f"[MIDDLEWARE] Final headers for {request.url}: {dict(response.headers)}")
        return response

# CORS middleware should be added BEFORE the X-Frame-Options removal middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # すべてのオリジンを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Add the X-Frame-Options removal middleware AFTER CORS
app.add_middleware(RemoveXFrameOptionsMiddleware)

# グローバルインスタンス
# 絶対パスで正確に指定
import pathlib
# main.pyの場所を基準にアップロードディレクトリを指定
main_dir = pathlib.Path(__file__).parent  # C:/PDFAI/backend
upload_dir = main_dir / "backend" / "uploads"  # C:/PDFAI/backend/backend/uploads
print(f"[INIT] Main dir: {main_dir}")
print(f"[INIT] Upload dir: {upload_dir}")
print(f"[INIT] Upload dir exists: {upload_dir.exists()}")
pdf_processor = PDFProcessor(upload_dir=str(upload_dir))
search_engine = HybridSearchEngine()

# LM Studio クライアント（ローカルサーバー）
openai_client = openai.OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="not-needed"
)

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
    pdf_filename: Optional[str] = None

@app.get("/")
async def root():
    # Ensure no X-Frame-Options header is set on the root endpoint
    response = Response(content='{"message": "Retrieve API"}', media_type="application/json")
    # Explicitly remove X-Frame-Options if it exists
    if "x-frame-options" in response.headers:
        del response.headers["x-frame-options"]
    if "X-Frame-Options" in response.headers:
        del response.headers["X-Frame-Options"]
    return response

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
    """PDFファイルを返す（ダウンロード用）"""
    # セキュリティのためパスを正規化
    safe_filename = os.path.basename(filename)
    
    # pathlibを使用してクロスプラットフォーム対応
    upload_path = pathlib.Path(pdf_processor.upload_dir)
    file_path = upload_path / safe_filename
    
    # デバッグ情報を追加
    print(f"[DOWNLOAD] Looking for PDF: {safe_filename}")
    print(f"[DOWNLOAD] Full path: {file_path}")
    print(f"[DOWNLOAD] File exists: {file_path.exists()}")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF file not found: {safe_filename} at {file_path}")
    
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=safe_filename
    )

@app.get("/pdf/view/{filename}")
async def view_pdf(filename: str):
    """PDFファイルを返す（ブラウザ表示用）"""
    # セキュリティのためパスを正規化
    safe_filename = os.path.basename(filename)
    
    # pathlibを使用してクロスプラットフォーム対応
    upload_path = pathlib.Path(pdf_processor.upload_dir)
    file_path = upload_path / safe_filename
    
    # デバッグ情報を追加
    print(f"[VIEW] Looking for PDF: {safe_filename}")
    print(f"[VIEW] Upload dir: {pdf_processor.upload_dir}")
    print(f"[VIEW] Full path: {file_path}")
    print(f"[VIEW] File exists: {file_path.exists()}")
    
    if not file_path.exists():
        # 利用可能なファイルもログ出力
        if upload_path.exists():
            available_files = [f.name for f in upload_path.iterdir() if f.is_file()]
            print(f"[VIEW] Available files: {available_files}")
        raise HTTPException(status_code=404, detail=f"PDF file not found: {safe_filename} at {file_path}")
    
    # FileResponseを作成
    response = FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS"
        }
    )
    
    # X-Frame-Optionsヘッダーを明示的に削除し、フレーム許可を設定
    headers_to_remove = ["x-frame-options", "X-Frame-Options", "X-FRAME-OPTIONS"]
    for header in headers_to_remove:
        if header in response.headers:
            print(f"[VIEW] Removing header: {header}")
            del response.headers[header]
    
    # 明示的にフレーミングを許可
    response.headers["X-Frame-Options"] = "ALLOWALL"
    response.headers["Content-Security-Policy"] = "frame-ancestors *;"
    
    print(f"[VIEW] Final response headers: {dict(response.headers)}")
    return response

def get_document_generation_prompt(document_type: str, query: str, search_results: List[FileSearchResult], custom_prompt: Optional[str] = None) -> str:
    """ドキュメント生成用のプロンプトを作成"""
    
    # 検索結果から詳細なコンテンツを取得
    detailed_content = []
    source_files = []
    
    for result in search_results:
        source_files.append(result.source)
        # 各ファイルの詳細チャンクを取得（簡略化）
        file_chunks = search_engine.get_documents_by_source(result.source)
        # 関連性の高いチャンクを抽出（最大1チャンクまで）
        relevant_chunks = []
        for chunk in file_chunks:
            if any(page in result.pages for page in [chunk.get('page', 0)]):
                relevant_chunks.append(chunk)
        
        # 最大1チャンクまでに制限し、内容も短縮
        for chunk in relevant_chunks[:1]:
            content = chunk['content'][:500] + "..." if len(chunk['content']) > 500 else chunk['content']
            detailed_content.append(f"【{result.source}】\n{content}")
    
    # ドキュメントタイプ別のプロンプト（簡略化）
    type_prompts = {
        "summary": "以下の情報を基に簡潔な要約を作成してください。",
        "report": "以下の情報を基に分析レポートを作成してください。",
        "presentation": "以下の情報を基にプレゼン資料を作成してください。"
    }
    
    base_prompt = type_prompts.get(document_type, type_prompts["summary"])
    
    content_text = "\n\n".join(detailed_content)
    
    # コンテンツをさらに短縮（最大2000文字まで）
    if len(content_text) > 2000:
        content_text = content_text[:2000] + "..."
    
    prompt = f"""{base_prompt}

クエリ: {query}

資料:
{content_text}

プレーンテキストで簡潔に回答してください。"""

    return prompt

def create_pdf_document(content: str, document_type: str, query: str, source_files: List[str]) -> str:
    """PDFドキュメントを作成し、ファイルパスを返す"""
    # 日本語フォントを登録
    try:
        # HeiseiMin-W3 (日本語フォント) を登録
        pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))
        japanese_font = 'HeiseiMin-W3'
    except:
        try:
            # 代替フォントとしてHeiseiKakuGo-W5を試す
            pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
            japanese_font = 'HeiseiKakuGo-W5'
        except:
            # どちらも使用できない場合はHelveticaを使用
            japanese_font = 'Helvetica'
    
    # 一時ファイルを作成
    temp_dir = os.path.join("backend", "temp_pdfs")
    os.makedirs(temp_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    pdf_filename = f"{document_type}_{timestamp}.pdf"
    pdf_path = os.path.join(temp_dir, pdf_filename)
    
    # PDFドキュメントを作成
    doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                           rightMargin=2*cm, leftMargin=2*cm,
                           topMargin=2*cm, bottomMargin=2*cm)
    
    # スタイルを設定（日本語フォントを使用）
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=japanese_font,
        fontSize=18,
        spaceAfter=30,
        alignment=1  # center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontName=japanese_font,
        fontSize=14,
        spaceAfter=12,
        spaceBefore=12
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName=japanese_font,
        fontSize=10,
        spaceAfter=12,
        leading=14
    )
    
    # コンテンツを構築
    story = []
    
    # タイトル
    document_titles = {
        "summary": "要約レポート",
        "report": "詳細分析レポート", 
        "presentation": "プレゼンテーション資料"
    }
    title = document_titles.get(document_type, "生成資料")
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 20))
    
    # クエリ情報
    story.append(Paragraph(f"<b>検索クエリ:</b> {query}", normal_style))
    story.append(Paragraph(f"<b>生成日時:</b> {datetime.now().strftime('%Y年%m月%d日 %H:%M')}", normal_style))
    story.append(Paragraph(f"<b>参考資料:</b> {', '.join(source_files)}", normal_style))
    story.append(Spacer(1, 20))
    
    # 区切り線
    story.append(Paragraph("_" * 80, normal_style))
    story.append(Spacer(1, 20))
    
    # メインコンテンツを処理
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            story.append(Spacer(1, 6))
            continue
            
        # 全て大文字の行を見出しとして処理
        if line.isupper() and len(line) > 3:
            story.append(Paragraph(line, heading_style))
        # 数字付きリストを処理
        elif line.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
            story.append(Paragraph(line, normal_style))
        # 記号付きリストを処理
        elif line.startswith('・') or line.startswith('○') or line.startswith('●'):
            story.append(Paragraph(line, normal_style))
        else:
            # 長いテキストを適切に処理
            if len(line) > 100:
                # 長い行を複数の段落に分割
                words = line.split(' ')
                current_line = ""
                for word in words:
                    if len(current_line + word) > 100:
                        if current_line:
                            story.append(Paragraph(current_line.strip(), normal_style))
                        current_line = word + " "
                    else:
                        current_line += word + " "
                if current_line:
                    story.append(Paragraph(current_line.strip(), normal_style))
            else:
                story.append(Paragraph(line, normal_style))
    
    # PDFを構築
    doc.build(story)
    
    return pdf_filename

@app.post("/generate-document")
async def generate_document(request: GenerateDocumentRequest):
    """検索結果を基にPDF資料を生成"""
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
        
        # LM Studio APIで資料生成
        response = openai_client.chat.completions.create(
            model="openai/gpt-oss-20b:2",
            messages=[
                {
                    "role": "system",
                    "content": "あなたは優秀な資料作成アシスタントです。提供された情報を基に、正確で分かりやすい資料を作成してください。情報の出典を明記し、客観的で論理的な内容にしてください。重要：Markdown記法（#、##、**、*、-、```など）は一切使用せず、プレーンテキストで構造化してください。見出しは大文字や改行で区別し、リストは数字や記号で表現してください。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        generated_content = response.choices[0].message.content
        source_files = list(set([result.source for result in request.search_results]))
        
        # PDFを生成
        pdf_filename = create_pdf_document(
            generated_content,
            request.document_type,
            request.query,
            source_files
        )
        
        return GeneratedDocument(
            content=generated_content,
            document_type=request.document_type,
            source_files=source_files,
            generated_at=datetime.now().isoformat(),
            query=request.query,
            pdf_filename=pdf_filename
        )
        
    except Exception as e:
        print(f"Document generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"資料生成エラー: {str(e)}")

@app.get("/generated-pdf/{filename}")
async def get_generated_pdf(filename: str):
    """生成されたPDFファイルを返す"""
    # セキュリティのためパスを正規化
    safe_filename = os.path.basename(filename)
    file_path = os.path.join("backend", "temp_pdfs", safe_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Generated PDF not found: {safe_filename}")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"}
    )

@app.get("/generated-pdfs")
async def get_generated_pdfs():
    """生成されたPDFの履歴を取得"""
    try:
        temp_dir = os.path.join("backend", "temp_pdfs")
        
        if not os.path.exists(temp_dir):
            return {"pdfs": [], "total_count": 0}
        
        pdf_files = []
        for filename in os.listdir(temp_dir):
            if filename.endswith('.pdf'):
                file_path = os.path.join(temp_dir, filename)
                file_stats = os.stat(file_path)
                
                # ファイル名から情報を抽出
                name_parts = filename.replace('.pdf', '').split('_')
                document_type = name_parts[0] if name_parts else "unknown"
                timestamp_str = '_'.join(name_parts[1:]) if len(name_parts) > 1 else ""
                
                # タイムスタンプをパース
                try:
                    created_at = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                    created_at_iso = created_at.isoformat()
                    created_at_display = created_at.strftime("%Y年%m月%d日 %H:%M")
                except:
                    created_at_iso = datetime.fromtimestamp(file_stats.st_ctime).isoformat()
                    created_at_display = datetime.fromtimestamp(file_stats.st_ctime).strftime("%Y年%m月%d日 %H:%M")
                
                # ドキュメントタイプの日本語表示
                type_labels = {
                    "summary": "要約レポート",
                    "report": "詳細分析レポート", 
                    "presentation": "プレゼンテーション資料"
                }
                type_label = type_labels.get(document_type, document_type)
                
                pdf_files.append({
                    "filename": filename,
                    "document_type": document_type,
                    "type_label": type_label,
                    "created_at": created_at_iso,
                    "created_at_display": created_at_display,
                    "file_size": file_stats.st_size,
                    "file_size_mb": round(file_stats.st_size / (1024 * 1024), 2)
                })
        
        # 作成日時の降順でソート
        pdf_files.sort(key=lambda x: x['created_at'], reverse=True)
        
        return {
            "pdfs": pdf_files,
            "total_count": len(pdf_files)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF履歴取得エラー: {str(e)}")

@app.delete("/generated-pdf/{filename}")
async def delete_generated_pdf(filename: str):
    """生成されたPDFファイルを削除"""
    try:
        # セキュリティのためパスを正規化
        safe_filename = os.path.basename(filename)
        file_path = os.path.join("backend", "temp_pdfs", safe_filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"PDF not found: {safe_filename}")
        
        os.remove(file_path)
        
        return {
            "message": f"PDF {safe_filename} deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF削除エラー: {str(e)}")

@app.delete("/generated-pdfs")
async def clear_generated_pdfs():
    """全ての生成されたPDFファイルを削除"""
    try:
        temp_dir = os.path.join("backend", "temp_pdfs")
        deleted_files = []
        
        if os.path.exists(temp_dir):
            for filename in os.listdir(temp_dir):
                if filename.endswith('.pdf'):
                    file_path = os.path.join(temp_dir, filename)
                    os.remove(file_path)
                    deleted_files.append(filename)
        
        return {
            "message": "All generated PDFs deleted successfully",
            "deleted_files": deleted_files,
            "count": len(deleted_files)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF一括削除エラー: {str(e)}")

@app.get("/favicon.ico")
async def favicon():
    """Faviconリクエストを無視"""
    raise HTTPException(status_code=204, detail="No favicon")

if __name__ == "__main__":
    import uvicorn
    from uvicorn.config import Config
    from uvicorn.server import Server
    
    # カスタムサーバー設定でX-Frame-Optionsを完全に制御
    config = Config(
        app=app,
        host="127.0.0.1",
        port=9000,
        server_header=False,
        # ログレベルを設定してデバッグ情報を表示
        log_level="info"
    )
    
    server = Server(config)
    server.run()