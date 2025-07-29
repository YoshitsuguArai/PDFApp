import React from 'react';
import { FileSearchResult } from '../types';

interface SearchResultsProps {
  results: FileSearchResult[];
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

  const formatPageList = (pages: number[]) => {
    if (pages.length === 0) return '';
    if (pages.length === 1) return `${pages[0]}`;
    
    // ページ番号を範囲表示に変換
    const ranges: string[] = [];
    let start = pages[0];
    let end = start;
    
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === end + 1) {
        end = pages[i];
      } else {
        if (start === end) {
          ranges.push(`${start}`);
        } else {
          ranges.push(`${start}-${end}`);
        }
        start = pages[i];
        end = start;
      }
    }
    
    if (start === end) {
      ranges.push(`${start}`);
    } else {
      ranges.push(`${start}-${end}`);
    }
    
    return ranges.join(', ');
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
                <span style={{
                  backgroundColor: '#d1ecf1',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#0c5460',
                  fontWeight: 'bold'
                }}>
                  📖 ページ {formatPageList(result.pages)}
                </span>
                <span style={{
                  backgroundColor: '#fff3cd',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#856404',
                  fontWeight: 'bold'
                }}>
                  🎯 {result.chunk_count}チャンク
                </span>
                <span style={{
                  backgroundColor: '#e1f5fe',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#01579b',
                  fontWeight: 'bold'
                }}>
                  最高: {(result.max_score * 100).toFixed(1)}%
                </span>
                {result.top3_avg && (
                  <span style={{
                    backgroundColor: '#f3e5f5',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#4a148c',
                    fontWeight: 'bold'
                  }}>
                    Top3: {(result.top3_avg * 100).toFixed(1)}%
                  </span>
                )}
                {result.page_bonus && result.page_bonus !== 1.0 && (
                  <span style={{
                    backgroundColor: '#e8f5e8',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#2e7d32',
                    fontWeight: 'bold'
                  }}>
                    分散: ×{result.page_bonus.toFixed(2)}
                  </span>
                )}
                {result.consistency_bonus && result.consistency_bonus !== 1.0 && (
                  <span style={{
                    backgroundColor: '#fff8e1',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#f57f17',
                    fontWeight: 'bold'
                  }}>
                    一貫性: ×{result.consistency_bonus.toFixed(2)}
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
              {highlightText(result.best_chunk, query)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;