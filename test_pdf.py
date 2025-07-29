import os
from pdf_processor import PDFProcessor

# PDFProcessorをテスト
pdf_processor = PDFProcessor(upload_dir="backend/uploads")
print(f"Upload directory: {pdf_processor.upload_dir}")
print(f"Directory exists: {os.path.exists(pdf_processor.upload_dir)}")

# ファイルパスをテスト
filename = "000479.pdf"
file_path = os.path.join(pdf_processor.upload_dir, filename)
print(f"File path: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")

# ファイル一覧を表示
if os.path.exists(pdf_processor.upload_dir):
    files = os.listdir(pdf_processor.upload_dir)
    print(f"Files in directory: {files}")