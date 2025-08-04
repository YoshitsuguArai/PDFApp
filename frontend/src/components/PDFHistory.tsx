import React, { useState, useEffect } from 'react';
import { FiFile, FiRefreshCw, FiTrash2, FiDownload, FiEye, FiCalendar, FiHardDrive } from 'react-icons/fi';

interface PDFFile {
  filename: string;
  document_type: string;
  type_label: string;
  created_at: string;
  created_at_display: string;
  file_size: number;
  file_size_mb: number;
}

interface PDFHistoryResponse {
  pdfs: PDFFile[];
  total_count: number;
}

const PDFHistory: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchPDFHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:9000/generated-pdfs');
      if (!response.ok) {
        throw new Error('PDF履歴の取得に失敗しました');
      }
      const data: PDFHistoryResponse = await response.json();
      setPdfFiles(data.pdfs);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const deletePDF = async (filename: string) => {
    if (!window.confirm(`${filename} を削除しますか？`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:9000/generated-pdf/${filename}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('PDF削除に失敗しました');
      }
      // リストを更新
      fetchPDFHistory();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF削除に失敗しました');
    }
  };

  const clearAllPDFs = async () => {
    if (!window.confirm('全てのPDFファイルを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      const response = await fetch('http://localhost:9000/generated-pdfs', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('PDF一括削除に失敗しました');
      }
      // リストを更新
      fetchPDFHistory();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF一括削除に失敗しました');
    }
  };

  const downloadPDF = (filename: string) => {
    const downloadUrl = `http://localhost:9000/generated-pdf/${filename}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeColor = (documentType: string) => {
    switch (documentType) {
      case 'summary': return '#28a745';
      case 'report': return '#007bff';
      case 'presentation': return '#fd7e14';
      default: return '#6c757d';
    }
  };

  useEffect(() => {
    fetchPDFHistory();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        fontSize: '16px',
        color: '#666'
      }}>
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        borderRadius: '8px',
        border: '1px solid #f5c6cb'
      }}>
        エラー: {error}
        <button
          onClick={fetchPDFHistory}
          style={{
            marginLeft: '10px',
            padding: '5px 10px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        border: '1px solid #bbdefb'
      }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: '#1976d2', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* @ts-ignore */}
            <FiFile style={{ fontSize: '20px' }} />
            PDF生成履歴
          </h3>
          <p style={{ margin: '0', fontSize: '14px', color: '#555' }}>
            生成されたPDF: {pdfFiles.length}件
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchPDFHistory}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            }}
          >
            {/* @ts-ignore */}
            <FiRefreshCw style={{ fontSize: '14px' }} />
            更新
          </button>
          {pdfFiles.length > 0 && (
            <button
              onClick={clearAllPDFs}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#c82333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
              }}
            >
              {/* @ts-ignore */}
              <FiTrash2 style={{ fontSize: '14px' }} />
              全削除
            </button>
          )}
        </div>
      </div>

      {pdfFiles.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <p>生成されたPDFはありません。</p>
          <p style={{ fontSize: '14px' }}>
            検索結果から資料を生成すると、ここに履歴が表示されます。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {pdfFiles.map((pdf, index) => (
            <div
              key={index}
              style={{
                padding: '20px',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    backgroundColor: getTypeColor(pdf.document_type),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {pdf.type_label}
                  </span>
                  <span style={{
                    backgroundColor: '#f8f9fa',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#6c757d',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {/* @ts-ignore */}
                    <FiCalendar style={{ fontSize: '12px' }} />
                    {pdf.created_at_display}
                  </span>
                  <span style={{
                    backgroundColor: '#e9ecef',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#495057',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {/* @ts-ignore */}
                    <FiHardDrive style={{ fontSize: '12px' }} />
                    {pdf.file_size_mb} MB
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => downloadPDF(pdf.filename)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#218838';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#28a745';
                    }}
                  >
                    {/* @ts-ignore */}
                    <FiDownload style={{ fontSize: '12px' }} />
                    ダウンロード
                  </button>
                  <a
                    href={`http://localhost:9000/generated-pdf/${pdf.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                  >
                    {/* @ts-ignore */}
                    <FiEye style={{ fontSize: '12px' }} />
                    表示
                  </a>
                  <button
                    onClick={() => deletePDF(pdf.filename)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#c82333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc3545';
                    }}
                  >
                    {/* @ts-ignore */}
                    <FiTrash2 style={{ fontSize: '12px' }} />
                    削除
                  </button>
                </div>
              </div>
              
              <div style={{
                fontSize: '14px',
                color: '#333',
                backgroundColor: '#fafafa',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #f0f0f0'
              }}>
                <strong>ファイル名:</strong> {pdf.filename}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PDFHistory;