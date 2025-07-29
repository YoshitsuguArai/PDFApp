import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadPDF } from '../services/api';
import { UploadResponse } from '../types';

interface FileUploadProps {
  onUploadSuccess: (response: UploadResponse) => void;
  onUploadError: (error: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, onUploadError }) => {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      onUploadError('PDFファイルのみアップロード可能です');
      return;
    }

    // 既にアップロード中の場合は処理をスキップ
    if (isUploading) {
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadPDF(file);
      onUploadSuccess(response);
    } catch (error: any) {
      console.error('Upload error details:', error);
      let errorMessage = 'アップロードに失敗しました';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'アップロードがタイムアウトしました。ファイルサイズが大きすぎる可能性があります。';
      } else if (error.response?.status === 413) {
        errorMessage = 'ファイルサイズが大きすぎます。';
      } else if (error.response?.status >= 500) {
        errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess, onUploadError, isUploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isUploading
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${isUploading ? '#999' : '#ccc'}`,
        borderRadius: '10px',
        padding: '40px',
        textAlign: 'center',
        cursor: isUploading ? 'not-allowed' : 'pointer',
        backgroundColor: isUploading ? '#f5f5f5' : (isDragActive ? '#f0f8ff' : '#fafafa'),
        transition: 'all 0.2s ease',
        opacity: isUploading ? 0.7 : 1
      }}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <div>
          <p>アップロード中...</p>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
        </div>
      ) : (
        <div>
          {isDragActive ? (
            <p>PDFファイルをここにドロップしてください</p>
          ) : (
            <div>
              <p>PDFファイルをドラッグ＆ドロップするか、クリックして選択してください</p>
              <p style={{ fontSize: '14px', color: '#666' }}>
                .pdf ファイルのみ対応
              </p>
            </div>
          )}
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default FileUpload;