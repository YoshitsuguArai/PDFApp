import React from 'react';
import { FiX, FiExternalLink, FiDownload } from 'react-icons/fi';

interface PDFViewerProps {
  pdfUrl: string;
  filename: string;
  isOpen: boolean;
  onClose: () => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, filename, isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    // ダウンロード用のエンドポイントを使用
    const downloadUrl = pdfUrl.replace('/pdf/view/', '/pdf/');
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExternalOpen = () => {
    // 既にビュー用URLなのでそのまま使用
    window.open(pdfUrl, '_blank');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '90vw',
        height: '90vh',
        maxWidth: '1200px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '12px 12px 0 0',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)'
        }}>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              PDF閲覧
            </h3>
            <p style={{
              margin: '0',
              fontSize: '14px',
              color: '#6c757d',
              fontWeight: '500'
            }}>
              {filename}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleDownload}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#218838';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#28a745';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* @ts-ignore */}
              <FiDownload style={{ fontSize: '14px' }} />
              ダウンロード
            </button>
            
            <button
              onClick={handleExternalOpen}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0056b3';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#007bff';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* @ts-ignore */}
              <FiExternalLink style={{ fontSize: '14px' }} />
              新しいタブで開く
            </button>
            
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#c82333';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* @ts-ignore */}
              <FiX style={{ fontSize: '18px' }} />
            </button>
          </div>
        </div>

        {/* PDF表示エリア */}
        <div style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#f8f9fa',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden'
        }}>
          <iframe
            src={pdfUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
            title={`PDF Viewer - ${filename}`}
            allow="fullscreen"
            loading="lazy"
          />
          
          {/* 読み込み中表示 */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 1
          }}>
            📄 PDFを読み込み中...
          </div>
          
          {/* フォールバック表示 */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '12px 20px',
            borderRadius: '8px',
            color: '#6c757d',
            fontSize: '13px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>
              💡 表示されない場合
            </p>
            <p style={{ margin: '0', fontSize: '12px' }}>
              「新しいタブで開く」をお試しください
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;