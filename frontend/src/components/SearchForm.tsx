import React, { useState } from 'react';
import { SearchQuery } from '../types';

interface SearchFormProps {
  onSearch: (query: SearchQuery) => void;
  isSearching: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, isSearching }) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [topK, setTopK] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch({
        query: query.trim(),
        search_type: searchType,
        top_k: topK
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="検索したい内容を入力してください..."
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            outline: 'none'
          }}
          disabled={isSearching}
        />
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        alignItems: 'center',
        marginBottom: '15px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>検索タイプ:</label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'semantic' | 'keyword' | 'hybrid')}
            style={{
              padding: '6px 10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            disabled={isSearching}
          >
            <option value="hybrid">ハイブリッド (推奨)</option>
            <option value="semantic">セマンティック検索</option>
            <option value="keyword">キーワード検索</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>結果件数:</label>
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
            min="1"
            max="20"
            style={{
              width: '60px',
              padding: '6px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              textAlign: 'center'
            }}
            disabled={isSearching}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!query.trim() || isSearching}
        style={{
          backgroundColor: !query.trim() || isSearching ? '#ccc' : '#007bff',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: !query.trim() || isSearching ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s ease'
        }}
      >
        {isSearching ? '検索中...' : '検索'}
      </button>

      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <strong>検索タイプについて:</strong><br />
        • <strong>ハイブリッド:</strong> セマンティック検索とキーワード検索を組み合わせた高精度検索<br />
        • <strong>セマンティック:</strong> 意味の類似性に基づく検索<br />
        • <strong>キーワード:</strong> 単語の一致に基づく従来の検索
      </div>
    </form>
  );
};

export default SearchForm;