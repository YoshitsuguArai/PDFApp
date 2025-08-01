import PyPDF2
from typing import List, Dict
import os
import uuid
import signal
from contextlib import contextmanager

class PDFProcessor:
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    @contextmanager
    def timeout_handler(self, seconds=30):
        """タイムアウトハンドラー（Windowsでは使用不可のため代替実装）"""
        try:
            yield
        except Exception as e:
            raise e
    
    def extract_text_from_pdf(self, file_path: str) -> Dict[str, any]:
        """PDFファイルからテキストを抽出し、ページごとに分割"""
        print(f"Starting PDF extraction for: {file_path}")
        
        # まずPyPDF2で試す
        try:
            return self._extract_with_pypdf2(file_path)
        except Exception as e:
            print(f"PyPDF2 failed: {e}")
            raise Exception(f"PDF処理エラー: {str(e)}")
    
    def _extract_with_pypdf2(self, file_path: str) -> Dict[str, any]:
        """PyPDF2を使用してテキストを抽出"""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            pages_text = []
            total_pages = len(pdf_reader.pages)
            print(f"Total pages: {total_pages}")
            
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    print(f"Processing page {page_num + 1}/{total_pages}...")
                    text = page.extract_text().strip()
                    if text:
                        pages_text.append({
                            'page': page_num + 1,
                            'content': text
                        })
                        print(f"Page {page_num + 1}: {len(text)} characters extracted")
                    else:
                        print(f"Page {page_num + 1} has no extractable text")
                except Exception as page_error:
                    print(f"Error processing page {page_num + 1}: {page_error}")
                    continue
            
            return {
                'filename': os.path.basename(file_path),
                'total_pages': total_pages,
                'pages': pages_text
            }
    
    def chunk_text(self, text: str, chunk_size: int = 1200, overlap: int = 300) -> List[str]:
        """テキストをチャンクに分割"""
        try:
            if len(text) <= chunk_size:
                return [text]
            
            chunks = []
            start = 0
            iteration_count = 0
            max_iterations = 1000  # 無限ループ防止
            
            while start < len(text) and iteration_count < max_iterations:
                end = start + chunk_size
                
                if end < len(text):
                    # 日本語と英語に対応した境界で切る
                    # 句読点や改行を優先的に探す
                    for sep in ['。', '\n', '\r\n', '？', '！', '.', '?', '!']:
                        sep_pos = text.rfind(sep, start, end)
                        if sep_pos > start:
                            end = sep_pos + 1
                            break
                    else:
                        # 句読点が見つからない場合は空白で切る
                        last_space = text.rfind(' ', start, end)
                        if last_space > start:
                            end = last_space
                
                chunk = text[start:end].strip()
                if chunk:
                    chunks.append(chunk)
                
                # 進行状況の確認
                old_start = start
                start = end - overlap
                if start < 0:
                    start = 0
                
                # 無限ループの検出
                if start <= old_start and iteration_count > 10:
                    print(f"Warning: Potential infinite loop detected at position {start}, breaking")
                    break
                
                iteration_count += 1
            
            if iteration_count >= max_iterations:
                print(f"Warning: Maximum iterations reached while chunking text of length {len(text)}")
                
            return chunks
        except Exception as e:
            print(f"Error in chunk_text: {e}")
            # エラーが発生した場合は元のテキストをそのまま返す
            return [text]
    
    def generate_pdf(self, content: str) -> str:
        """テキストからPDFファイルを生成"""
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration
        import datetime
        import re

        # 一時ファイル名を生成
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"summary_{timestamp}.pdf"
        output_path = os.path.join("backend/backend/temp_pdfs", output_filename)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # コンテンツを整形
        def format_content(text: str) -> str:
            lines = text.split('\n')
            html_parts = []
            current_section = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # メタデータ行の処理
                if ': ' in line and not line.startswith('-'):
                    key, value = line.split(': ', 1)
                    html_parts.append(f'<div class="metadata"><span class="key">{key}</span>: {value}</div>')
                
                # 区切り線
                elif line.startswith('_'):
                    html_parts.append('<hr>')
                
                # 番号付きの見出し
                elif re.match(r'^\d+\.\s', line):
                    if not any(c in line for c in ['-', '・']):  # 箇条書きでない場合は見出しとして扱う
                        title = re.sub(r'^\d+\.\s', '', line)
                        html_parts.append(f'<h2>{title}</h2>')
                        current_section = []
                
                # 箇条書き
                elif line.startswith('-') or line.startswith('・'):
                    content = line[1:].strip()
                    html_parts.append(f'<li>{content}</li>')
                
                # その他の通常のテキスト
                else:
                    html_parts.append(f'<p>{line}</p>')
            
            return '\n'.join(html_parts)

        # HTMLテンプレートを作成
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @font-face {{
                    font-family: 'YuGothic';
                    src: local('Yu Gothic');
                    font-weight: normal;
                }}
                body {{
                    font-family: 'YuGothic', 'Yu Gothic', sans-serif;
                    font-size: 11pt;
                    line-height: 1.6;
                    margin: 2.5cm;
                    color: #333;
                }}
                .metadata {{
                    margin: 0.3em 0;
                    color: #666;
                }}
                .metadata .key {{
                    font-weight: bold;
                    color: #333;
                }}
                h1 {{
                    font-size: 16pt;
                    margin: 1em 0;
                    padding-bottom: 0.5em;
                    border-bottom: 2px solid #333;
                }}
                h2 {{
                    font-size: 13pt;
                    margin: 1.5em 0 0.5em;
                    padding-left: 0.5em;
                    border-left: 4px solid #666;
                }}
                p {{
                    margin: 0.7em 0;
                    text-align: justify;
                }}
                li {{
                    margin: 0.5em 0;
                    line-height: 1.4;
                    list-style-type: none;
                    text-indent: -1.5em;
                    padding-left: 1.5em;
                }}
                li:before {{
                    content: "•";
                    margin-right: 0.5em;
                }}
                hr {{
                    border: none;
                    border-top: 1px solid #ccc;
                    margin: 1em 0;
                }}
            </style>
        </head>
        <body>
            {format_content(content)}
        </body>
        </html>
        """

        # フォント設定
        font_config = FontConfiguration()
        
        # HTMLからPDFを生成
        HTML(string=html_content).write_pdf(
            output_path,
            font_config=font_config,
            optimize_size=('fonts', 'images'),
            presentational_hints=True
        )

        return output_filename

    def process_pdf_file(self, file_path: str) -> List[Dict[str, any]]:
        """PDFファイルを処理してチャンクに分割"""
        print("PDF extraction completed, starting chunk processing...")
        pdf_data = self.extract_text_from_pdf(file_path)
        document_chunks = []
        
        print(f"Processing {len(pdf_data['pages'])} pages into chunks...")
        
        for page_idx, page_data in enumerate(pdf_data['pages']):
            try:
                print(f"Chunking page {page_data['page']} ({page_idx + 1}/{len(pdf_data['pages'])})...")
                chunks = self.chunk_text(page_data['content'])
                print(f"Page {page_data['page']}: created {len(chunks)} chunks")
                
                for chunk_idx, chunk in enumerate(chunks):
                    document_chunks.append({
                        'id': str(uuid.uuid4()),
                        'content': chunk,
                        'source': pdf_data['filename'],
                        'page': page_data['page'],
                        'chunk_index': chunk_idx
                    })
            except Exception as chunk_error:
                print(f"Error chunking page {page_data['page']}: {chunk_error}")
                continue
        
        print(f"Chunk processing completed. Total chunks: {len(document_chunks)}")
        return document_chunks