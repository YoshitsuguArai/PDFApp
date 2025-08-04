import React from 'react';
import PDFHistory from '../components/PDFHistory';

const PDFHistoryPage: React.FC = () => {
  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <PDFHistory />
    </div>
  );
};

export default PDFHistoryPage;