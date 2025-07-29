import React from 'react';
import { SearchResult } from '../types';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, query }) => {
  if (results.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#666',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <p>検索結果が見つかりませんでした。</p>
        <p style={{ fontSize: '14px' }}>
          別のキーワードで検索してみてください。
        </p>
      </div>
    );
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  const getSearchTypeColor = (searchType?: string) => {
    switch (searchType) {
      case 'semantic': return '#28a745';
      case 'keyword': return '#dc3545';
      case 'hybrid': return '#007bff';
      default: return '#6c757d';
    }
  };

  const getSearchTypeLabel = (searchType?: string) => {
    switch (searchType) {
      case 'semantic': return 'セマンティック';
      case 'keyword': return 'キーワード';
      case 'hybrid': return 'ハイブリッド';
      case 'unified': return 'ファイル統合';
      default: return '不明';
    }
  };

  return (
    <div>
      <div style={{ 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        border: '1px solid #bbdefb'
      }}>
        <h3 style={{ margin: '0 0 5px 0', color: '#1976d2' }}>
          検索結果: {results.length}件
        </h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#555' }}>
          「<strong>{query}</strong>」の検索結果
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {results.map((result, index) => (
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
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={`http://localhost:9000/pdf/${result.source}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0056b3';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#007bff';
                  }}
                >
                  📄 {result.source}
                </a>
                {result.page_range ? (
                  <span style={{
                    backgroundColor: '#d1ecf1',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#0c5460',
                    fontWeight: 'bold'
                  }}>
                    📖 ページ {result.page_range}
                  </span>
                ) : result.page && (
                  <span style={{
                    backgroundColor: '#e9ecef',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#495057'
                  }}>
                    ページ {result.page}
                  </span>
                )}
                {result.total_matches && (
                  <span style={{
                    backgroundColor: '#fff3cd',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#856404',
                    fontWeight: 'bold'
                  }}>
                    🎯 {result.total_matches}件マッチ
                  </span>
                )}
                {result.matching_pages_count && result.matching_pages_count > 1 && (
                  <span style={{
                    backgroundColor: '#d4edda',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#155724',
                    fontWeight: 'bold'
                  }}>
                    📑 {result.matching_pages_count}ページに分散
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{
                  backgroundColor: getSearchTypeColor(result.search_type),
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {getSearchTypeLabel(result.search_type)}
                </span>
                <span style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {(result.score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#333',
              backgroundColor: '#fafafa',
              padding: '15px',
              borderRadius: '6px',
              border: '1px solid #f0f0f0'
            }}>
              {highlightText(result.content, query)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;