import React, { useState } from 'react';
import { FileSearchResult, GenerateDocumentRequest, GeneratedDocument } from '../types';
import { generateDocument, downloadGeneratedPdf } from '../services/api';
import { FaRobot, FaDownload, FaSearch, FaExclamationTriangle, FaClock, FaRocket, FaTimes } from 'react-icons/fa';
import { FiFile, FiFileText, FiBookOpen, FiBarChart, FiMic } from 'react-icons/fi';

interface DocumentGeneratorPageProps {
  searchResults: FileSearchResult[];
  query: string;
}

const DocumentGeneratorPage: React.FC<DocumentGeneratorPageProps> = ({ searchResults, query }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [documentType, setDocumentType] = useState<'summary' | 'report' | 'presentation'>('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (searchResults.length === 0) {
      setError('検索結果がありません。まず検索ページで検索を実行してください。');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const request: GenerateDocumentRequest = {
        search_results: searchResults,
        document_type: documentType,
        query: query,
        custom_prompt: customPrompt || undefined
      };

      const result = await generateDocument(request);
      setGeneratedDocument(result);
    } catch (error: any) {
      setError(`資料生成エラー: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedDocument || !generatedDocument.pdf_filename) return;
    
    try {
      const pdfBlob = await downloadGeneratedPdf(generatedDocument.pdf_filename);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedDocument.pdf_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setError(`PDFダウンロードエラー: ${error.message}`);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      // @ts-ignore
      case 'summary': return <><FiFileText style={{marginRight: '6px'}} />要約レポート</>;
      // @ts-ignore
      case 'report': return <><FiBarChart style={{marginRight: '6px'}} />詳細レポート</>;
      // @ts-ignore
      case 'presentation': return <><FiMic style={{marginRight: '6px'}} />プレゼンテーション資料</>;
      default: return type;
    }
  };

  const getDocumentTypeDescription = (type: string) => {
    switch (type) {
      case 'summary': return '検索結果を簡潔にまとめた要約レポートを作成します';
      case 'report': return '詳細な分析と考察を含む包括的なレポートを作成します';
      case 'presentation': return '発表用のスライド構成で視覚的に分かりやすい資料を作成します';
      default: return '';
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
          <FaRobot style={{ marginRight: '8px', fontSize: '28px', verticalAlign: 'middle' }} />
          インテリジェント資料生成
        </h1>
        <p style={{ 
          fontSize: '15px', 
          color: '#666', 
          margin: '0',
          lineHeight: '1.5'
        }}>
          検索結果を基にAIが自動で要約・レポート・プレゼンテーション資料を生成します
        </p>
      </div>

      {/* 現在の検索状況 */}
      <div style={{
        backgroundColor: searchResults.length > 0 ? '#e8f5e8' : '#fff3cd',
        border: `1px solid ${searchResults.length > 0 ? '#c3e6cb' : '#ffeaa7'}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h3 style={{ 
          margin: '0 0 15px 0', 
          color: searchResults.length > 0 ? '#155724' : '#856404',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {searchResults.length > 0 ? (
            <>
              {/* @ts-ignore */}
              <FiBarChart style={{ marginRight: '8px' }} />
              検索データ利用可能
            </>
          ) : (
            <>
              {/* @ts-ignore */}
              <FaExclamationTriangle style={{ marginRight: '8px' }} />
              検索データがありません
            </>
          )}
        </h3>
        
        {searchResults.length > 0 ? (
          <div>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
              {/* @ts-ignore */}
              <FaSearch style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              検索クエリ: "{query}"
            </p>
            <p style={{ margin: '0 0 15px 0', color: '#666' }}>
              {/* @ts-ignore */}
              <FiFile style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              利用可能ファイル: {searchResults.length}件
            </p>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px',
              marginTop: '10px'
            }}>
              {searchResults.slice(0, 5).map((result, index) => (
                <span
                  key={index}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {result.source}
                </span>
              ))}
              {searchResults.length > 5 && (
                <span style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  +{searchResults.length - 5}件
                </span>
              )}
            </div>
          </div>
        ) : (
          <p style={{ margin: '0', color: '#856404' }}>
            資料を生成するには、まず検索ページで検索を実行してください。検索結果がある状態でこのページに戻ってきてください。
          </p>
        )}
      </div>

      {/* 資料生成設定 */}
      <div style={{
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '30px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '30px', color: '#333', textAlign: 'center' }}>
          {/* @ts-ignore */}
          <FaRobot style={{ marginRight: '8px', fontSize: '18px', verticalAlign: 'middle' }} />
          インテリジェント資料生成
        </h2>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', fontSize: '16px' }}>
            資料タイプを選択:
          </label>
          <div style={{ display: 'grid', gap: '12px' }}>
            {(['summary', 'report', 'presentation'] as const).map((type) => (
              <label
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px',
                  border: `2px solid ${documentType === type ? '#007bff' : '#e9ecef'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: documentType === type ? '#f8f9ff' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  type="radio"
                  name="documentType"
                  value={type}
                  checked={documentType === type}
                  onChange={(e) => setDocumentType(e.target.value as any)}
                  style={{ marginRight: '12px', transform: 'scale(1.2)' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                    {getDocumentTypeLabel(type)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {getDocumentTypeDescription(type)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', fontSize: '16px' }}>
            カスタムプロンプト（オプション）:
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="特定の観点や追加の指示があれば入力してください... 例：技術的な詳細を重視、実装方法を含める、課題解決策を提案など"
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #e9ecef',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '15px',
            marginBottom: '20px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '8px',
            color: '#721c24',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || searchResults.length === 0}
            style={{
              backgroundColor: isGenerating ? '#6c757d' : (searchResults.length === 0 ? '#dc3545' : '#28a745'),
              color: 'white',
              border: 'none',
              padding: '15px 40px',
              borderRadius: '8px',
              cursor: isGenerating || searchResults.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              fontWeight: 'bold',
              minWidth: '200px',
              transition: 'background-color 0.2s'
            }}
          >
            {isGenerating ? (
              <>
                {/* @ts-ignore */}
                <FaClock style={{ marginRight: '8px', animation: 'spin 2s linear infinite' }} />
                生成中...
              </>
            ) : (searchResults.length === 0 ? (
              <>
                {/* @ts-ignore */}
                <FaTimes style={{ marginRight: '8px' }} />
                検索データなし
              </>
            ) : (
              <>
                {/* @ts-ignore */}
                <FaRocket style={{ marginRight: '8px' }} />
                資料を生成
              </>
            ))}
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
          <p style={{ margin: '0' }}>
            {/* @ts-ignore */}
            <FaClock style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            生成には30秒～1分程度かかる場合があります
          </p>
        </div>
      </div>

      {/* 生成された資料 */}
      {generatedDocument && (
        <div style={{
          marginTop: '40px',
          border: '1px solid #28a745',
          borderRadius: '12px',
          backgroundColor: 'white',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            padding: '20px',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
                {getDocumentTypeLabel(generatedDocument.document_type)}
              </h3>
              <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
                生成日時: {new Date(generatedDocument.generated_at).toLocaleString('ja-JP')}
              </p>
            </div>
            <button
              onClick={handleDownload}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '2px solid white',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }}
            >
              {/* @ts-ignore */}
              <FaDownload style={{ marginRight: '6px' }} />
              ダウンロード
            </button>
          </div>
          
          <div style={{ padding: '25px' }}>
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <strong>
                {/* @ts-ignore */}
                <FiBookOpen style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                参照ファイル:
              </strong>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {generatedDocument.source_files.map((file, index) => (
                  <span
                    key={index}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
            
            <div style={{
              whiteSpace: 'pre-wrap',
              lineHeight: '1.8',
              fontSize: '15px',
              maxHeight: '600px',
              overflowY: 'auto',
              border: '2px solid #e9ecef',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              fontFamily: 'Georgia, serif'
            }}>
              {generatedDocument.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentGeneratorPage;