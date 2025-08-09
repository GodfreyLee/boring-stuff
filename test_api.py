#!/usr/bin/env python3
"""
Test script for the Document Renaming API
"""

import requests
import os
import sys

def test_health_check(base_url):
    """Test the health check endpoint"""
    print("Testing health check endpoint...")
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Health check failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")

def test_api_info(base_url):
    """Test the API information endpoint"""
    print("\nTesting API information endpoint...")
    try:
        response = requests.get(base_url)
        if response.status_code == 200:
            print("✅ API info endpoint working")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ API info failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ API info error: {e}")

def test_document_rename(base_url, pdf_path):
    """Test the document renaming endpoint"""
    print(f"\nTesting document rename endpoint with {pdf_path}...")
    
    if not os.path.exists(pdf_path):
        print(f"❌ Test PDF file not found: {pdf_path}")
        return
    
    try:
        with open(pdf_path, 'rb') as f:
            files = {'file': (os.path.basename(pdf_path), f, 'application/pdf')}
            response = requests.post(f"{base_url}/rename-document", files=files)
        
        if response.status_code == 200:
            print("✅ Document rename successful")
            
            # Save the renamed file
            output_filename = f"renamed_{os.path.basename(pdf_path)}"
            with open(output_filename, 'wb') as f:
                f.write(response.content)
            print(f"✅ Renamed file saved as: {output_filename}")
            
            # Check content disposition header for filename
            content_disposition = response.headers.get('Content-Disposition', '')
            if 'filename=' in content_disposition:
                suggested_name = content_disposition.split('filename=')[1].strip('"')
                print(f"📝 Suggested filename: {suggested_name}")
                
        else:
            print(f"❌ Document rename failed with status {response.status_code}")
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Document rename error: {e}")

def main():
    """Main test function"""
    base_url = "http://localhost:5000"
    
    print("🧪 Testing Document Renaming API")
    print("=" * 40)
    
    # Test if server is running
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print("✅ Server is running")
    except requests.exceptions.ConnectionError:
        print("❌ Server is not running. Please start the server with: python app.py")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error connecting to server: {e}")
        sys.exit(1)
    
    # Run tests
    test_health_check(base_url)
    test_api_info(base_url)
    
    # Test with a sample PDF if provided
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        test_document_rename(base_url, pdf_path)
    else:
        print("\n📝 To test document renaming, provide a PDF file path:")
        print("   python test_api.py path/to/your/document.pdf")
        print("\nOr create a sample PDF and test manually using curl:")
        print("   curl -X POST -F 'file=@document.pdf' http://localhost:5000/rename-document -o renamed_document.pdf")

if __name__ == "__main__":
    main()
