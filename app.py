import os
import json
import tempfile
import shutil
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import openai
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Configure Azure Form Recognizer
AZURE_ENDPOINT = os.getenv('AZURE_ENDPOINT')
AZURE_KEY = os.getenv('AZURE_KEY')

# Configure OpenAI
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Initialize clients
document_analysis_client = DocumentAnalysisClient(
    endpoint=AZURE_ENDPOINT, 
    credential=AzureKeyCredential(AZURE_KEY)
)

# Initialize OpenAI client
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Create upload directory
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def extract_text_from_pdf(pdf_path):
    """
    Extract text from PDF using Azure Form Recognizer
    """
    try:
        with open(pdf_path, "rb") as f:
            poller = document_analysis_client.begin_analyze_document(
                "prebuilt-document", document=f
            )
        result = poller.result()
        
        # Extract text content
        text_content = ""
        for page in result.pages:
            for line in page.lines:
                text_content += line.content + "\n"
        
        return text_content.strip()
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

def generate_filename_with_openai(text_content):
    """
    Use OpenAI to understand context and generate an appropriate filename
    """
    try:
        prompt = f"""
        Based on the following document content, generate a concise, descriptive filename (without extension) that captures the main topic or purpose of the document.
        
        Document content:
        {text_content[:2000]}  # Limit to first 2000 characters
        
        Requirements:
        - Filename should be descriptive but concise (max 50 characters)
        - Use only alphanumeric characters, spaces, hyphens, and underscores
        - Avoid special characters
        - Make it clear what the document is about
        
        Return only the filename without any explanation or quotes.
        """
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates descriptive filenames based on document content."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0.3
        )
        
        filename = response.choices[0].message.content.strip()
        # Clean the filename
        filename = "".join(c for c in filename if c.isalnum() or c in " -_")
        filename = filename.replace(" ", "_")
        
        return filename if filename else "document"
        
    except Exception as e:
        raise Exception(f"Error generating filename with OpenAI: {str(e)}")

@app.route('/rename-document', methods=['POST'])
def rename_document():
    """
    Main endpoint to rename documents based on their content
    """
    try:
        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file type
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are supported'}), 400
        
        # Save uploaded file temporarily
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{uuid.uuid4()}_{original_filename}")
        file.save(temp_path)
        
        try:
            # Step 1: Extract text from PDF using Azure OCR
            print("Extracting text from PDF...")
            extracted_text = extract_text_from_pdf(temp_path)
            
            if not extracted_text:
                return jsonify({'error': 'No text could be extracted from the PDF'}), 400
            
            # Step 2: Generate new filename using OpenAI
            print("Generating new filename with OpenAI...")
            new_filename = generate_filename_with_openai(extracted_text)
            
            # Step 3: Rename the file
            new_file_path = os.path.join(UPLOAD_FOLDER, f"{new_filename}.pdf")
            
            # Handle filename conflicts
            counter = 1
            while os.path.exists(new_file_path):
                new_file_path = os.path.join(UPLOAD_FOLDER, f"{new_filename}_{counter}.pdf")
                counter += 1
            
            # Rename the file
            shutil.move(temp_path, new_file_path)
            
            # Step 4: Return the renamed file
            return send_file(
                new_file_path,
                as_attachment=True,
                download_name=f"{new_filename}.pdf",
                mimetype='application/pdf'
            )
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    """
    return jsonify({'status': 'healthy', 'message': 'Document renaming API is running'})

@app.route('/', methods=['GET'])
def index():
    """
    API information endpoint
    """
    return jsonify({
        'message': 'Document Renaming API',
        'endpoints': {
            'POST /rename-document': 'Upload a PDF file to get it renamed based on content',
            'GET /health': 'Health check endpoint'
        },
        'usage': 'Send a POST request to /rename-document with a PDF file in the "file" field'
    })

if __name__ == '__main__':
    # Check if required environment variables are set
    if not AZURE_ENDPOINT or not AZURE_KEY:
        print("Warning: Azure Form Recognizer credentials not found in environment variables")
    if not OPENAI_API_KEY:
        print("Warning: OpenAI API key not found in environment variables")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
