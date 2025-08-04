import React, { useState } from 'react';
import { SearchQuery } from '../types';
import { FiSearch, FiSettings, FiZap, FiCpu, FiType, FiTrendingUp } from 'react-icons/fi';

interface SearchFormProps {
  onSearch: (query: SearchQuery) => void;
  isSearching: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, isSearching }) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [topK, setTopK] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const getSearchTypeConfig = (type: string) => {
    switch (type) {
      case 'hybrid':
        return {
          icon: FiZap,
          color: '#007bff',
          bgColor: '#e3f2fd',
          label: 'ハイブリッド',
          description: 'AI + キーワード検索'
        };
      case 'semantic':
        return {
          icon: FiCpu,
          color: '#28a745',
          bgColor: '#e8f5e8',
          label: 'セマンティック',
          description: 'AI意味理解検索'
        };
      case 'keyword':
        return {
          icon: FiType,
          color: '#dc3545',
          bgColor: '#f8d7da',
          label: 'キーワード',
          description: '従来の文字列検索'
        };
      default:
        return {
          icon: FiZap,
          color: '#007bff',
          bgColor: '#e3f2fd',
          label: 'ハイブリッド',
          description: 'AI + キーワード検索'
        };
    }
  };

  const currentConfig = getSearchTypeConfig(searchType);

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* メイン検索バー */}
      <form onSubmit={handleSubmit}>
        <div style={{ 
          position: 'relative',
          marginBottom: '20px'
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
            border: '2px solid #e9ecef',
            borderRadius: '16px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s ease'
          }}
          onFocus={() => {
            const parent = document.querySelector('.search-container') as HTMLElement;
            if (parent) {
              parent.style.borderColor = '#007bff';
              parent.style.boxShadow = '0 6px 20px rgba(0, 123, 255, 0.15)';
            }
          }}
          onBlur={() => {
            const parent = document.querySelector('.search-container') as HTMLElement;
            if (parent) {
              parent.style.borderColor = '#e9ecef';
              parent.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
            }
          }}
          className="search-container"
          >
            {/* 検索タイプインジケーター */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: currentConfig.bgColor,
              padding: '8px 12px',
              borderRadius: '12px',
              marginRight: '12px',
              minWidth: '140px',
              border: `1px solid ${currentConfig.color}20`
            }}>
              {/* @ts-ignore */}
              <currentConfig.icon style={{ 
                fontSize: '16px', 
                color: currentConfig.color,
                marginRight: '6px'
              }} />
              <div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: currentConfig.color,
                  lineHeight: '1'
                }}>
                  {currentConfig.label}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: currentConfig.color + '99',
                  lineHeight: '1.2',
                  marginTop: '1px'
                }}>
                  {currentConfig.description}
                </div>
              </div>
            </div>

            {/* 検索入力フィールド */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索したい内容を入力してください... (例: 売上分析、マーケティング戦略など)"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                padding: '16px 8px',
                backgroundColor: 'transparent',
                color: '#2c3e50'
              }}
              disabled={isSearching}
            />

            {/* 検索ボタン */}
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              style={{
                background: !query.trim() || isSearching 
                  ? 'linear-gradient(135deg, #adb5bd 0%, #6c757d 100%)'
                  : 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: !query.trim() || isSearching ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: !query.trim() || isSearching 
                  ? 'none'
                  : '0 4px 12px rgba(0, 123, 255, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!isSearching && query.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 123, 255, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSearching && query.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)';
                }
              }}
            >
              {/* @ts-ignore */}
              <FiSearch style={{ 
                fontSize: '18px',
                animation: isSearching ? 'spin 1s linear infinite' : 'none'
              }} />
              {isSearching ? '検索中...' : '検索'}
            </button>
          </div>
        </div>
      </form>

      {/* 詳細設定トグル */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: '0 auto'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* @ts-ignore */}
          <FiSettings style={{ 
            fontSize: '14px',
            transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }} />
          {showAdvanced ? '詳細設定を隠す' : '詳細設定を表示'}
        </button>
      </div>

      {/* 詳細設定パネル */}
      {showAdvanced && (
        <div style={{
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          <h4 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {/* @ts-ignore */}
            <FiTrendingUp style={{ fontSize: '16px' }} />
            検索設定
          </h4>

          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            alignItems: 'start'
          }}>
            {/* 検索タイプ選択 */}
            <div>
              <label style={{ 
                display: 'block',
                fontSize: '14px', 
                fontWeight: '600',
                marginBottom: '12px',
                color: '#495057'
              }}>
                検索タイプ
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'hybrid', ...getSearchTypeConfig('hybrid') },
                  { value: 'semantic', ...getSearchTypeConfig('semantic') },
                  { value: 'keyword', ...getSearchTypeConfig('keyword') }
                ].map((option) => (
                  <label key={option.value} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `2px solid ${searchType === option.value ? option.color : '#e9ecef'}`,
                    backgroundColor: searchType === option.value ? option.bgColor : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="searchType"
                      value={option.value}
                      checked={searchType === option.value}
                      onChange={(e) => setSearchType(e.target.value as any)}
                      style={{ marginRight: '12px' }}
                      disabled={isSearching}
                    />
                    {/* @ts-ignore */}
                    <option.icon style={{ 
                      fontSize: '16px',
                      color: option.color,
                      marginRight: '8px'
                    }} />
                    <div>
                      <div style={{
                        fontWeight: '600',
                        color: searchType === option.value ? option.color : '#495057',
                        fontSize: '14px'
                      }}>
                        {option.label}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6c757d'
                      }}>
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 結果件数設定 */}
            <div>
              <label style={{ 
                display: 'block',
                fontSize: '14px', 
                fontWeight: '600',
                marginBottom: '12px',
                color: '#495057'
              }}>
                検索結果件数: {topK}件
              </label>
              <input
                type="range"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                min="1"
                max="20"
                style={{
                  width: '100%',
                  marginBottom: '8px'
                }}
                disabled={isSearching}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#6c757d'
              }}>
                <span>1件</span>
                <span>20件</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 検索タイプの説明 */}
      <div style={{
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '16px',
        fontSize: '13px',
        color: '#6c757d',
        lineHeight: '1.5'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
          💡 検索タイプについて
        </div>
        <div style={{ display: 'grid', gap: '4px' }}>
          <div><strong>ハイブリッド:</strong> AIの意味理解とキーワード検索を組み合わせた最高精度の検索（推奨）</div>
          <div><strong>セマンティック:</strong> AIが文書の意味を理解して関連性の高い情報を検索</div>
          <div><strong>キーワード:</strong> 入力した単語と完全一致または部分一致する文書を検索</div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SearchForm;