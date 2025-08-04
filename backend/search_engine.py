import chromadb
from typing import List, Dict, Optional
from embedding_service import EmbeddingService
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import json
import os
import pickle
import re
import unicodedata

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
            max_features=10000,
            stop_words='english', 
            ngram_range=(1, 3),
            min_df=1,
            max_df=0.95,
            sublinear_tf=True
        )
        self.documents = []
        self.tfidf_matrix = None
        self.documents_file = os.path.join(persist_directory, "documents.json")
        self.tfidf_data_file = os.path.join(persist_directory, "tfidf_data.pkl")
        
        # 永続化データを読み込み
        self._load_persistent_data()
    
    def _preprocess_text(self, text: str) -> str:
        """テキストの前処理（日本語対応）"""
        # Unicode正規化
        text = unicodedata.normalize('NFKC', text)
        
        # 余分な空白を削除
        text = re.sub(r'\s+', ' ', text)
        
        # 改行をスペースに変換
        text = text.replace('\n', ' ').replace('\r', ' ')
        
        # 先頭末尾の空白を削除
        text = text.strip()
        
        return text
    
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
        # テキストの前処理
        texts = [self._preprocess_text(doc['content']) for doc in documents]
        
        # 空のテキストを除外
        valid_documents = []
        valid_texts = []
        for i, text in enumerate(texts):
            if text.strip():
                valid_documents.append(documents[i])
                valid_texts.append(text)
        
        if not valid_texts:
            print("Warning: No valid texts to add")
            return
        
        # OpenAI embeddingsを取得
        embeddings = self.embedding_service.get_batch_embeddings(valid_texts)
        
        # ChromaDBに追加
        ids = [doc['id'] for doc in valid_documents]
        metadatas = [{
            'source': doc['source'],
            'page': doc['page'],
            'chunk_index': doc['chunk_index']
        } for doc in valid_documents]
        
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=valid_texts,
            metadatas=metadatas
        )
        
        # TF-IDF用にドキュメントを保存
        self.documents.extend(valid_documents)
        self._update_tfidf_matrix()
        
        # 永続化データを保存
        self._save_persistent_data()
    
    def _update_tfidf_matrix(self):
        """TF-IDF行列を更新"""
        if self.documents:
            texts = [self._preprocess_text(doc['content']) for doc in self.documents]
            # 空のテキストを除外
            texts = [text for text in texts if text.strip()]
            if texts:
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
        
        # クエリも前処理
        processed_query = self._preprocess_text(query)
        query_vector = self.tfidf_vectorizer.transform([processed_query])
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
    
    def _calculate_adaptive_weights(self, query: str) -> tuple:
        """クエリの特性に基づいて適応的な重みを計算"""
        # クエリの長さ
        query_length = len(query.split())
        
        # 数値や特定のキーワードが含まれているかチェック
        has_numbers = any(char.isdigit() for char in query)
        has_quotes = '"' in query or "'" in query
        
        # 短いクエリや特定のキーワードはキーワード検索を重視
        if query_length <= 2 or has_numbers or has_quotes:
            semantic_weight = 0.4
        elif query_length <= 4:
            semantic_weight = 0.6
        else:
            # 長いクエリはセマンティック検索を重視
            semantic_weight = 0.75
        
        return semantic_weight, 1 - semantic_weight

    def hybrid_search(self, query: str, top_k: int = 10, semantic_weight: float = None) -> List[Dict[str, any]]:
        """改善されたハイブリッド検索"""
        # 適応的な重み計算
        if semantic_weight is None:
            semantic_weight, keyword_weight = self._calculate_adaptive_weights(query)
        else:
            keyword_weight = 1 - semantic_weight
        
        # セマンティック検索とキーワード検索を実行
        semantic_results = self.semantic_search(query, top_k * 3)
        keyword_results = self.keyword_search(query, top_k * 3)
        
        # スコアを正規化
        semantic_results = self._normalize_scores(semantic_results, 'semantic')
        keyword_results = self._normalize_scores(keyword_results, 'keyword')
        
        # 結果をマージしてスコアを統合
        combined_results = {}
        
        # セマンティック検索結果を追加
        for result in semantic_results:
            doc_key = f"{result['source']}_{result['page']}_{result['content'][:50]}"
            combined_results[doc_key] = {
                **result,
                'semantic_score': result['normalized_score'],
                'keyword_score': 0.0,
                'original_semantic_score': result['score'],
                'original_keyword_score': 0.0,
                'search_type': 'hybrid'
            }
        
        # キーワード検索結果を追加/更新
        for result in keyword_results:
            doc_key = f"{result['source']}_{result['page']}_{result['content'][:50]}"
            if doc_key in combined_results:
                combined_results[doc_key]['keyword_score'] = result['normalized_score']
                combined_results[doc_key]['original_keyword_score'] = result['score']
            else:
                combined_results[doc_key] = {
                    **result,
                    'semantic_score': 0.0,
                    'keyword_score': result['normalized_score'],
                    'original_semantic_score': 0.0,
                    'original_keyword_score': result['score'],
                    'search_type': 'hybrid'
                }
        
        # 統合スコアを計算
        for result in combined_results.values():
            semantic_score = result['semantic_score']
            keyword_score = result['keyword_score']
            
            # 両方のスコアがある場合はボーナス
            both_present_bonus = 1.1 if semantic_score > 0 and keyword_score > 0 else 1.0
            
            # ハイブリッドスコア計算
            hybrid_score = (semantic_weight * semantic_score + 
                           keyword_weight * keyword_score)
            
            # スコアが1.0を超えないように制限
            result['score'] = min(1.0, hybrid_score * both_present_bonus)
            result['semantic_weight'] = semantic_weight
            result['keyword_weight'] = keyword_weight
        
        # スコアでソートして上位top_k件を返す
        sorted_results = sorted(
            combined_results.values(),
            key=lambda x: x['score'],
            reverse=True
        )
        
        return sorted_results[:top_k]
    
    def _normalize_scores(self, results: List[Dict[str, any]], score_type: str) -> List[Dict[str, any]]:
        """スコアを0-1の範囲に正規化"""
        if not results:
            return results
        
        scores = [r['score'] for r in results]
        min_score = min(scores)
        max_score = max(scores)
        
        # 最大値と最小値が同じ場合の処理
        if max_score == min_score:
            for result in results:
                result['normalized_score'] = 1.0 if max_score > 0 else 0.0
        else:
            for result in results:
                result['normalized_score'] = (result['score'] - min_score) / (max_score - min_score)
        
        return results
    
    def _calculate_page_dispersion_bonus(self, pages: List[int]) -> float:
        """ページ分散度に基づくボーナススコア"""
        if len(pages) <= 1:
            return 1.0
        
        # ページ数が多いほど、かつ分散しているほど高いボーナス
        page_count_bonus = min(1.2, 1.0 + (len(pages) - 1) * 0.05)
        
        # ページの分散度を計算
        page_range = max(pages) - min(pages) + 1
        dispersion = len(pages) / page_range if page_range > 0 else 1.0
        dispersion_bonus = 1.0 + (dispersion - 1.0) * 0.1
        
        return page_count_bonus * dispersion_bonus
    
    def _calculate_chunk_density_score(self, chunk_count: int, total_pages: int) -> float:
        """チャンク密度に基づくスコア調整"""
        if total_pages == 0:
            return 1.0
        
        density = chunk_count / total_pages
        # 適度な密度（1-3チャンク/ページ）を最適とする
        if density <= 3.0:
            return 1.0 + density * 0.1  # 密度が高いほど少しボーナス
        else:
            return 1.0 + 0.3 - (density - 3.0) * 0.05  # 過度に高い密度はペナルティ
    
    def _aggregate_results_by_file(self, results: List[Dict[str, any]]) -> List[Dict[str, any]]:
        """改善されたファイル単位での結果集計"""
        file_results = {}
        
        for result in results:
            source = result['source']
            if source not in file_results:
                file_results[source] = {
                    'source': source,
                    'max_score': result['score'],
                    'scores': [result['score']],
                    'chunk_count': 1,
                    'total_score': result['score'],
                    'best_chunk': result['content'],
                    'pages': [result['page']],
                    'search_type': result.get('search_type', 'unknown'),
                    'chunks': [result]
                }
            else:
                file_info = file_results[source]
                file_info['chunk_count'] += 1
                file_info['scores'].append(result['score'])
                file_info['total_score'] += result['score']
                file_info['chunks'].append(result)
                
                # 最高スコアのチャンクを保持
                if result['score'] > file_info['max_score']:
                    file_info['max_score'] = result['score']
                    file_info['best_chunk'] = result['content']
                
                # ページ番号を追加（重複を避ける）
                if result['page'] not in file_info['pages']:
                    file_info['pages'].append(result['page'])
        
        # 改善されたスコア計算
        for file_info in file_results.values():
            scores = file_info['scores']
            chunk_count = file_info['chunk_count']
            pages = file_info['pages']
            
            # 基本統計値
            max_score = max(scores)
            avg_score = sum(scores) / len(scores)
            median_score = sorted(scores)[len(scores) // 2]
            
            # トップ3チャンクの平均（重要な部分を重視）
            top_scores = sorted(scores, reverse=True)[:min(3, len(scores))]
            top3_avg = sum(top_scores) / len(top_scores)
            
            # 各要素のスコア
            relevance_score = (max_score * 0.4 + top3_avg * 0.4 + median_score * 0.2)
            
            # ページ分散ボーナス
            page_bonus = self._calculate_page_dispersion_bonus(pages)
            
            # チャンク密度調整
            density_adjustment = self._calculate_chunk_density_score(chunk_count, len(pages))
            
            # 一貫性スコア（スコアの標準偏差の逆数）
            if len(scores) > 1:
                score_std = np.std(scores)
                consistency_bonus = 1.0 + (1.0 / (1.0 + score_std)) * 0.1
            else:
                consistency_bonus = 1.0
            
            # 最終スコア計算
            file_info['relevance_score'] = relevance_score
            file_info['page_bonus'] = page_bonus
            file_info['density_adjustment'] = density_adjustment
            file_info['consistency_bonus'] = consistency_bonus
            file_info['avg_score'] = avg_score
            file_info['median_score'] = median_score
            file_info['top3_avg'] = top3_avg
            
            # 統合スコア
            file_info['score'] = (relevance_score * page_bonus * 
                                density_adjustment * consistency_bonus)
            
            file_info['pages'].sort()
            # chunksリストを削除（メモリ節約）
            del file_info['chunks']
            del file_info['scores']
        
        # スコアでソート
        return sorted(file_results.values(), key=lambda x: x['score'], reverse=True)
    
    def semantic_search_by_file(self, query: str, top_k: int = 10) -> List[Dict[str, any]]:
        """ファイル単位でのセマンティック検索"""
        chunk_results = self.semantic_search(query, top_k * 10)
        return self._aggregate_results_by_file(chunk_results)[:top_k]
    
    def keyword_search_by_file(self, query: str, top_k: int = 10) -> List[Dict[str, any]]:
        """ファイル単位でのキーワード検索"""
        chunk_results = self.keyword_search(query, top_k * 10)
        return self._aggregate_results_by_file(chunk_results)[:top_k]
    
    def hybrid_search_by_file(self, query: str, top_k: int = 10, semantic_weight: float = 0.7) -> List[Dict[str, any]]:
        """ファイル単位でのハイブリッド検索"""
        chunk_results = self.hybrid_search(query, top_k * 10, semantic_weight)
        return self._aggregate_results_by_file(chunk_results)[:top_k]
    
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