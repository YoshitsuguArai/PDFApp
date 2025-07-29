import openai
from typing import List, Dict
import numpy as np
from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        # ローカルのembeddingモデルも使用（ハイブリッド検索用）
        self.local_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def get_openai_embedding(self, text: str, model: str = "text-embedding-3-small") -> List[float]:
        """OpenAI APIを使用してembeddingを取得"""
        try:
            response = self.openai_client.embeddings.create(
                input=text,
                model=model
            )
            return response.data[0].embedding
        except Exception as e:
            raise Exception(f"OpenAI embedding取得エラー: {str(e)}")
    
    def get_local_embedding(self, text: str) -> List[float]:
        """ローカルモデルを使用してembeddingを取得"""
        try:
            embedding = self.local_model.encode(text)
            return embedding.tolist()
        except Exception as e:
            raise Exception(f"ローカルembedding取得エラー: {str(e)}")
    
    def get_batch_embeddings(self, texts: List[str], use_openai: bool = True) -> List[List[float]]:
        """複数テキストのembeddingを一括取得"""
        embeddings = []
        
        if use_openai:
            # OpenAI APIは一度に複数テキストを処理可能
            try:
                response = self.openai_client.embeddings.create(
                    input=texts,
                    model="text-embedding-3-small"
                )
                embeddings = [data.embedding for data in response.data]
            except Exception as e:
                print(f"OpenAI batch embedding失敗、ローカルモデルを使用: {str(e)}")
                embeddings = self.local_model.encode(texts).tolist()
        else:
            embeddings = self.local_model.encode(texts).tolist()
        
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
        
        return dot_product / (norm1 * norm2)