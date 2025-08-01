import React, { useState } from 'react';
import { FileSearchResult, GenerateDocumentRequest, GeneratedDocument } from '../types';
import { generateDocument } from '../services/api';

interface DocumentGeneratorProps {
  searchResults: FileSearchResult[];
  query: string;
}

const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ searchResults, query }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [documentType, setDocumentType] = useState<'summary' | 'report' | 'presentation'>('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (searchResults.length === 0) {
      setError('検索結果がありません。まず検索を実行してください。');
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

  const handleDownload = () => {
    if (!generatedDocument) return;

    const blob = new Blob([generatedDocument.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated_document_${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'summary': return '📄 要約レポート';
      case 'report': return '📊 詳細レポート';
      case 'presentation': return '🎤 プレゼンテーション資料';
      default: return type;
    }
  };

  return (
    <div style={{
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      marginTop: '20px'
    }}>
      <h3 style={{ marginBottom: '20px', color: '#333' }}>
        🤖 AI資料生成
      </h3>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          資料タイプ:
        </label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as any)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '14px'
          }}
        >
          <option value="summary">要約レポート - 検索結果を簡潔にまとめる</option>
          <option value="report">詳細レポート - 詳細な分析と考察を含む</option>
          <option value="presentation">プレゼンテーション資料 - 発表用のスライド構成</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          カスタムプロンプト（オプション）:
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="特定の観点や追加の指示があれば入力してください..."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
          📊 利用データ: {searchResults.length}件のファイル | 🔍 検索クエリ: "{query}"
        </p>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isGenerating || searchResults.length === 0}
        style={{
          backgroundColor: isGenerating ? '#6c757d' : '#28a745',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '4px',
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          marginRight: '10px'
        }}
      >
        {isGenerating ? '🔄 生成中...' : '🚀 資料を生成'}
      </button>

      {generatedDocument && (
        <button
          onClick={handleDownload}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          📥 ダウンロード
        </button>
      )}

      {generatedDocument && (
        <div style={{
          marginTop: '30px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: 'white'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h4 style={{ margin: '0' }}>
              {getDocumentTypeLabel(generatedDocument.document_type)}
            </h4>
            <small>
              生成日時: {new Date(generatedDocument.generated_at).toLocaleString('ja-JP')}
            </small>
          </div>
          
          <div style={{ padding: '20px' }}>
            <div style={{
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <strong>参照ファイル:</strong>
              <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                {generatedDocument.source_files.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
            
            <div style={{
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              fontSize: '14px',
              maxHeight: '500px',
              overflowY: 'auto',
              border: '1px solid #e9ecef',
              padding: '15px',
              borderRadius: '4px',
              backgroundColor: '#ffffff'
            }}>
              {generatedDocument.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentGenerator;