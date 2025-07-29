import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import SearchForm from './components/SearchForm';
import SearchResults from './components/SearchResults';
import { SearchQuery, SearchResult, UploadResponse } from './types';
import { searchDocuments, getDocumentCount, clearDocuments } from './services/api';

const App: React.FC = () => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [lastQuery, setLastQuery] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDocumentCount();
  }, []);

  const fetchDocumentCount = async () => {
    try {
      const response = await getDocumentCount();
      setDocumentCount(response.count);
    } catch (error) {
      console.error('ドキュメント数の取得に失敗:', error);
    }
  };

  const handleUploadSuccess = (response: UploadResponse) => {
    setUploadMessage(`✅ ${response.message}`);
    setDocumentCount(response.total_documents);
    setError('');
    setTimeout(() => setUploadMessage(''), 5000);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(`❌ ${errorMessage}`);
    setUploadMessage('');
  };

  const handleSearch = async (query: SearchQuery) => {
    if (documentCount === 0) {
      setError('まずPDFファイルをアップロードしてください');
      return;
    }

    setIsSearching(true);
    setError('');
    setLastQuery(query.query);

    try {
      const results = await searchDocuments(query);
      setSearchResults(results);
    } catch (error: any) {
      setError(`検索エラー: ${error.response?.data?.detail || error.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearDocuments = async () => {
    if (window.confirm('すべてのドキュメントを削除しますか？')) {
      try {
        await clearDocuments();
        setDocumentCount(0);
        setSearchResults([]);
        setUploadMessage('✅ すべてのドキュメントが削除されました');
        setTimeout(() => setUploadMessage(''), 3000);
      } catch (error: any) {
        setError(`削除エラー: ${error.response?.data?.detail || error.message}`);
      }
    }
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <header style={{ 
        textAlign: 'center', 
        marginBottom: '40px',
        borderBottom: '2px solid #007bff',
        paddingBottom: '20px'
      }}>
        <h1 style={{ 
          color: '#007bff', 
          margin: '0 0 10px 0',
          fontSize: '32px'
        }}>
          📚 PDF資料検索ツール
        </h1>
        <p style={{ 
          color: '#666', 
          margin: '0',
          fontSize: '16px'
        }}>
          PDFをアップロードしてハイブリッド検索で必要な情報を見つけましょう
        </p>
      </header>

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

      {(uploadMessage || error) && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: error ? '#f8d7da' : '#d4edda',
          border: error ? '1px solid #f5c6cb' : '1px solid #c3e6cb',
          color: error ? '#721c24' : '#155724'
        }}>
          {uploadMessage || error}
        </div>
      )}

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          📤 PDFファイルアップロード
        </h2>
        <FileUpload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          🔍 ドキュメント検索
        </h2>
        <SearchForm
          onSearch={handleSearch}
          isSearching={isSearching}
        />
      </div>

      {(searchResults.length > 0 || (lastQuery && !isSearching)) && (
        <div>
          <h2 style={{ marginBottom: '20px', color: '#333' }}>
            📋 検索結果
          </h2>
          <SearchResults
            results={searchResults}
            query={lastQuery}
          />
        </div>
      )}

      <footer style={{
        marginTop: '60px',
        padding: '20px 0',
        textAlign: 'center',
        borderTop: '1px solid #e9ecef',
        color: '#666',
        fontSize: '14px'
      }}>
        <p>
          🤖 ハイブリッド検索 (セマンティック + キーワード) により高精度な検索を実現
        </p>
        <p style={{ margin: '5px 0 0 0' }}>
          Powered by OpenAI API & ChromaDB
        </p>
      </footer>
    </div>
  );
};

export default App;