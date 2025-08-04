import openai
from typing import List, Dict, Optional, Tuple, Union, Any
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder
import os
from dotenv import load_dotenv
from functools import lru_cache
import hashlib
from collections import defaultdict
import pickle
from pathlib import Path
import warnings
import logging
import re
from dataclasses import dataclass
import tiktoken

# Hugging Face関連の警告を抑制
warnings.filterwarnings("ignore", category=FutureWarning)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)

load_dotenv()

@dataclass
class SearchResult:
    """検索結果を表すデータクラス"""
    index: int
    score: float
    text: str
    metadata: Optional[Dict[str, Any]] = None
    chunk_indices: Optional[List[int]] = None

class EmbeddingService:
    def __init__(self, cache_dir: Optional[str] = "./embedding_cache", use_auth_token: Optional[str] = None):
        self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Hugging Face tokenを環境変数から取得
        self.hf_token = use_auth_token or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
        
        # 複数のローカルモデルを使用（高性能モデルを追加）
        self.local_models = {}
        self._initialize_local_models()
        
        # デフォルトモデルの設定
        self.default_local_model = 'e5-base' if 'e5-base' in self.local_models else 'mini'
        
        # リランキング用のCross-Encoder（複数モデル）
        self.cross_encoders = {}
        self._initialize_cross_encoders()
        
        # キャッシュの設定
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.embedding_cache = self._load_cache()
        
        # FAISSインデックス（オプション）
        self.index_map = {}
        self.faiss_available = self._check_faiss_availability()
        
        # トークナイザー（チャンク分割用）
        try:
            self.tokenizer = tiktoken.encoding_for_model("gpt-3.5-turbo")
        except:
            self.tokenizer = None
    
    def _initialize_local_models(self):
        """ローカルモデルの初期化（高性能モデルを含む）"""
        models_to_try = [
            ('mini', 'all-MiniLM-L6-v2'),
            ('base', 'all-mpnet-base-v2'),
            ('e5-base', 'intfloat/e5-base-v2'),
            ('e5-large', 'intfloat/e5-large-v2'),
            ('gte-base', 'thenlper/gte-base'),
            ('instructor', 'hkunlp/instructor-base'),
            ('multilingual', 'paraphrase-multilingual-MiniLM-L12-v2')
        ]
        
        for model_name, model_path in models_to_try:
            try:
                kwargs = {
                    'trust_remote_code': True,
                    'device': 'cpu'
                }
                
                if self.hf_token:
                    kwargs['use_auth_token'] = self.hf_token
                
                self.local_models[model_name] = SentenceTransformer(model_path, **kwargs)
                print(f"Successfully loaded model: {model_name}")
            except Exception as e:
                print(f"Failed to load model {model_name}: {str(e)}")
        
        if not self.local_models:
            raise RuntimeError("No local models could be loaded.")
    
    def _initialize_cross_encoders(self):
        """Cross-Encoderの初期化（複数モデル）"""
        cross_encoder_models = [
            ('ms-marco', 'cross-encoder/ms-marco-MiniLM-L-6-v2'),
            ('qnli', 'cross-encoder/qnli-electra-base'),
            ('stsb', 'cross-encoder/stsb-roberta-base')
        ]
        
        for name, model_path in cross_encoder_models:
            try:
                kwargs = {'trust_remote_code': True}
                if self.hf_token:
                    kwargs['use_auth_token'] = self.hf_token
                
                self.cross_encoders[name] = CrossEncoder(model_path, **kwargs)
                print(f"Successfully loaded Cross-Encoder: {name}")
            except Exception as e:
                print(f"Failed to load Cross-Encoder {name}: {str(e)}")
    
    def _check_faiss_availability(self):
        """FAISSが利用可能かチェック"""
        try:
            import faiss
            return True
        except ImportError:
            print("FAISS not available. Install with: pip install faiss-cpu")
            return False
    
    def _load_cache(self) -> Dict:
        """キャッシュをロード"""
        cache_file = self.cache_dir / "embedding_cache.pkl"
        if cache_file.exists():
            try:
                with open(cache_file, 'rb') as f:
                    return pickle.load(f)
            except:
                return {}
        return {}
    
    def _save_cache(self):
        """キャッシュを保存"""
        try:
            cache_file = self.cache_dir / "embedding_cache.pkl"
            with open(cache_file, 'wb') as f:
                pickle.dump(self.embedding_cache, f)
        except Exception as e:
            print(f"Failed to save cache: {str(e)}")
    
    def _get_cache_key(self, text: str, model: str) -> str:
        """テキストとモデルからキャッシュキーを生成"""
        content = f"{model}:{text}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def chunk_text(self, text: str, chunk_size: int = 512, overlap: int = 128) -> List[str]:
        """テキストを意味的に適切なチャンクに分割"""
        if self.tokenizer:
            tokens = self.tokenizer.encode(text)
            chunks = []
            
            for i in range(0, len(tokens), chunk_size - overlap):
                chunk_tokens = tokens[i:i + chunk_size]
                chunk_text = self.tokenizer.decode(chunk_tokens)
                chunks.append(chunk_text)
            
            return chunks
        else:
            # トークナイザーがない場合は文字数ベース
            chunks = []
            sentences = re.split(r'[.!?]+', text)
            current_chunk = ""
            
            for sentence in sentences:
                if len(current_chunk) + len(sentence) < chunk_size * 4:  # 約4文字/トークン
                    current_chunk += sentence + ". "
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = sentence + ". "
            
            if current_chunk:
                chunks.append(current_chunk.strip())
            
            return chunks
    
    def get_openai_embedding(self, text: str, model: str = "text-embedding-3-small") -> List[float]:
        """OpenAI APIを使用してembeddingを取得"""
        cache_key = self._get_cache_key(text, model)
        
        if cache_key in self.embedding_cache:
            return self.embedding_cache[cache_key]
        
        try:
            response = self.openai_client.embeddings.create(
                input=text,
                model=model
            )
            embedding = response.data[0].embedding
            
            self.embedding_cache[cache_key] = embedding
            self._save_cache()
            
            return embedding
        except Exception as e:
            # largeモデルが失敗したらsmallにフォールバック
            if model == "text-embedding-3-large":
                return self.get_openai_embedding(text, "text-embedding-3-small")
            raise Exception(f"OpenAI embedding取得エラー: {str(e)}")
    
    def get_local_embedding(self, text: str, model_name: Optional[str] = None) -> List[float]:
        """ローカルモデルを使用してembeddingを取得"""
        model_name = model_name or self.default_local_model
        
        if model_name not in self.local_models:
            if self.local_models:
                model_name = list(self.local_models.keys())[0]
            else:
                raise ValueError("No local models available")
        
        cache_key = self._get_cache_key(text, f"local_{model_name}")
        
        if cache_key in self.embedding_cache:
            return self.embedding_cache[cache_key]
        
        try:
            model = self.local_models[model_name]
            
            # E5モデルの場合は特別な前処理
            if 'e5' in model_name:
                text = f"query: {text}"
            
            embedding = model.encode(text).tolist()
            
            self.embedding_cache[cache_key] = embedding
            self._save_cache()
            
            return embedding
        except Exception as e:
            raise Exception(f"ローカルembedding取得エラー: {str(e)}")
    
    def expand_query(self, query: str, num_expansions: int = 3) -> List[str]:
        """クエリ拡張（同義語・関連語の生成）"""
        expanded_queries = [query]
        
        try:
            # GPTを使ったクエリ拡張
            prompt = f"""
            以下のクエリに対して、同じ意味や関連する検索クエリを{num_expansions}個生成してください。
            元のクエリ: "{query}"
            
            生成するクエリは以下の条件を満たしてください：
            - 元のクエリと同じ検索意図を持つ
            - 異なる表現や同義語を使用
            - 簡潔で明確
            
            クエリのみを改行区切りで出力してください。
            """
            
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=200
            )
            
            expansions = response.choices[0].message.content.strip().split('\n')
            expanded_queries.extend([q.strip() for q in expansions if q.strip()])
            
        except Exception as e:
            print(f"Query expansion failed: {str(e)}")
        
        return expanded_queries[:num_expansions + 1]
    
    def get_batch_embeddings(self, texts: List[str], use_openai: bool = True, 
                           batch_size: int = 100) -> List[List[float]]:
        """複数テキストのembeddingを一括取得（バッチ処理対応）"""
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_embeddings = []
            
            if use_openai:
                try:
                    uncached_texts = []
                    cached_embeddings = {}
                    
                    for idx, text in enumerate(batch_texts):
                        cache_key = self._get_cache_key(text, "text-embedding-3-small")
                        if cache_key in self.embedding_cache:
                            cached_embeddings[idx] = self.embedding_cache[cache_key]
                        else:
                            uncached_texts.append((idx, text))
                    
                    if uncached_texts:
                        response = self.openai_client.embeddings.create(
                            input=[text for _, text in uncached_texts],
                            model="text-embedding-3-small"
                        )
                        
                        for (idx, text), data in zip(uncached_texts, response.data):
                            cache_key = self._get_cache_key(text, "text-embedding-3-small")
                            self.embedding_cache[cache_key] = data.embedding
                            cached_embeddings[idx] = data.embedding
                    
                    batch_embeddings = [cached_embeddings[idx] for idx in range(len(batch_texts))]
                    
                except Exception as e:
                    print(f"OpenAI batch embedding失敗、ローカルモデルを使用: {str(e)}")
                    if self.local_models:
                        model = list(self.local_models.values())[0]
                        batch_embeddings = model.encode(batch_texts).tolist()
                    else:
                        raise
            else:
                if self.local_models:
                    model = list(self.local_models.values())[0]
                    batch_embeddings = model.encode(batch_texts).tolist()
                else:
                    raise ValueError("No local models available")
            
            embeddings.extend(batch_embeddings)
        
        self._save_cache()
        return embeddings
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """コサイン類似度を計算"""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))
    
    def multi_vector_search(self, query: str, documents: List[str], 
                          chunk_documents: bool = True, k: int = 10) -> List[SearchResult]:
        """マルチベクトル検索（ドキュメントをチャンク化して検索）"""
        all_chunks = []
        chunk_to_doc_map = []
        
        if chunk_documents:
            # ドキュメントをチャンクに分割
            for doc_idx, doc in enumerate(documents):
                chunks = self.chunk_text(doc)
                all_chunks.extend(chunks)
                chunk_to_doc_map.extend([doc_idx] * len(chunks))
        else:
            all_chunks = documents
            chunk_to_doc_map = list(range(len(documents)))
        
        # クエリ拡張
        expanded_queries = self.expand_query(query)
        
        # 各クエリでembeddingを取得
        query_embeddings = []
        for q in expanded_queries:
            query_embeddings.append(self.get_openai_embedding(q))
        
        # チャンクのembeddingを取得
        chunk_embeddings = self.get_batch_embeddings(all_chunks)
        
        # 各クエリに対する類似度を計算
        all_scores = []
        for query_emb in query_embeddings:
            scores = [self.cosine_similarity(query_emb, chunk_emb) 
                     for chunk_emb in chunk_embeddings]
            all_scores.append(scores)
        
        # スコアを統合（最大値を取る）
        final_scores = np.max(all_scores, axis=0)
        
        # ドキュメントごとに最高スコアを集計
        doc_scores = defaultdict(float)
        doc_chunks = defaultdict(list)
        
        for chunk_idx, (doc_idx, score) in enumerate(zip(chunk_to_doc_map, final_scores)):
            if score > doc_scores[doc_idx]:
                doc_scores[doc_idx] = score
            doc_chunks[doc_idx].append((chunk_idx, score))
        
        # 上位k件のドキュメントを取得
        top_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)[:k]
        
        results = []
        for doc_idx, score in top_docs:
            # 関連するチャンクのインデックスを取得
            chunk_indices = [idx for idx, _ in sorted(doc_chunks[doc_idx], 
                                                     key=lambda x: x[1], reverse=True)[:3]]
            
            results.append(SearchResult(
                index=doc_idx,
                score=float(score),
                text=documents[doc_idx][:200] + '...' if len(documents[doc_idx]) > 200 else documents[doc_idx],
                chunk_indices=chunk_indices
            ))
        
        return results
    
    def hybrid_search_advanced(self, query: str, documents: List[str], 
                             weights: Dict[str, float] = None, k: int = 10) -> List[SearchResult]:
        """高度なハイブリッド検索（複数モデルの重み付き統合）"""
        if weights is None:
            weights = {
                'openai': 0.4,
                'e5-large': 0.3,
                'e5-base': 0.2,
                'mini': 0.1
            }
        
        # 利用可能なモデルのみ使用
        available_weights = {name: w for name, w in weights.items() 
                           if name == 'openai' or name in self.local_models}
        
        # 重みを正規化
        total_weight = sum(available_weights.values())
        normalized_weights = {name: w/total_weight for name, w in available_weights.items()}
        
        all_scores = {}
        
        # OpenAI embeddings
        if 'openai' in normalized_weights:
            query_emb = self.get_openai_embedding(query)
            doc_embs = self.get_batch_embeddings(documents, use_openai=True)
            scores = [self.cosine_similarity(query_emb, doc_emb) for doc_emb in doc_embs]
            all_scores['openai'] = np.array(scores)
        
        # Local model embeddings
        for model_name in self.local_models:
            if model_name in normalized_weights:
                query_emb = self.get_local_embedding(query, model_name)
                doc_embs = self.get_batch_embeddings(documents, use_openai=False)
                scores = [self.cosine_similarity(query_emb, doc_emb) for doc_emb in doc_embs]
                all_scores[model_name] = np.array(scores)
        
        # スコアを正規化して統合
        final_scores = np.zeros(len(documents))
        for model_name, scores in all_scores.items():
            if scores.max() > 0:
                normalized_scores = scores / scores.max()
                final_scores += normalized_weights[model_name] * normalized_scores
        
        # 上位k件を取得
        top_indices = np.argsort(final_scores)[-k:][::-1]
        
        results = []
        for idx in top_indices:
            results.append(SearchResult(
                index=int(idx),
                score=float(final_scores[idx]),
                text=documents[idx][:200] + '...' if len(documents[idx]) > 200 else documents[idx]
            ))
        
        return results
    
    def rerank_results_advanced(self, query: str, documents: List[str], 
                              initial_results: List[SearchResult], 
                              top_k: int = 5) -> List[SearchResult]:
        """高度なリランキング（複数のCross-Encoderを使用）"""
        if not self.cross_encoders:
            return initial_results[:top_k]
        
        candidate_docs = [(r.index, documents[r.index]) for r in initial_results]
        all_scores = {}
        
        # 各Cross-Encoderでスコアリング
        for encoder_name, encoder in self.cross_encoders.items():
            try:
                pairs = [[query, doc] for _, doc in candidate_docs]
                scores = encoder.predict(pairs)
                all_scores[encoder_name] = scores
            except Exception as e:
                print(f"Cross-encoder {encoder_name} failed: {str(e)}")
        
        if not all_scores:
            return initial_results[:top_k]
        
        # スコアを統合（平均）
        final_scores = np.mean(list(all_scores.values()), axis=0)
        
        # 初期スコアと組み合わせ（0.3:0.7の比率）
        combined_scores = []
        for i, (idx, _) in enumerate(candidate_docs):
            initial_score = next(r.score for r in initial_results if r.index == idx)
            combined_score = 0.3 * initial_score + 0.7 * final_scores[i]
            combined_scores.append((idx, combined_score))
        
        # ソートして上位k件を返す
        reranked = sorted(combined_scores, key=lambda x: x[1], reverse=True)[:top_k]
        
        results = []
        for idx, score in reranked:
            results.append(SearchResult(
                index=idx,
                score=float(score),
                text=documents[idx][:200] + '...' if len(documents[idx]) > 200 else documents[idx]
            ))
        
        return results
    
    def semantic_search_pro(self, query: str, documents: List[str], 
                           search_mode: str = 'hybrid_advanced',
                           use_chunks: bool = True,
                           use_reranking: bool = True,
                           k: int = 10, 
                           rerank_top_k: int = 5) -> List[Dict[str, Union[int, float, str]]]:
        """プロフェッショナル版セマンティック検索"""
        
        # 検索モードの選択
        if search_mode == 'multi_vector' and use_chunks:
            initial_results = self.multi_vector_search(query, documents, chunk_documents=True, k=k)
        elif search_mode == 'hybrid_advanced':
            initial_results = self.hybrid_search_advanced(query, documents, k=k)
        else:
            # 標準のハイブリッド検索
            initial_results = self.hybrid_search(query, documents, k=k)
            initial_results = [SearchResult(idx, score, documents[idx][:200] + '...' if len(documents[idx]) > 200 else documents[idx]) 
                             for idx, score in initial_results]
        
        # リランキング
        if use_reranking and len(initial_results) > 0:
            final_results = self.rerank_results_advanced(query, documents, initial_results, top_k=rerank_top_k)
        else:
            final_results = initial_results[:rerank_top_k]
        
        # 結果を辞書形式に変換
        return [
            {
                'index': r.index,
                'score': r.score,
                'text': r.text,
                'chunk_indices': r.chunk_indices if hasattr(r, 'chunk_indices') else None
            }
            for r in final_results
        ]
    
    def batch_cosine_similarity(self, query_embedding: List[float], 
                               embeddings: List[List[float]]) -> np.ndarray:
        """バッチでコサイン類似度を計算（高速化）"""
        query_vec = np.array(query_embedding)
        embeddings_matrix = np.array(embeddings)
        
        # 正規化
        query_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
        embeddings_norm = embeddings_matrix / (np.linalg.norm(embeddings_matrix, axis=1, keepdims=True) + 1e-10)
        
        # 内積でコサイン類似度を計算
        similarities = np.dot(embeddings_norm, query_norm)
        
        return similarities