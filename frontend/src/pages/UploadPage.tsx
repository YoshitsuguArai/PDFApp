import React, { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import { UploadResponse } from '../types';
import { getDocumentCount, clearDocuments } from '../services/api';
import { FiUpload, FiFile, FiClipboard, FiInfo, FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface UploadPageProps {
  onDocumentCountChange: (count: number) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onDocumentCountChange }) => {
  const [documentCount, setDocumentCount] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');
  const [uploadHistory, setUploadHistory] = useState<Array<{
    filename: string;
    timestamp: string;
    chunks: number;
  }>>([]);

  useEffect(() => {
    fetchDocumentCount();
  }, []);

  const fetchDocumentCount = async () => {
    try {
      const response = await getDocumentCount();
      setDocumentCount(response.count);
      onDocumentCountChange(response.count);
    } catch (error) {
      console.error('ドキュメント数の取得に失敗:', error);
    }
  };

  const handleUploadSuccess = (response: UploadResponse) => {
    setUploadMessage(`${response.message}`);
    setError('');
    setDocumentCount(response.total_documents);
    onDocumentCountChange(response.total_documents);
    setError('');
    
    // アップロード履歴に追加
    const filename = response.message.match(/File (.+) uploaded/)?.[1] || 'Unknown file';
    setUploadHistory(prev => [{
      filename,
      timestamp: new Date().toLocaleString('ja-JP'),
      chunks: response.chunks_created
    }, ...prev.slice(0, 4)]); // 最新5件まで保持
    
    setTimeout(() => setUploadMessage(''), 5000);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(`${errorMessage}`);
    setUploadMessage('');
  };

  const handleClearDocuments = async () => {
    if (window.confirm('すべてのドキュメントを削除しますか？')) {
      try {
        await clearDocuments();
        setDocumentCount(0);
        onDocumentCountChange(0);
        setUploadHistory([]);
        setUploadMessage('すべてのドキュメントが削除されました');
        setTimeout(() => setUploadMessage(''), 3000);
      } catch (error: any) {
        setError(`削除エラー: ${error.response?.data?.detail || error.message}`);
      }
    }
  };

  return (
    <div style={{ padding: '30px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ページタイトル */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          margin: '0 0 12px 0', 
          color: '#1a1a2e',
          fontWeight: '600'
        }}>
          {/* @ts-ignore */}
          <FiUpload style={{ marginRight: '8px', fontSize: '28px', verticalAlign: 'middle' }} />
          PDFファイル管理
        </h1>
        <p style={{ 
          fontSize: '15px', 
          color: '#666', 
          margin: '0',
          lineHeight: '1.5'
        }}>
          PDFファイルをアップロードして、AI検索・資料生成のためのデータベースを構築します
        </p>
      </div>

      {/* 現在のドキュメント状況 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>
            登録済みドキュメント: {documentCount}件
          </span>
        </div>
        {documentCount > 0 && (
          <button
            onClick={handleClearDocuments}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            すべて削除
          </button>
        )}
      </div>

      {/* メッセージ表示 */}
      {(uploadMessage || error) && (
        <div style={{
          padding: '15px',
          marginBottom: '30px',
          borderRadius: '8px',
          backgroundColor: error ? '#f8d7da' : '#d4edda',
          border: error ? '1px solid #f5c6cb' : '1px solid #c3e6cb',
          color: error ? '#721c24' : '#155724',
          fontSize: '16px',
          textAlign: 'center',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          {error ? (
            <>
              {/* @ts-ignore */}
              <FiXCircle style={{ fontSize: '18px' }} />
              {error}
            </>
          ) : (
            <>
              {/* @ts-ignore */}
              <FiCheckCircle style={{ fontSize: '18px' }} />
              {uploadMessage}
            </>
          )}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          padding: '25px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#1a1a2e', fontSize: '20px', fontWeight: '600' }}>
            {/* @ts-ignore */}
            <FiUpload style={{ marginRight: '8px', fontSize: '20px', verticalAlign: 'middle' }} />
            PDFファイルアップロード
          </h2>
          <FileUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </div>
      </div>

      {/* アップロード履歴 */}
      {uploadHistory.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          border: '2px solid #e9ecef',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ 
            marginBottom: '20px', 
            color: '#333',
            fontSize: '20px',
            textAlign: 'center'
          }}>
            {/* @ts-ignore */}
            <FiClipboard style={{ marginRight: '8px', fontSize: '20px', verticalAlign: 'middle' }} />
            最近のアップロード履歴
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {uploadHistory.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                    {/* @ts-ignore */}
                    <FiFile style={{ marginRight: '6px', fontSize: '16px', verticalAlign: 'middle' }} />
                    {item.filename}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {item.timestamp}
                  </div>
                </div>
                <div style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {item.chunks}チャンク
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 使用方法ガイド */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '25px',
        marginTop: '30px'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '18px' }}>
          {/* @ts-ignore */}
          <FiInfo style={{ marginRight: '8px', fontSize: '18px', verticalAlign: 'middle' }} />
          使用方法
        </h4>
        <ol style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.8' }}>
          <li><strong>PDFアップロード:</strong> ドラッグ&ドロップまたはクリックしてファイルを選択</li>
          <li><strong>自動処理:</strong> アップロードされたPDFは自動的にチャンクに分割され、ベクトル化されます</li>
          <li><strong>検索利用:</strong> 検索ページでハイブリッド検索（セマンティック + キーワード）が利用可能</li>
          <li><strong>資料生成:</strong> 検索結果を基にAIが要約・レポート・プレゼン資料を自動生成</li>
        </ol>
      </div>
    </div>
  );
};

export default UploadPage;