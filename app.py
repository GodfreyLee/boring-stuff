import os
import json
import tempfile
import shutil
import re
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import openai
from dotenv import load_dotenv
import uuid
import fitz  # PyMuPDF
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.utils import ImageReader
import io
import base64
from typing import Dict, List, Tuple, Optional

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, expose_headers=['Content-Disposition'])  # Enable CORS and expose Content-Disposition header
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

# Supported image formats
SUPPORTED_IMAGE_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp'}
SUPPORTED_PDF_FORMATS = {'.pdf'}

def is_image_file(filename):
    """
    Check if the file is a supported image format
    """
    return any(filename.lower().endswith(ext) for ext in SUPPORTED_IMAGE_FORMATS)

def is_pdf_file(filename):
    """
    Check if the file is a PDF
    """
    return filename.lower().endswith('.pdf')

def convert_image_to_pdf(image_path, output_path=None):
    """
    Convert an image file to PDF format
    """
    try:
        # Open the image
        with Image.open(image_path) as img:
            # Convert to RGB if necessary (for JPEG compatibility)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Get image dimensions
            img_width, img_height = img.size
            
            # Calculate PDF page size (A4 by default)
            page_width, page_height = A4
            
            # Calculate scaling to fit image on page with margins
            margin = 50  # 50 points margin
            max_width = page_width - 2 * margin
            max_height = page_height - 2 * margin
            
            # Calculate scaling factor
            scale_x = max_width / img_width
            scale_y = max_height / img_height
            scale = min(scale_x, scale_y, 1.0)  # Don't scale up, only down
            
            # Calculate final dimensions
            final_width = img_width * scale
            final_height = img_height * scale
            
            # Calculate position to center the image
            x_offset = (page_width - final_width) / 2
            y_offset = (page_height - final_height) / 2
            
            # Create PDF
            if output_path is None:
                output_path = image_path.rsplit('.', 1)[0] + '.pdf'
            
            c = canvas.Canvas(output_path, pagesize=A4)
            
            # Draw the image
            c.drawImage(ImageReader(img), x_offset, y_offset, width=final_width, height=final_height)
            c.save()
            
            print(f"Image converted to PDF: {output_path}")
            return output_path
            
    except Exception as e:
        raise Exception(f"Error converting image to PDF: {str(e)}")

def process_file_to_pdf(file_path, original_filename):
    """
    Process a file (image or PDF) and return the path to a PDF file
    """
    if is_pdf_file(original_filename):
        # File is already a PDF, return the path
        return file_path
    elif is_image_file(original_filename):
        # Convert image to PDF
        pdf_path = file_path.rsplit('.', 1)[0] + '.pdf'
        return convert_image_to_pdf(file_path, pdf_path)
    else:
        raise Exception(f"Unsupported file format. Supported formats: {', '.join(SUPPORTED_IMAGE_FORMATS | SUPPORTED_PDF_FORMATS)}")

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

def extract_text_and_coordinates_from_pdf(pdf_path):
    """
    Extract text and coordinates from PDF using Azure Form Recognizer
    Returns a list of dictionaries with text content and coordinates
    """
    try:
        with open(pdf_path, "rb") as f:
            poller = document_analysis_client.begin_analyze_document(
                "prebuilt-document", document=f
            )
        result = poller.result()
        
        # Extract text content with coordinates
        text_elements = []
        for page_num, page in enumerate(result.pages):
            for line in page.lines:
                for word in line.words:
                    # Convert coordinates from inches to points (1 inch = 72 points)
                    # Azure returns coordinates in inches, we need to convert to points for PDF manipulation
                    x1 = word.polygon[0].x * 72  # Convert to points
                    y1 = word.polygon[0].y * 72
                    x2 = word.polygon[2].x * 72
                    y2 = word.polygon[2].y * 72
                    
                    text_elements.append({
                        'text': word.content,
                        'page': page_num,
                        'coordinates': {
                            'x1': x1,
                            'y1': y1,
                            'x2': x2,
                            'y2': y2,
                            'width': x2 - x1,
                            'height': y2 - y1
                        }
                    })
        
        return text_elements
    except Exception as e:
        raise Exception(f"Error extracting text and coordinates from PDF: {str(e)}")

def convert_azure_coordinates_to_rect(coordinates, page_width, page_height):
    """
    Convert Azure Document Intelligence coordinates to PyMuPDF rectangle.
    
    Azure Document Intelligence returns coordinates in inches, measured from
    the top-left corner of the page. PyMuPDF uses points (1 inch = 72 points)
    and measures from the bottom-left corner.
    """
    points = []
    POINTS_PER_INCH = 72
    
    # Convert coordinate pairs from inches to points
    for i in range(0, len(coordinates), 2):
        if i + 1 < len(coordinates):
            x = coordinates[i] * POINTS_PER_INCH
            y = coordinates[i + 1] * POINTS_PER_INCH
            points.append({'x': x, 'y': y})
    
    if len(points) >= 2:
        # Calculate bounding rectangle from all points
        x_coords = [p['x'] for p in points]
        y_coords = [p['y'] for p in points]
        
        min_x = min(x_coords)
        max_x = max(x_coords)
        min_y = min(y_coords)
        max_y = max(y_coords)
        
        return fitz.Rect(min_x, min_y, max_x, max_y)
    
    return fitz.Rect(0, 0, 0, 0)

def find_sensitive_data_from_azure(azure_data, data_types):
    """
    Extract sensitive information from Azure Document Intelligence results.
    Supports data types: 'tfn'
    """
    sensitive_data = []
    
    # Normalize Azure response format to array
    results_array = []
    if isinstance(azure_data, list):
        results_array = azure_data
    elif 'analyzeResult' in azure_data:
        results_array = [azure_data]
    elif isinstance(azure_data, list) and len(azure_data) > 0 and 'analyzeResult' in azure_data[0]:
        results_array = azure_data
    else:
        print("WARNING: Unexpected Azure results format")
        return sensitive_data
    
    # Process each result in the array
    for result in results_array:
        key_value_pairs = result.get('analyzeResult', {}).get('keyValuePairs', [])
        
        for pair in key_value_pairs:
            key_content = pair.get('key', {}).get('content', '').lower()
            value_content = pair.get('value', {}).get('content', '').strip()
            
            # Check for TFN data type only
            for data_type in data_types:
                if data_type == 'tfn' and ('tfn' in key_content or 'tax file' in key_content or 'tax number' in key_content or 'tax file number' in key_content):
                    sensitive_data.append({
                        'type': 'tfn',
                        'key': pair.get('key', {}).get('content', ''),
                        'value': value_content,
                        'polygon': pair.get('value', {}).get('boundingRegions', [{}])[0].get('polygon', []),
                        'confidence': pair.get('confidence', 1.0),
                        'page': pair.get('value', {}).get('boundingRegions', [{}])[0].get('pageNumber', 1) - 1
                    })
                    print(f"Found TFN: {pair.get('key', {}).get('content', '')} = {value_content}")
    
    return sensitive_data

def extract_sensitive_values(sensitive_data):
    """
    Extract the actual sensitive values from the sensitive data objects.
    """
    sensitive_values = []
    
    for item in sensitive_data:
        value = item.get('value', '').strip()
        if value and value not in sensitive_values:
            sensitive_values.append(value)
            print(f"Extracted {item['type']} value: {value}")
    
    return sensitive_values

def find_sensitive_values_in_azure_words(azure_data, sensitive_values, data_types):
    """
    Search for sensitive values in Azure Document Intelligence words array.
    Returns word-level coordinates for redaction.
    """
    additional_redactions = []
    
    print(f"Searching Azure words for sensitive values: {sensitive_values}")
    
    # Normalize Azure response format to array
    results_array = []
    if isinstance(azure_data, list):
        results_array = azure_data
    elif 'analyzeResult' in azure_data:
        results_array = [azure_data]
    elif isinstance(azure_data, list) and len(azure_data) > 0 and 'analyzeResult' in azure_data[0]:
        results_array = azure_data
    else:
        print("WARNING: Unexpected Azure results format for word search")
        return additional_redactions
    
    # Process each result in the array
    for result in results_array:
        pages = result.get('analyzeResult', {}).get('pages', [])
        
        for page in pages:
            page_number = page.get('pageNumber', 1) - 1  # Convert to zero-based
            words = page.get('words', [])
            
            print(f"Searching page {page_number + 1} with {len(words)} words")
            
            # Single Word Exact Matching
            for word in words:
                word_content = word.get('content', '')
                word_polygon = word.get('polygon', [])
                word_confidence = word.get('confidence', 1.0)
                
                # Check if this word matches any of our sensitive values
                for sensitive_value in sensitive_values:
                    if not sensitive_value:
                        continue
                    
                    # Only exact match to prevent false positives
                    if word_content == sensitive_value:
                        print(f"Found sensitive value match: '{word_content}' matches '{sensitive_value}' on page {page_number + 1}")
                        
                        additional_redaction = {
                            'polygon': word_polygon,
                            'page': page_number,
                            'confidence': word_confidence,
                            'source': 'azure_word_search',
                            'value': word_content,
                            'matched_value': sensitive_value
                        }
                        
                        additional_redactions.append(additional_redaction)
            
            # No pattern matching needed for TFN - handled via key-value pairs only
    
    print(f"Found {len(additional_redactions)} additional sensitive value occurrences in Azure words")
    return additional_redactions

def get_patterns_for_data_type(data_type):
    """
    Get regex patterns for different data types.
    Currently only supports TFN detection via key-value pairs.
    """
    patterns = []
    # TFN detection is handled via key-value pair matching, no patterns needed
    return patterns

def redact_pdf_secure(pdf_path, redaction_data, output_path):
    """
    Perform secure PDF redaction using PyMuPDF.
    """
    try:
        # Open the PDF document
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        print(f"Opened PDF document with {total_pages} pages")
        
        # Process each redaction area
        for i, redaction in enumerate(redaction_data):
            print(f"Processing redaction {i+1} of {len(redaction_data)}")
            
            page_num = redaction.get('page', 0)
            polygon = redaction.get('polygon', [])
            
            # Validate page number
            if page_num >= total_pages:
                print(f"WARNING: Page {page_num} does not exist, skipping redaction")
                continue
                
            # Validate polygon coordinates
            if len(polygon) < 4:
                print(f"WARNING: Invalid polygon coordinates (need 4+ values), skipping")
                continue
            
            # Get the target page
            page = doc[page_num]
            page_rect = page.rect
            
            # Convert Azure coordinates to PDF rectangle
            redaction_rect = convert_azure_coordinates_to_rect(
                polygon, page_rect.width, page_rect.height
            )
            
            # Apply redaction if rectangle is valid
            if not redaction_rect.is_empty:
                print(f"Applying redaction to area: {redaction_rect}")
                
                # Create redaction annotation
                redact_annot = page.add_redact_annot(
                    redaction_rect,
                    text="[REDACTED]",      # Replacement text to display
                    fill=(0, 0, 0),         # Black background color
                    text_color=(1, 1, 1)    # White text color for visibility
                )
                
                # Apply the redaction annotation
                page.apply_redactions()
                print("Redaction applied successfully")
            else:
                print("WARNING: Empty redaction rectangle, skipping")
        
        # Save the redacted PDF with optimization
        doc.save(
            output_path,
            garbage=4,          # Remove unused objects
            deflate=True,       # Compress content streams
            clean=True          # Clean up document structure
        )
        doc.close()
        
        print(f"Redacted PDF saved successfully to: {output_path}")
        return True
        
    except Exception as e:
        print(f"ERROR during PDF redaction: {str(e)}")
        return False

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
        
        # Process the file to ensure it's a PDF
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{uuid.uuid4()}_{original_filename}")
        file.save(temp_path)
        
        try:
            processed_pdf_path = process_file_to_pdf(temp_path, original_filename)
            
            # Step 1: Extract text from PDF using Azure OCR
            print("Extracting text from PDF...")
            extracted_text = extract_text_from_pdf(processed_pdf_path)
            
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
            shutil.move(processed_pdf_path, new_file_path)
            
            # Step 4: Return the renamed file
            print(f"Sending file with download_name: {new_filename}.pdf")
            
            # Create response with manual Content-Disposition header
            from flask import make_response
            response = make_response(send_file(
                new_file_path,
                as_attachment=True,
                mimetype='application/pdf'
            ))
            
            # Manually set the Content-Disposition header
            response.headers['Content-Disposition'] = f'attachment; filename="{new_filename}.pdf"'
            print(f"Response headers: {dict(response.headers)}")
            return response
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/redact-document', methods=['POST'])
def redact_document():
    """
    Redact sensitive information from PDF documents or images using Azure OCR and PyMuPDF.
    Supports multiple data types: 'tfn', 'phone', 'email', 'address', 'ssn', 'credit_card'
    """
    try:
        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get redaction types from request parameters
        redaction_types = request.form.get('redaction_types', 'tfn').split(',')
        redaction_types = [rt.strip().lower() for rt in redaction_types if rt.strip()]
        
        # Validate redaction types
        valid_types = ['tfn']
        invalid_types = [rt for rt in redaction_types if rt not in valid_types]
        if invalid_types:
            return jsonify({'error': f'Invalid redaction types: {invalid_types}. Valid types are: {valid_types}'}), 400
        
        # Process the file to ensure it's a PDF
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{uuid.uuid4()}_{original_filename}")
        file.save(temp_path)
        
        try:
            processed_pdf_path = process_file_to_pdf(temp_path, original_filename)
            
            # Step 1: Extract text and coordinates from PDF using Azure OCR
            print(f"Extracting text and coordinates from PDF for redaction types: {redaction_types}...")
            with open(processed_pdf_path, "rb") as f:
                poller = document_analysis_client.begin_analyze_document(
                    "prebuilt-document", document=f
                )
            result = poller.result()
            
            # Convert Azure result to the format expected by our functions
            azure_data = {
                'analyzeResult': {
                    'pages': [],
                    'keyValuePairs': []
                }
            }
            
            # Extract pages and words
            for page_num, page in enumerate(result.pages):
                page_data = {
                    'pageNumber': page_num + 1,
                    'lines': [],
                    'words': []
                }
                
                # Extract lines
                for line in page.lines:
                    line_data = {
                        'content': line.content,
                        'polygon': [
                            line.polygon[0].x, line.polygon[0].y,
                            line.polygon[1].x, line.polygon[1].y,
                            line.polygon[2].x, line.polygon[2].y,
                            line.polygon[3].x, line.polygon[3].y
                        ],
                        'confidence': 1.0
                    }
                    page_data['lines'].append(line_data)
                
                # Extract words directly from the page
                for word in page.words:
                    word_data = {
                        'content': word.content,
                        'polygon': [
                            word.polygon[0].x, word.polygon[0].y,
                            word.polygon[1].x, word.polygon[1].y,
                            word.polygon[2].x, word.polygon[2].y,
                            word.polygon[3].x, word.polygon[3].y
                        ],
                        'confidence': 1.0
                    }
                    page_data['words'].append(word_data)
                
                azure_data['analyzeResult']['pages'].append(page_data)
            
            # Extract key-value pairs if available
            if hasattr(result, 'key_value_pairs'):
                for pair in result.key_value_pairs:
                    key_content = pair.key.content if pair.key else ""
                    value_content = pair.value.content if pair.value else ""
                    
                    if pair.value and pair.value.bounding_regions:
                        kv_pair = {
                            'confidence': 1.0,
                            'key': {
                                'content': key_content
                            },
                            'value': {
                                'content': value_content,
                                'boundingRegions': [{
                                    'pageNumber': pair.value.bounding_regions[0].page_number,
                                    'polygon': [
                                        pair.value.bounding_regions[0].polygon[0].x,
                                        pair.value.bounding_regions[0].polygon[0].y,
                                        pair.value.bounding_regions[0].polygon[1].x,
                                        pair.value.bounding_regions[0].polygon[1].y,
                                        pair.value.bounding_regions[0].polygon[2].x,
                                        pair.value.bounding_regions[0].polygon[2].y,
                                        pair.value.bounding_regions[0].polygon[3].x,
                                        pair.value.bounding_regions[0].polygon[3].y
                                    ]
                                }]
                            }
                        }
                        azure_data['analyzeResult']['keyValuePairs'].append(kv_pair)
            
            # Step 2: Find sensitive information from Azure results
            print(f"Finding sensitive data of types: {redaction_types}...")
            sensitive_data = find_sensitive_data_from_azure(azure_data, redaction_types)
            
            if not sensitive_data:
                return jsonify({'message': f'No sensitive data of types {redaction_types} found in the document', 'redacted_file': None}), 200
            
            print(f"Found {len(sensitive_data)} sensitive data fields to redact")
            
            # Step 3: Extract sensitive values and search for additional occurrences
            sensitive_values = extract_sensitive_values(sensitive_data)
            additional_redactions = find_sensitive_values_in_azure_words(azure_data, sensitive_values, redaction_types)
            
            # Step 4: Combine key-value pair coordinates and word-level coordinates for redaction
            all_redactions = []
            
            # Add key-value pair coordinates
            for sensitive_item in sensitive_data:
                polygon = sensitive_item.get('polygon', [])
                if polygon:  # Only add if polygon exists
                    all_redactions.append({
                        'polygon': polygon,
                        'page': sensitive_item.get('page', 0),
                        'confidence': sensitive_item.get('confidence', 1.0),
                        'source': 'azure_key_value_pair',
                        'value': sensitive_item.get('value', ''),
                        'matched_value': sensitive_item.get('value', '')
                    })
            
            # Add word-level coordinates
            all_redactions.extend(additional_redactions)
            
            print(f"Total redactions to apply: {len(all_redactions)} ({len(sensitive_data)} from key-value pairs, {len(additional_redactions)} from word matching)")
            
            if not all_redactions:
                return jsonify({'message': f'No sensitive data of types {redaction_types} found in document words', 'redacted_file': None}), 200
            
            # Step 5: Perform secure redaction
            redacted_pdf_path = processed_pdf_path.replace('.pdf', '_redacted.pdf')
            redaction_success = redact_pdf_secure(processed_pdf_path, all_redactions, redacted_pdf_path)
            
            if redaction_success:
                # Step 6: Return the redacted file
                return send_file(
                    redacted_pdf_path,
                    as_attachment=True,
                    download_name=f"redacted_{original_filename.rsplit('.', 1)[0]}.pdf",
                    mimetype='application/pdf'
                )
            else:
                return jsonify({'error': 'Redaction process failed'}), 500
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/extract-ocr', methods=['POST'])
def extract_ocr():
    """
    Extract Azure OCR data from PDF or image and return as JSON for inspection
    """
    try:
        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Process the file to ensure it's a PDF
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{uuid.uuid4()}_{original_filename}")
        file.save(temp_path)
        
        try:
            processed_pdf_path = process_file_to_pdf(temp_path, original_filename)
            
            # Extract text and coordinates from PDF using Azure OCR
            print("Extracting OCR data from PDF...")
            with open(processed_pdf_path, "rb") as f:
                poller = document_analysis_client.begin_analyze_document(
                    "prebuilt-document", document=f
                )
            result = poller.result()
            
            # Convert Azure result to JSON format
            ocr_data = {
                'analyzeResult': {
                    'pages': [],
                    'keyValuePairs': []
                }
            }
            
            # Extract pages, lines, and words
            for page_num, page in enumerate(result.pages):
                page_data = {
                    'pageNumber': page_num + 1,
                    'lines': [],
                    'words': []
                }
                
                # Extract lines
                for line in page.lines:
                    line_data = {
                        'content': line.content,
                        'polygon': [
                            line.polygon[0].x, line.polygon[0].y,
                            line.polygon[1].x, line.polygon[1].y,
                            line.polygon[2].x, line.polygon[2].y,
                            line.polygon[3].x, line.polygon[3].y
                        ],
                        'confidence': 1.0
                    }
                    page_data['lines'].append(line_data)
                
                # Extract words directly from the page
                for word in page.words:
                    word_data = {
                        'content': word.content,
                        'polygon': [
                            word.polygon[0].x, word.polygon[0].y,
                            word.polygon[1].x, word.polygon[1].y,
                            word.polygon[2].x, word.polygon[2].y,
                            word.polygon[3].x, word.polygon[3].y
                        ],
                        'confidence': 1.0
                    }
                    page_data['words'].append(word_data)
                
                ocr_data['analyzeResult']['pages'].append(page_data)
            
            # Extract key-value pairs if available
            if hasattr(result, 'key_value_pairs'):
                for pair in result.key_value_pairs:
                    key_content = pair.key.content if pair.key else ""
                    value_content = pair.value.content if pair.value else ""
                    
                    if pair.value and pair.value.bounding_regions:
                        kv_pair = {
                            'confidence': 1.0,
                            'key': {
                                'content': key_content
                            },
                            'value': {
                                'content': value_content,
                                'boundingRegions': [{
                                    'pageNumber': pair.value.bounding_regions[0].page_number,
                                    'polygon': [
                                        pair.value.bounding_regions[0].polygon[0].x,
                                        pair.value.bounding_regions[0].polygon[0].y,
                                        pair.value.bounding_regions[0].polygon[1].x,
                                        pair.value.bounding_regions[0].polygon[1].y,
                                        pair.value.bounding_regions[0].polygon[2].x,
                                        pair.value.bounding_regions[0].polygon[2].y,
                                        pair.value.bounding_regions[0].polygon[3].x,
                                        pair.value.bounding_regions[0].polygon[3].y
                                    ]
                                }]
                            }
                        }
                        ocr_data['analyzeResult']['keyValuePairs'].append(kv_pair)
            
            # Clean up temp files
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if processed_pdf_path != temp_path and os.path.exists(processed_pdf_path):
                os.remove(processed_pdf_path)
            
            return jsonify(ocr_data)
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/debug-tfn-coordinates', methods=['POST'])
def debug_sensitive_coordinates():
    """
    Debug endpoint to test find_sensitive_values_in_azure_words function
    Returns the coordinates found for sensitive values
    """
    try:
        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Process the file to ensure it's a PDF
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{uuid.uuid4()}_{original_filename}")
        file.save(temp_path)
        
        try:
            processed_pdf_path = process_file_to_pdf(temp_path, original_filename)
            
            # Get redaction types from request parameters (default to 'tfn' for backward compatibility)
            redaction_types = request.form.get('redaction_types', 'tfn').split(',')
            redaction_types = [rt.strip().lower() for rt in redaction_types if rt.strip()]
            
            # Validate redaction types
            valid_types = ['tfn']
            invalid_types = [rt for rt in redaction_types if rt not in valid_types]
            if invalid_types:
                return jsonify({'error': f'Invalid redaction types: {invalid_types}. Valid types are: {valid_types}'}), 400
            
            # Extract text and coordinates from PDF using Azure OCR
            print(f"Extracting OCR data for sensitive coordinate debugging (types: {redaction_types})...")
            with open(processed_pdf_path, "rb") as f:
                poller = document_analysis_client.begin_analyze_document(
                    "prebuilt-document", 
                    document=f
                )
            result = poller.result()
            
            # Debug: Check how many pages Azure returned
            print(f"Azure OCR returned {len(result.pages)} pages")
            
            # Also check if there are any other page-related attributes
            if hasattr(result, 'pages'):
                print(f"Total pages in result: {len(result.pages)}")
                for i, page in enumerate(result.pages):
                    print(f"  Page {i+1}: {len(page.words)} words, {len(page.lines)} lines")
            
            # Convert Azure result to the format expected by our functions
            azure_data = {
                'analyzeResult': {
                    'pages': [],
                    'keyValuePairs': []
                }
            }
            
            # Extract pages and words
            for page_num, page in enumerate(result.pages):
                print(f"Processing page {page_num + 1} with {len(page.words)} words")
                page_data = {
                    'pageNumber': page_num + 1,
                    'words': []
                }
                
                # Extract words directly from the page
                for word in page.words:
                    word_data = {
                        'content': word.content,
                        'polygon': [
                            word.polygon[0].x, word.polygon[0].y,
                            word.polygon[1].x, word.polygon[1].y,
                            word.polygon[2].x, word.polygon[2].y,
                            word.polygon[3].x, word.polygon[3].y
                        ],
                        'confidence': 1.0
                    }
                    page_data['words'].append(word_data)
                
                azure_data['analyzeResult']['pages'].append(page_data)
            
            # Extract key-value pairs if available
            if hasattr(result, 'key_value_pairs'):
                print(f"Found {len(result.key_value_pairs)} key-value pairs")
                for pair in result.key_value_pairs:
                    key_content = pair.key.content if pair.key else ""
                    value_content = pair.value.content if pair.value else ""
                    
                    if pair.value and pair.value.bounding_regions:
                        kv_pair = {
                            'confidence': 1.0,
                            'key': {
                                'content': key_content
                            },
                            'value': {
                                'content': value_content,
                                'boundingRegions': [{
                                    'pageNumber': pair.value.bounding_regions[0].page_number,
                                    'polygon': [
                                        pair.value.bounding_regions[0].polygon[0].x,
                                        pair.value.bounding_regions[0].polygon[0].y,
                                        pair.value.bounding_regions[0].polygon[1].x,
                                        pair.value.bounding_regions[0].polygon[1].y,
                                        pair.value.bounding_regions[0].polygon[2].x,
                                        pair.value.bounding_regions[0].polygon[2].y,
                                        pair.value.bounding_regions[0].polygon[3].x,
                                        pair.value.bounding_regions[0].polygon[3].y
                                    ]
                                }]
                            }
                        }
                        azure_data['analyzeResult']['keyValuePairs'].append(kv_pair)
            
            # Find sensitive information from Azure results
            print(f"Finding sensitive data of types {redaction_types} for debugging...")
            sensitive_data = find_sensitive_data_from_azure(azure_data, redaction_types)
            
            if not sensitive_data:
                return jsonify({
                    'message': f'No sensitive data of types {redaction_types} found in the document',
                    'sensitive_data': [],
                    'sensitive_values': [],
                    'word_coordinates': [],
                    'azure_data_structure': {
                        'total_pages': len(azure_data['analyzeResult']['pages']),
                        'total_words': sum(len(page['words']) for page in azure_data['analyzeResult']['pages']),
                        'total_key_value_pairs': len(azure_data['analyzeResult']['keyValuePairs'])
                    }
                }), 200
            
            print(f"Found {len(sensitive_data)} sensitive data fields")
            
            # Extract sensitive values and search for additional occurrences
            sensitive_values = extract_sensitive_values(sensitive_data)
            additional_redactions = find_sensitive_values_in_azure_words(azure_data, sensitive_values, redaction_types)
            
            # Prepare debug response
            debug_response = {
                'sensitive_data_found': sensitive_data,
                'sensitive_values_extracted': sensitive_values,
                'word_coordinates_found': additional_redactions,
                'total_redactions': len(additional_redactions),
                'redaction_types_requested': redaction_types,
                'azure_data_structure': {
                    'total_pages': len(azure_data['analyzeResult']['pages']),
                    'total_words': sum(len(page['words']) for page in azure_data['analyzeResult']['pages']),
                    'total_key_value_pairs': len(azure_data['analyzeResult']['keyValuePairs']),
                    'pages_detail': [
                        {
                            'page_number': page['pageNumber'],
                            'word_count': len(page['words'])
                        } for page in azure_data['analyzeResult']['pages']
                    ]
                }
            }
            
            # Clean up temp files
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if processed_pdf_path != temp_path and os.path.exists(processed_pdf_path):
                os.remove(processed_pdf_path)
            
            return jsonify(debug_response)
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def convert_pdf_to_image(pdf_path, page_number=0, image_format='PNG', quality=2.0):
    """
    Convert PDF page to image.
    
    Args:
        pdf_path: Path to PDF file
        page_number: Page number to convert (0-based)
        image_format: Output image format (PNG, JPEG, etc.)
        quality: Scale factor for image quality (1.0 = 72 DPI, 2.0 = 144 DPI)
    
    Returns:
        Dict with image data and metadata
    """
    try:
        doc = fitz.open(pdf_path)
        
        if page_number >= len(doc):
            raise Exception(f"Page {page_number} does not exist. PDF has {len(doc)} pages.")
        
        page = doc[page_number]
        page_rect = page.rect
        
        # Render page as image with specified quality
        mat = fitz.Matrix(quality, quality)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to specified format
        if image_format.upper() == 'JPEG':
            img_data = pix.tobytes("jpeg")
            content_type = "image/jpeg"
        else:  # Default to PNG
            img_data = pix.tobytes("png")
            content_type = "image/png"
            image_format = "PNG"
        
        result = {
            'page_number': page_number + 1,
            'total_pages': len(doc),
            'image_format': image_format.upper(),
            'image_size_bytes': len(img_data),
            'image_dimensions': {
                'width': pix.width,
                'height': pix.height
            },
            'pdf_dimensions': {
                'width': float(page_rect.width),
                'height': float(page_rect.height)
            },
            'quality_scale': quality,
            'dpi': int(72 * quality),
            'content_type': content_type,
            'image_data': img_data
        }
        
        doc.close()
        return result
        
    except Exception as e:
        raise Exception(f"Error converting PDF to image: {str(e)}")

def detect_signature_with_openai(image_data, image_format='PNG'):
    """
    Use OpenAI Vision API to detect if a document image contains a signature.
    
    Args:
        image_data: Binary image data
        image_format: Image format (PNG or JPEG)
    
    Returns:
        Dict with signature detection results and confidence
    """
    try:
        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Determine MIME type
        mime_type = f"image/{image_format.lower()}" if image_format.upper() == 'JPEG' else "image/png"
        
        # Create the prompt for signature detection
        prompt = """
        Analyze this document image and determine if it contains a signature or handwritten signature.
        
        Look for:
        - Handwritten signatures (cursive or print)
        - Initials
        - Digital signatures
        - Any form of signed authorization
        
        Consider these as NOT signatures:
        - Printed text or names
        - Stamps (unless they include a handwritten signature)
        - Checkmarks or X marks in boxes
        - Form field labels
        
        Respond with ONLY a JSON object in this exact format:
        {
            "is_signed": true/false,
            "confidence": 0.0-1.0,
            "signature_description": "brief description of what you found or didn't find",
            "signature_location": "general area where signature was found (e.g., 'bottom right', 'center', 'not found')"
        }
        """
        
        # Call OpenAI Vision API
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300,
            temperature=0.1
        )
        
        # Parse the response
        response_text = response.choices[0].message.content.strip()
        
        # Clean up markdown code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text.replace('```json', '').replace('```', '').strip()
        elif response_text.startswith('```'):
            response_text = response_text.replace('```', '').strip()
        
        # Try to parse JSON response
        try:
            import json
            result = json.loads(response_text)
            
            # Validate required fields
            required_fields = ['is_signed', 'confidence', 'signature_description', 'signature_location']
            if not all(field in result for field in required_fields):
                raise ValueError("Missing required fields in OpenAI response")
            
            # Ensure confidence is a float between 0 and 1
            result['confidence'] = max(0.0, min(1.0, float(result['confidence'])))
            
            # Ensure is_signed is boolean
            result['is_signed'] = bool(result['is_signed'])
            
            return result
            
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"Error parsing OpenAI response: {e}")
            print(f"Raw response: {response_text}")
            
            # Fallback: try to determine from response text
            response_lower = response_text.lower()
            is_signed = any(word in response_lower for word in ['signature', 'signed', 'handwritten', 'initial'])
            
            return {
                'is_signed': is_signed,
                'confidence': 0.5,
                'signature_description': f'Could not parse structured response: {response_text[:100]}...',
                'signature_location': 'unknown'
            }
        
    except Exception as e:
        raise Exception(f"Error detecting signature with OpenAI: {str(e)}")

@app.route('/detect-signature-ai', methods=['POST'])
def detect_signature_ai_endpoint():
    """
    Endpoint to detect signatures in PDF documents using OpenAI Vision API.
    Converts PDF to image and then uses AI to determine if the document is signed.
    
    Parameters:
    - file: PDF file to analyze (required)
    - page_number: Page number to analyze (optional, defaults to 0)
    - image_format: Format for AI analysis PNG or JPEG (optional, defaults to PNG)
    - quality: Image quality for AI analysis 1.0-4.0 (optional, defaults to 2.0)
    """
    try:
        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get optional parameters
        page_number = int(request.form.get('page_number', 0))
        image_format = request.form.get('image_format', 'PNG').upper()
        quality = float(request.form.get('quality', 2.0))
        
        # Validate parameters
        if image_format not in ['PNG', 'JPEG']:
            return jsonify({'error': 'Invalid image_format. Must be PNG or JPEG'}), 400
        
        if not (1.0 <= quality <= 4.0):
            return jsonify({'error': 'Invalid quality. Must be between 1.0 and 4.0'}), 400
        
        # Process the file to ensure it's a PDF
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{uuid.uuid4()}_{original_filename}")
        file.save(temp_path)
        
        try:
            processed_pdf_path = process_file_to_pdf(temp_path, original_filename)
            
            # Convert PDF to image
            print(f"Converting PDF page {page_number + 1} to image for AI analysis...")
            conversion_result = convert_pdf_to_image(processed_pdf_path, page_number, image_format, quality)
            
            # Extract image data
            image_data = conversion_result['image_data']
            
            # Use OpenAI to detect signature
            print("Analyzing image with OpenAI for signature detection...")
            ai_result = detect_signature_with_openai(image_data, image_format)
            
            # Clean up temp files
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if processed_pdf_path != temp_path and os.path.exists(processed_pdf_path):
                os.remove(processed_pdf_path)
            
            # Prepare response
            response_data = {
                'success': True,
                'filename': original_filename,
                'page_analyzed': page_number + 1,
                'total_pages': conversion_result['total_pages'],
                'is_signed': ai_result['is_signed'],  # Main boolean result
                'signature_detection': {
                    'confidence': ai_result['confidence'],
                    'description': ai_result['signature_description'],
                    'location': ai_result['signature_location']
                },
                'analysis_details': {
                    'image_format_used': conversion_result['image_format'],
                    'image_dimensions': conversion_result['image_dimensions'],
                    'quality_scale': conversion_result['quality_scale'],
                    'dpi': conversion_result['dpi'],
                    'ai_model': 'gpt-4o'
                }
            }
            
            return jsonify(response_data)
            
        except Exception as e:
            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """
    API information endpoint
    """
    return jsonify({
        'message': 'Document Processing API',
        'endpoints': {
            'POST /rename-document': 'Upload a PDF or image file to get it renamed based on content',
            'POST /redact-document': 'Upload a PDF or image file to redact TFN information',
            'POST /extract-ocr': 'Upload a PDF or image file to get Azure OCR JSON data',
            'POST /pdf-to-image': 'Convert PDF pages to image files (PNG or JPEG) with customizable quality',
            'POST /detect-signature-ai': 'Use OpenAI Vision API to detect if PDF document contains signatures (returns boolean)',
        },
        'usage': {
            'rename': 'Send a POST request to /rename-document with a PDF or image file in the "file" field',
            'redact': 'Send a POST request to /redact-document with a PDF or image file in the "file" field (only TFN redaction supported)',
            'ocr': 'Send a POST request to /extract-ocr with a PDF or image file in the "file" field',
            'pdf_to_image': 'Send a POST request to /pdf-to-image with a PDF file and optional parameters (page_number, image_format, quality, return_type)',
            'detect_signature_ai': 'Send a POST request to /detect-signature-ai with a PDF file and optional parameters (page_number, image_format, quality)',
        },
        'supported_formats': {
            'pdf': 'PDF documents',
            'images': 'JPG, JPEG, PNG, BMP, TIFF, TIF, GIF, WEBP'
        },
        'redaction_types': {
            'tfn': 'Tax File Number'
        },
        'examples': {
            'redact_pdf': 'curl -X POST -F "file=@document.pdf" http://localhost:5000/redact-document',
            'redact_image': 'curl -X POST -F "file=@image.jpg" http://localhost:5000/redact-document',
            'pdf_to_image_basic': 'curl -X POST -F "file=@document.pdf" http://localhost:5000/pdf-to-image',
            'pdf_to_image_with_options': 'curl -X POST -F "file=@document.pdf" -F "page_number=1" -F "image_format=JPEG" -F "quality=3.0" http://localhost:5000/pdf-to-image',
            'pdf_to_image_metadata_only': 'curl -X POST -F "file=@document.pdf" -F "return_type=json" http://localhost:5000/pdf-to-image',
            'detect_signature_ai_basic': 'curl -X POST -F "file=@document.pdf" http://localhost:5000/detect-signature-ai',
            'detect_signature_ai_with_options': 'curl -X POST -F "file=@document.pdf" -F "page_number=1" -F "image_format=JPEG" -F "quality=3.0" http://localhost:5000/detect-signature-ai'
        }
    })

if __name__ == '__main__':
    # Check if required environment variables are set
    if not AZURE_ENDPOINT or not AZURE_KEY:
        print("Warning: Azure Form Recognizer credentials not found in environment variables")
    if not OPENAI_API_KEY:
        print("Warning: OpenAI API key not found in environment variables")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
