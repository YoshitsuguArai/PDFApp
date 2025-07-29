import requests
import json
import os

# APIのベースURL
BASE_URL = "http://localhost:9000"

def test_api_health():
    """APIの健全性チェック"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"API Health Check: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"API Health Check Failed: {e}")
        return False

def test_document_count():
    """ドキュメント数の取得テスト"""
    try:
        response = requests.get(f"{BASE_URL}/documents/count")
        print(f"Document Count: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Document Count Test Failed: {e}")
        return False

def test_pdf_upload():
    """PDFアップロードのテスト（テストファイルが存在する場合）"""
    try:
        # テストPDFファイルの確認
        test_pdf_path = "test.pdf"
        if not os.path.exists(test_pdf_path):
            print("Test PDF file not found, skipping upload test")
            return True
        
        with open(test_pdf_path, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            response = requests.post(f"{BASE_URL}/upload", files=files)
            
        print(f"PDF Upload: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"PDF Upload Test Failed: {e}")
        return False

def test_search():
    """検索機能のテスト"""
    try:
        search_data = {
            "query": "test",
            "top_k": 3,
            "search_type": "hybrid"
        }
        response = requests.post(f"{BASE_URL}/search", json=search_data)
        print(f"Search Test: {response.status_code}")
        if response.status_code == 200:
            results = response.json()
            print(f"Search Results: {len(results)} results found")
            return True
        else:
            print(f"Search Error: {response.text}")
            return False
    except Exception as e:
        print(f"Search Test Failed: {e}")
        return False

def run_tests():
    """全テストを実行"""
    print("=== API Tests ===")
    
    tests = [
        ("API Health Check", test_api_health),
        ("Document Count", test_document_count),
        ("PDF Upload", test_pdf_upload),
        ("Search Function", test_search)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        result = test_func()
        results.append((test_name, result))
        print(f"Result: {'PASS' if result else 'FAIL'}")
    
    print("\n=== Test Summary ===")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nPassed: {passed}/{total}")
    return passed == total

if __name__ == "__main__":
    run_tests()