import axios from 'axios';
import { SearchQuery, SearchResult, FileSearchResult, UploadResponse, GenerateDocumentRequest, GeneratedDocument } from '../types';

const API_BASE_URL = 'http://localhost:9000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分タイムアウト
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadPDF = async (file: File): Promise<UploadResponse> => {
  console.log('Uploading file:', file.name, 'Type:', file.type, 'Size:', file.size);
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('Upload response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Upload error:', error.response?.data || error.message);
    throw error;
  }
};

export const searchDocuments = async (query: SearchQuery): Promise<SearchResult[]> => {
  console.log('Search request:', query);
  
  try {
    const response = await api.post('/search', query);
    console.log('Search response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Search error:', error.response?.data || error.message);
    throw error;
  }
};

export const searchFiles = async (query: SearchQuery): Promise<FileSearchResult[]> => {
  console.log('File search request:', query);
  
  try {
    const response = await api.post('/search/files', query);
    console.log('File search response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('File search error:', error.response?.data || error.message);
    throw error;
  }
};

export const getDocumentCount = async (): Promise<{ count: number }> => {
  const response = await api.get('/documents/count');
  return response.data;
};

export const clearDocuments = async (): Promise<{ message: string }> => {
  const response = await api.delete('/documents');
  return response.data;
};

export const generateDocument = async (request: GenerateDocumentRequest): Promise<GeneratedDocument> => {
  console.log('Generate document request:', request);
  
  try {
    const response = await api.post('/generate-document', request);
    console.log('Generate document response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Generate document error:', error.response?.data || error.message);
    throw error;
  }
};

export const downloadGeneratedPdf = async (filename: string): Promise<Blob> => {
  console.log('Downloading PDF:', filename);
  try {
    const response = await api.get(`/generated-pdf/${filename}`, {
      responseType: 'blob'
    });
    console.log('Download completed');
    return response.data;
  } catch (error: any) {
    console.error('PDF download error:', error.response?.data || error.message);
    throw error;
  }
};