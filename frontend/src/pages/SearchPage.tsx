import React, { useState, useEffect } from 'react';
import SearchForm from '../components/SearchForm';
import SearchResults from '../components/SearchResults';
import { SearchQuery, FileSearchResult } from '../types';
import { searchFiles, getDocumentCount } from '../services/api';
import { FiSearch, FiBookOpen, FiFolder, FiClipboard, FiInfo } from 'react-icons/fi';

interface SearchPageProps {
  onSearchComplete: (results: FileSearchResult[], query: string) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({ onSearchComplete }) => {
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [lastQuery, setLastQuery] = useState('');
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

  const handleSearch = async (query: SearchQuery) => {
    if (documentCount === 0) {
      setError('まずアップロードページでPDFファイルをアップロードしてください');
      return;
    }

    setIsSearching(true);
    setError('');
    setLastQuery(query.query);

    try {
      const results = await searchFiles(query);
      setSearchResults(results);
      onSearchComplete(results, query.query);
    } catch (error: any) {
      setError(`検索エラー: ${error.response?.data?.detail || error.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      minHeight: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* ページタイトル */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ 
          fontSize: 'clamp(24px, 5vw, 32px)', 
          margin: '0 0 16px 0', 
          color: '#1a1a2e',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* @ts-ignore */}
          <FiSearch style={{ fontSize: 'clamp(28px, 5vw, 36px)' }} />
          ドキュメント検索
        </h1>
        <p style={{ 
          fontSize: 'clamp(14px, 2.5vw, 16px)', 
          color: '#666', 
          lineHeight: '1.6',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          登録されたPDFファイルからAI搭載ハイブリッド検索で高精度な情報検索を実現
        </p>
      </div>

      {/* 現在のドキュメント状況 */}
      <div style={{
        background: documentCount > 0 
          ? 'linear-gradient(135deg, #e8f5e8 0%, #f8fff8 100%)'
          : 'linear-gradient(135deg, #fff3cd 0%, #fffdf5 100%)',
        border: `2px solid ${documentCount > 0 ? '#28a745' : '#ffc107'}`,
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '30px',
        textAlign: 'center',
        boxShadow: documentCount > 0
          ? '0 4px 20px rgba(40, 167, 69, 0.1)'
          : '0 4px 20px rgba(255, 193, 7, 0.1)'
      }}>
        <div style={{ 
          fontSize: '48px', 
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          {documentCount > 0 ? (
            // @ts-ignore
            <FiBookOpen style={{ 
              fontSize: '48px',
              color: '#28a745'
            }} />
          ) : (
            // @ts-ignore
            <FiFolder style={{ 
              fontSize: '48px',
              color: '#ffc107'
            }} />
          )}
        </div>
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: '22px',
          color: documentCount > 0 ? '#155724' : '#856404',
          fontWeight: '700'
        }}>
          {documentCount > 0 ? `${documentCount}件のドキュメントが利用可能` : 'ドキュメントが登録されていません'}
        </h3>
        <p style={{ 
          margin: '0', 
          fontSize: '16px',
          color: documentCount > 0 ? '#155724' : '#856404',
          opacity: 0.9
        }}>
          {documentCount > 0 
            ? 'AI搭載ハイブリッド検索で高精度な情報検索が可能です' 
            : 'まずアップロードページでPDFファイルをアップロードしてください'}
        </p>
      </div>

      {error && (
        <div style={{
          padding: '15px',
          marginBottom: '30px',
          borderRadius: '8px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          fontSize: '16px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {error}
        </div>
      )}

      {/* 検索フォーム */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        border: '2px solid #e9ecef',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '30px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}>
        <SearchForm
          onSearch={handleSearch}
          isSearching={isSearching}
        />
      </div>

      {/* 検索結果 */}
      {(searchResults.length > 0 || (lastQuery && !isSearching)) && (
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          border: '2px solid #e9ecef',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          flex: 1
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px'
          }}>
            <h2 style={{ margin: '0', color: '#1a1a2e', fontSize: '20px', fontWeight: '600' }}>
              {/* @ts-ignore */}
              <FiClipboard style={{ marginRight: '8px', fontSize: '20px', verticalAlign: 'middle' }} />
              検索結果
            </h2>
            {searchResults.length > 0 && (
              <div style={{
                backgroundColor: '#1a1a2e',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {searchResults.length}件のファイルが見つかりました
              </div>
            )}
          </div>
          <SearchResults
            results={searchResults}
            query={lastQuery}
          />
          
          {searchResults.length > 0 && (
            <div style={{
              marginTop: '32px',
              padding: '24px',
              background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
              border: '2px solid #2196f320',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(33, 150, 243, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                {/* @ts-ignore */}
                <FiInfo style={{ 
                  fontSize: '28px',
                  color: '#2196f3'
                }} />
              </div>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontSize: '18px', 
                fontWeight: '700',
                color: '#1565c0'
              }}>
                検索結果を活用してAI資料を生成しませんか？
              </p>
              <p style={{ 
                margin: '0', 
                fontSize: '15px', 
                color: '#424242',
                lineHeight: '1.5'
              }}>
                「資料生成」ページで検索結果を基に要約・レポート・プレゼン資料を自動作成できます
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;