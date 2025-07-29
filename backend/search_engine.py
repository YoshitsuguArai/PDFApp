import chromadb
from typing import List, Dict, Optional
from embedding_service import EmbeddingService
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import json
import os
import pickle

class HybridSearchEngine:
    def __init__(self, persist_directory: str = "chroma_db"):
        self.embedding_service = EmbeddingService()
        self.persist_directory = persist_directory
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.documents = []
        self.tfidf_matrix = None
        self.documents_file = os.path.join(persist_directory, "documents.json")
        self.tfidf_data_file = os.path.join(persist_directory, "tfidf_data.pkl")
        
        # 永続化データを読み込み
        self._load_persistent_data()
    
    def _load_persistent_data(self):
        """永続化されたデータを読み込み"""
        try:
            # documents.jsonからドキュメントデータを読み込み
            if os.path.exists(self.documents_file):
                with open(self.documents_file, 'r', encoding='utf-8') as f:
                    self.documents = json.load(f)
                print(f"Loaded {len(self.documents)} documents from persistent storage")
            
            # TF-IDFデータを読み込み
            if os.path.exists(self.tfidf_data_file) and self.documents:
                with open(self.tfidf_data_file, 'rb') as f:
                    tfidf_data = pickle.load(f)
                    self.tfidf_vectorizer = tfidf_data['vectorizer']
                    self.tfidf_matrix = tfidf_data['matrix']
                print("Loaded TF-IDF data from persistent storage")
        except Exception as e:
            print(f"Error loading persistent data: {str(e)}")
            self.documents = []
            self.tfidf_matrix = None
    
    def _save_persistent_data(self):
        """データを永続化ストレージに保存"""
        try:
            # ディレクトリが存在しない場合は作成
            os.makedirs(self.persist_directory, exist_ok=True)
            
            # documents.jsonにドキュメントデータを保存
            with open(self.documents_file, 'w', encoding='utf-8') as f:
                json.dump(self.documents, f, ensure_ascii=False, indent=2)
            
            # TF-IDFデータを保存
            if self.tfidf_vectorizer and self.tfidf_matrix is not None:
                tfidf_data = {
                    'vectorizer': self.tfidf_vectorizer,
                    'matrix': self.tfidf_matrix
                }
                with open(self.tfidf_data_file, 'wb') as f:
                    pickle.dump(tfidf_data, f)
            
            print("Persistent data saved successfully")
        except Exception as e:
            print(f"Error saving persistent data: {str(e)}")
    
    def add_documents(self, documents: List[Dict[str, any]]):
        """ドキュメントをベクトルデータベースに追加"""
        texts = [doc['content'] for doc in documents]
        
        # OpenAI embeddingsを取得
        embeddings = self.embedding_service.get_batch_embeddings(texts)
        
        # ChromaDBに追加
        ids = [doc['id'] for doc in documents]
        metadatas = [{
            'source': doc['source'],
            'page': doc['page'],
            'chunk_index': doc['chunk_index']
        } for doc in documents]
        
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        
        # TF-IDF用にドキュメントを保存
        self.documents.extend(documents)
        self._update_tfidf_matrix()
        
        # 永続化データを保存
        self._save_persistent_data()
    
    def _update_tfidf_matrix(self):
        """TF-IDF行列を更新"""
        if self.documents:
            texts = [doc['content'] for doc in self.documents]
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
    
    def semantic_search(self, query: str, top_k: int = 10) -> List[Dict[str, any]]:
        """セマンティック検索（ベクトル検索）"""
        query_embedding = self.embedding_service.get_openai_embedding(query)
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        
        search_results = []
        if results['documents'] and results['documents'][0]:
            for i, (doc, metadata, distance) in enumerate(zip(
                results['documents'][0],
                results['metadatas'][0],
                results['distances'][0]
            )):
                search_results.append({
                    'content': doc,
                    'score': 1 - distance,  # distanceを類似度スコアに変換
                    'source': metadata['source'],
                    'page': metadata['page'],
                    'search_type': 'semantic'
                })
        
        return search_results
    
    def keyword_search(self, query: str, top_k: int = 10) -> List[Dict[str, any]]:
        """キーワード検索（TF-IDF）"""
        if not self.documents or self.tfidf_matrix is None:
            return []
        
        query_vector = self.tfidf_vectorizer.transform([query])
        scores = (self.tfidf_matrix * query_vector.T).toarray().flatten()
        
        # スコアでソート
        top_indices = np.argsort(scores)[::-1][:top_k]
        
        search_results = []
        for idx in top_indices:
            if scores[idx] > 0:  # スコアが0以上のもののみ
                doc = self.documents[idx]
                search_results.append({
                    'content': doc['content'],
                    'score': float(scores[idx]),
                    'source': doc['source'],
                    'page': doc['page'],
                    'search_type': 'keyword'
                })
        
        return search_results
    
    def hybrid_search(self, query: str, top_k: int = 10, semantic_weight: float = 0.7) -> List[Dict[str, any]]:
        """ハイブリッド検索（セマンティック + キーワード）"""
        # セマンティック検索
        semantic_results = self.semantic_search(query, top_k * 2)
        
        # キーワード検索
        keyword_results = self.keyword_search(query, top_k * 2)
        
        # 結果をマージしてスコアを統合
        combined_results = {}
        
        # セマンティック検索結果を追加
        for result in semantic_results:
            doc_key = f"{result['source']}_{result['page']}_{result['content'][:50]}"
            combined_results[doc_key] = {
                **result,
                'semantic_score': result['score'],
                'keyword_score': 0.0,
                'search_type': 'hybrid'
            }
        
        # キーワード検索結果を追加/更新
        for result in keyword_results:
            doc_key = f"{result['source']}_{result['page']}_{result['content'][:50]}"
            if doc_key in combined_results:
                combined_results[doc_key]['keyword_score'] = result['score']
            else:
                combined_results[doc_key] = {
                    **result,
                    'semantic_score': 0.0,
                    'keyword_score': result['score'],
                    'search_type': 'hybrid'
                }
        
        # 統合スコアを計算
        for result in combined_results.values():
            # スコアを正規化
            semantic_score = result['semantic_score']
            keyword_score = result['keyword_score']
            
            # ハイブリッドスコア計算
            result['score'] = (semantic_weight * semantic_score + 
                             (1 - semantic_weight) * keyword_score)
        
        # スコアでソートして上位top_k件を返す
        sorted_results = sorted(
            combined_results.values(),
            key=lambda x: x['score'],
            reverse=True
        )
        
        return sorted_results[:top_k]
    
    def get_document_count(self) -> int:
        """保存されているドキュメント数を取得"""
        return len(self.documents)
    
    def remove_documents_by_source(self, source: str):
        """指定されたソース（PDFファイル）のドキュメントを削除"""
        try:
            # ChromaDBから削除
            all_results = self.collection.get()
            ids_to_delete = []
            
            for i, metadata in enumerate(all_results['metadatas']):
                if metadata.get('source') == source:
                    ids_to_delete.append(all_results['ids'][i])
            
            if ids_to_delete:
                self.collection.delete(ids=ids_to_delete)
                print(f"Deleted {len(ids_to_delete)} chunks from ChromaDB for source: {source}")
            
            # documentsリストからも削除
            original_count = len(self.documents)
            self.documents = [doc for doc in self.documents if doc.get('source') != source]
            removed_count = original_count - len(self.documents)
            
            if removed_count > 0:
                # TF-IDF行列を再構築
                self._update_tfidf_matrix()
                # 永続化データを保存
                self._save_persistent_data()
                print(f"Removed {removed_count} documents for source: {source}")
            
            return removed_count
        except Exception as e:
            print(f"Error removing documents for source {source}: {str(e)}")
            return 0
    
    def get_document_sources(self) -> List[str]:
        """保存されているドキュメントのソース一覧を取得"""
        sources = set()
        for doc in self.documents:
            if doc.get('source'):
                sources.add(doc['source'])
        return list(sources)
    
    def get_documents_by_source(self, source: str) -> List[Dict[str, any]]:
        """指定されたソースのドキュメント一覧を取得"""
        return [doc for doc in self.documents if doc.get('source') == source]
    
    def clear_database(self):
        """データベースをクリア"""
        try:
            self.client.delete_collection("documents")
            self.collection = self.client.get_or_create_collection(
                name="documents",
                metadata={"hnsw:space": "cosine"}
            )
            self.documents = []
            self.tfidf_matrix = None
            
            # 永続化ファイルも削除
            if os.path.exists(self.documents_file):
                os.remove(self.documents_file)
            if os.path.exists(self.tfidf_data_file):
                os.remove(self.tfidf_data_file)
                
            print("Database and persistent data cleared successfully")
        except Exception as e:
            print(f"データベースクリアエラー: {str(e)}")