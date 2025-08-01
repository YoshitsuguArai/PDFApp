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
          <FiSearch style={{ marginRight: '8px', fontSize: '28px', verticalAlign: 'middle' }} />
          ドキュメント検索
        </h1>
        <p style={{ 
          fontSize: '15px', 
          color: '#666', 
          margin: '0',
          lineHeight: '1.5'
        }}>
          登録されたPDFファイルからハイブリッド検索（セマンティック + キーワード）で情報を検索
        </p>
      </div>

      {/* 現在のドキュメント状況 */}
      <div style={{
        backgroundColor: documentCount > 0 ? '#e8f5e8' : '#fff3cd',
        border: `1px solid ${documentCount > 0 ? '#c3e6cb' : '#ffeaa7'}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '25px',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '36px', 
          marginBottom: '12px'
        }}>
          {documentCount > 0 ? (
            <div style={{ fontSize: '36px' }}>📚</div>
          ) : (
            <div style={{ fontSize: '36px' }}>📁</div>
          )}
        </div>
        <h3 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '18px',
          color: documentCount > 0 ? '#155724' : '#856404',
          fontWeight: '600'
        }}>
          {documentCount > 0 ? `${documentCount}件のドキュメントが利用可能` : 'ドキュメントが登録されていません'}
        </h3>
        <p style={{ 
          margin: '0', 
          fontSize: '14px',
          color: documentCount > 0 ? '#155724' : '#856404'
        }}>
          {documentCount > 0 
            ? 'ハイブリッド検索で情報を検索できます' 
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
        backgroundColor: 'white',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '25px',
        marginBottom: '25px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ 
          marginBottom: '20px', 
          color: '#1a1a2e',
          fontSize: '20px',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          {/* @ts-ignore */}
          <FiSearch style={{ marginRight: '8px', fontSize: '20px', verticalAlign: 'middle' }} />
          検索クエリを入力
        </h2>
        <SearchForm
          onSearch={handleSearch}
          isSearching={isSearching}
        />
      </div>

      {/* 検索結果 */}
      {(searchResults.length > 0 || (lastQuery && !isSearching)) && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          padding: '25px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
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
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ 
                margin: '0 0 10px 0', 
                fontSize: '16px', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                {/* @ts-ignore */}
                <FiInfo style={{ marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }} />
                検索結果を活用してAI資料を生成しませんか？
              </p>
              <p style={{ 
                margin: '0', 
                fontSize: '14px', 
                color: '#666'
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