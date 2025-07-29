from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import PyPDF2
import pdfplumber
from dotenv import load_dotenv
import json

load_dotenv()

app = FastAPI(title="PDF Search API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchQuery(BaseModel):
    query: str
    top_k: Optional[int] = 5
    search_type: Optional[str] = "hybrid"

class SearchResult(BaseModel):
    content: str
    score: float
    source: str
    page: Optional[int] = None
    search_type: Optional[str] = None

# 簡単なメモリ内ストレージ
documents = []
DOCUMENTS_FILE = "documents.json"

def load_documents():
    """ファイルからドキュメントを読み込み"""
    global documents
    try:
        if os.path.exists(DOCUMENTS_FILE):
            with open(DOCUMENTS_FILE, 'r', encoding='utf-8') as f:
                documents = json.load(f)
            print(f"Loaded {len(documents)} documents from file")
    except Exception as e:
        print(f"Error loading documents: {e}")
        documents = []

def save_documents():
    """ドキュメントをファイルに保存"""
    try:
        with open(DOCUMENTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(documents, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(documents)} documents to file")
    except Exception as e:
        print(f"Error saving documents: {e}")

# 起動時にドキュメントを読み込み
load_documents()

@app.get("/")
async def root():
    return {"message": "PDF Search API"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    print(f"Received file: {file.filename}, content_type: {file.content_type}, size: {file.size}")
    
    # PDFファイルの検証を緩める
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # アップロードディレクトリを作成
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # ファイルを保存
        file_path = os.path.join(upload_dir, file.filename)
        print(f"Saving file to: {file_path}")
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        print(f"File saved, size: {os.path.getsize(file_path)} bytes")
        
        # PDFからテキストを抽出（pdfplumberを使用）
        chunks_added = 0
        try:
            with pdfplumber.open(file_path) as pdf:
                print(f"PDF has {len(pdf.pages)} pages")
                
                for page_num, page in enumerate(pdf.pages):
                    try:
                        text = page.extract_text()
                        if text and text.strip():
                            clean_text = text.strip()
                            documents.append({
                                'content': clean_text,
                                'source': file.filename,
                                'page': page_num + 1
                            })
                            chunks_added += 1
                            print(f"Extracted text from page {page_num + 1}: {len(clean_text)} characters")
                            # 最初の100文字をログ出力（デバッグ用）
                            print(f"Content preview: {clean_text[:100]}...")
                    except Exception as page_error:
                        print(f"Error extracting text from page {page_num + 1}: {page_error}")
                        
        except Exception as pdf_error:
            print(f"Error reading PDF with pdfplumber: {pdf_error}")
            # フォールバックとしてPyPDF2を試す
            try:
                with open(file_path, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    print(f"Fallback to PyPDF2, PDF has {len(pdf_reader.pages)} pages")
                    
                    for page_num, page in enumerate(pdf_reader.pages):
                        try:
                            text = page.extract_text().strip()
                            if text:
                                documents.append({
                                    'content': text,
                                    'source': file.filename,
                                    'page': page_num + 1
                                })
                                chunks_added += 1
                                print(f"Extracted text with PyPDF2 from page {page_num + 1}: {len(text)} characters")
                        except Exception as page_error:
                            print(f"Error extracting text from page {page_num + 1}: {page_error}")
            except Exception as fallback_error:
                print(f"Both PDF readers failed: {fallback_error}")
                raise HTTPException(status_code=400, detail=f"Could not process PDF file: {str(fallback_error)}")
        
        result = {
            "message": f"File {file.filename} uploaded and processed successfully",
            "chunks_created": chunks_added,
            "total_documents": len(documents)
        }
        print(f"Upload result: {result}")
        
        # ドキュメントを保存
        save_documents()
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"処理エラー: {str(e)}")

@app.post("/search", response_model=List[SearchResult])
async def search_documents(query: SearchQuery):
    print(f"Search request: query='{query.query}', top_k={query.top_k}, type={query.search_type}")
    print(f"Total documents in memory: {len(documents)}")
    
    try:
        # ファイル単位でグループ化して検索
        file_matches = {}
        query_lower = query.query.lower()
        
        # 各ドキュメントを確認してファイル単位でグループ化
        for doc in documents:
            content_lower = doc['content'].lower()
            if query_lower in content_lower:
                filename = doc['source']
                
                if filename not in file_matches:
                    file_matches[filename] = {
                        'pages': [],
                        'total_matches': 0,
                        'total_content': '',
                        'matching_pages': []
                    }
                
                # マッチ数を計算
                match_count = content_lower.count(query_lower)
                file_matches[filename]['total_matches'] += match_count
                file_matches[filename]['pages'].append({
                    'page': doc['page'],
                    'content': doc['content'],
                    'matches': match_count
                })
                file_matches[filename]['matching_pages'].append(doc['page'])
        
        # ファイルごとに統合結果を作成
        results = []
        for filename, match_data in file_matches.items():
            # 全ページの内容を統合
            all_content = ' '.join([p['content'] for p in match_data['pages']])
            
            # 統合スコアを計算（全体のマッチ数 / 全体の単語数）
            total_words = len(all_content.split())
            unified_score = match_data['total_matches'] / total_words if total_words > 0 else 0
            
            # 最も関連性の高いページの内容を抜粋（最初の800文字）
            best_page = max(match_data['pages'], key=lambda p: p['matches'])
            content_preview = best_page['content'][:800] + "..." if len(best_page['content']) > 800 else best_page['content']
            
            # ページ範囲を表示
            page_range = f"{min(match_data['matching_pages'])}-{max(match_data['matching_pages'])}" if len(match_data['matching_pages']) > 1 else str(match_data['matching_pages'][0])
            
            result = {
                'content': content_preview,
                'score': min(unified_score * 10, 1.0),  # 0-1にスケール
                'source': filename,
                'page': None,  # ページ範囲は別途表示
                'search_type': 'unified',
                'page_range': page_range,
                'total_matches': match_data['total_matches'],
                'matching_pages_count': len(match_data['matching_pages'])
            }
            results.append(result)
            
            print(f"File: {filename}, Pages: {page_range}, Total matches: {match_data['total_matches']}, Score: {result['score']:.3f}")
        
        print(f"Found matches in {len(results)} files for query '{query.query}'")
        
        # スコアでソート
        results.sort(key=lambda x: x['score'], reverse=True)
        final_results = results[:query.top_k]
        
        print(f"Returning {len(final_results)} file results")
        return final_results
    
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=f"検索エラー: {str(e)}")

@app.get("/documents/count")
async def get_document_count():
    return {"count": len(documents)}

@app.get("/documents/sample")
async def get_sample_documents():
    # 最初の3件のドキュメントのサンプルを返す
    sample = []
    for i, doc in enumerate(documents[:3]):
        sample.append({
            "index": i,
            "source": doc["source"],
            "page": doc["page"],
            "content_preview": doc["content"][:200] + "..." if len(doc["content"]) > 200 else doc["content"]
        })
    return {"total": len(documents), "sample": sample}

@app.delete("/documents")
async def clear_documents():
    global documents
    documents = []
    save_documents()  # 空の状態を保存
    return {"message": "All documents cleared successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)