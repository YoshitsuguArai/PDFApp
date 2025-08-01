import React from 'react';
import { FiUpload, FiSearch, FiFileText, FiFile } from 'react-icons/fi';

interface HeaderProps {
  currentPage: 'upload' | 'search' | 'generate';
  onNavigate: (page: 'upload' | 'search' | 'generate') => void;
  documentCount: number;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, documentCount }) => {
  const buttonStyle = {
    base: {
      display: 'flex',
      alignItems: 'center',
      border: 'none',
      padding: '14px 24px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      borderRadius: '8px',
      transition: 'all 0.3s ease',
      textDecoration: 'none',
      gap: '8px',
      minWidth: '140px',
      justifyContent: 'center'
    },
    active: {
      background: 'rgba(255, 255, 255, 0.15)',
      color: '#ffffff',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      transform: 'translateY(-1px)'
    },
    inactive: {
      background: 'rgba(255, 255, 255, 0.08)',
      color: '#b8c6db',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }
  };

  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* ロゴセクション */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px',
          minWidth: '280px'
        }}>
          <img 
            src="/icon.png" 
            alt="DocuMind Pro" 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
          <div>
            <h1 style={{
              margin: '0',
              fontSize: '24px',
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: '0.3px'
            }}>
              DocuMind Pro
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: '#9fb8d3',
              fontWeight: '400'
            }}>
              Enterprise Document Intelligence
            </p>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav style={{ 
          display: 'flex', 
          gap: '12px',
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={() => onNavigate('upload')}
            style={{
              ...buttonStyle.base,
              ...(currentPage === 'upload' ? buttonStyle.active : buttonStyle.inactive)
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 'upload') {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 'upload') {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#b8c6db';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {/* @ts-ignore */}
            <FiUpload style={{ fontSize: '16px' }} />
            アップロード
          </button>
          <button
            onClick={() => onNavigate('search')}
            style={{
              ...buttonStyle.base,
              ...(currentPage === 'search' ? buttonStyle.active : buttonStyle.inactive)
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 'search') {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 'search') {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#b8c6db';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {/* @ts-ignore */}
            <FiSearch style={{ fontSize: '16px' }} />
            検索
          </button>
          <button
            onClick={() => onNavigate('generate')}
            style={{
              ...buttonStyle.base,
              ...(currentPage === 'generate' ? buttonStyle.active : buttonStyle.inactive)
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 'generate') {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 'generate') {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#b8c6db';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {/* @ts-ignore */}
            <FiFileText style={{ fontSize: '16px' }} />
            資料生成
          </button>
        </nav>

        {/* ステータス表示 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(44, 90, 160, 0.9)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          minWidth: '120px',
          justifyContent: 'center'
        }}>
          {/* @ts-ignore */}
          <FiFile style={{ fontSize: '16px' }} />
          <span>{documentCount}件</span>
        </div>
      </div>
    </header>
  );
};

export default Header;