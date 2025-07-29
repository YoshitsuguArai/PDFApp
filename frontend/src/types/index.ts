export interface SearchResult {
  content: string;
  score: number;
  source: string;
  page?: number;
  search_type?: string;
  page_range?: string;
  total_matches?: number;
  matching_pages_count?: number;
}

export interface SearchQuery {
  query: string;
  top_k?: number;
  search_type?: 'semantic' | 'keyword' | 'hybrid';
}

export interface UploadResponse {
  message: string;
  chunks_created: number;
  total_documents: number;
}