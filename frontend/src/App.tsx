import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UploadPage from './pages/UploadPage';
import SearchPage from './pages/SearchPage';
import DocumentGeneratorPage from './pages/DocumentGeneratorPage';
import PDFHistoryPage from './pages/PDFHistoryPage';
import { FileSearchResult } from './types';
import { getDocumentCount } from './services/api';
import { FaRobot, FaHeart } from 'react-icons/fa';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'upload' | 'search' | 'generate' | 'history'>('search');
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
  const [lastQuery, setLastQuery] = useState('');
  const [documentCount, setDocumentCount] = useState(0);

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

  const handleSearchComplete = (results: FileSearchResult[], query: string) => {
    setSearchResults(results);
    setLastQuery(query);
  };

  const handleNavigate = (page: 'upload' | 'search' | 'generate' | 'history') => {
    setCurrentPage(page);
  };

  const handleDocumentCountChange = (count: number) => {
    setDocumentCount(count);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f3f6',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        documentCount={documentCount}
      />

      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '32px 24px',
        minHeight: 'calc(100vh - 120px)'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          minHeight: 'calc(100vh - 200px)'
        }}>
          {currentPage === 'upload' && (
            <UploadPage onDocumentCountChange={handleDocumentCountChange} />
          )}
          
          {currentPage === 'search' && (
            <SearchPage onSearchComplete={handleSearchComplete} />
          )}
          
          {currentPage === 'generate' && (
            <DocumentGeneratorPage 
              searchResults={searchResults}
              query={lastQuery}
            />
          )}
          
          {currentPage === 'history' && (
            <PDFHistoryPage />
          )}
        </div>
      </main>

      <footer style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        marginTop: 'auto',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '32px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '32px',
          alignItems: 'center'
        }}>
          {/* ブランド情報 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px'
          }}>
            <img 
              src="/icon.png" 
              alt="DocuMind Pro" 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                opacity: 0.95
              }}
            />
            <div>
              <h4 style={{
                margin: '0 0 4px 0',
                fontSize: '18px',
                fontWeight: '700',
                color: '#ffffff'
              }}>
                DocuMind Pro
              </h4>
              <p style={{
                margin: '0',
                fontSize: '14px',
                color: '#9fb8d3',
                fontWeight: '400'
              }}>
                Enterprise Document Intelligence
              </p>
            </div>
          </div>

          {/* 技術情報 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '8px 16px',
              borderRadius: '20px',
              marginBottom: '8px'
            }}>
              {/* @ts-ignore */}
              <FaRobot style={{ fontSize: '16px', color: '#4a9eff' }} />
              <span style={{
                fontSize: '14px',
                color: '#ffffff',
                fontWeight: '600'
              }}>
                AI Hybrid Search
              </span>
            </div>
            <p style={{
              margin: '0',
              fontSize: '12px',
              color: '#8892b0'
            }}>
              Powered by OpenAI & ChromaDB
            </p>
          </div>

          {/* バージョン・コピーライト */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(44, 90, 160, 0.9)',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '12px'
            }}>
              v1.0.0 BETA
            </div>
            <p style={{
              margin: '0',
              fontSize: '12px',
              color: '#8892b0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px'
            }}>
              {/* @ts-ignore */}
              © 2024 | Built with <FaHeart style={{ color: '#ff6b6b', fontSize: '12px' }} /> for enterprise
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;