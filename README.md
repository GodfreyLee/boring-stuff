# Document Processing API

A comprehensive Flask-based API that provides document processing, AI-powered renaming, TFN redaction, and AI-powered signature detection. **Supports PDF and image files (JPG, PNG, BMP, TIFF, GIF, WEBP) with automatic conversion to PDF.**

## Features

- **PDF Text Extraction**: Uses Azure Form Recognizer (OCR) to extract text from PDF documents
- **Image to PDF Conversion**: Automatically converts supported image formats to PDF for processing
- **AI-Powered Renaming**: Leverages OpenAI GPT to understand document context and generate descriptive filenames
- **TFN Redaction**: Focused redaction of Tax File Numbers with enhanced detection
- **AI Signature Detection**: Uses OpenAI Vision API (GPT-4o) to intelligently detect signatures in documents
- **File Management**: Handles file uploads, processing, and returns processed files
- **Error Handling**: Comprehensive error handling and validation

## Prerequisites

- Python 3.8+
- Azure Form Recognizer service
- OpenAI API access

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd boring_stuff
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp env_example.txt .env
```

Edit the `.env` file with your actual credentials:
```
AZURE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_KEY=your_azure_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

### Starting the Server

```bash
python app.py
```

The API will be available at `http://localhost:5000`

### API Endpoints

#### 1. Rename Document
**POST** `/rename-document`

Upload a PDF or image file to get it renamed based on its content.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the PDF or image

**Supported Formats:**
- **PDF**: `.pdf`
- **Images**: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`, `.tif`, `.gif`, `.webp`

**Response:**
- Returns the renamed PDF file as a download

#### 2. Redact Document (TFN Only)
**POST** `/redact-document`

Upload a PDF or image file to redact Tax File Numbers (TFN) from the document.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with:
  - `file` field containing the PDF or image
  - `redaction_types` field (optional) - currently only supports `tfn`

**Supported Redaction Types:**
- `tfn` - Tax File Numbers (enhanced detection for various TFN field names)

**Response:**
- Returns the redacted PDF file as a download
- If no TFN data is found, returns a message indicating no redaction was needed

#### 3. Extract OCR Data
**POST** `/extract-ocr`

Upload a PDF or image file to get Azure OCR JSON data for inspection.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the PDF or image

**Response:**
- Returns the raw Azure OCR JSON data

#### 4. Debug TFN Coordinates
**POST** `/debug-tfn-coordinates`

Debug endpoint to test TFN coordinate detection.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with:
  - `file` field containing the PDF or image
  - `redaction_types` field (optional) - currently only supports `tfn`

**Response:**
- Returns detailed information about detected TFN data and coordinates

#### 5. AI Signature Detection
**POST** `/detect-signature-ai`

Use OpenAI Vision API to intelligently detect signatures in PDF documents.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with:
  - `file` field containing the PDF or image (required)
  - `page_number` field - page number to analyze (optional, default: 0)
  - `image_format` field - PNG or JPEG (optional, default: PNG)
  - `quality` field - image quality scale 1.0-4.0 (optional, default: 2.0)

**Response:**
```json
{
  "success": true,
  "filename": "document.pdf",
  "page_analyzed": 1,
  "total_pages": 1,
  "is_signed": true,
  "signature_detection": {
    "confidence": 0.95,
    "description": "Found handwritten signature in cursive script",
    "location": "bottom right"
  },
  "analysis_details": {
    "image_format_used": "PNG",
    "image_dimensions": {"width": 1191, "height": 1684},
    "quality_scale": 2.0,
    "dpi": 144,
    "ai_model": "gpt-4o"
  }
}
```

#### 6. API Information
**GET** `/`

Get information about available endpoints.

## AI Signature Detection Usage Examples

### Basic Signature Detection
```bash
curl -X POST -F "file=@document.pdf" http://localhost:5000/detect-signature-ai
```

### Analyze Specific Page
```bash
curl -X POST -F "file=@document.pdf" -F "page_number=1" http://localhost:5000/detect-signature-ai
```

### High-Quality Analysis
```bash
curl -X POST -F "file=@document.pdf" \
     -F "image_format=PNG" \
     -F "quality=3.0" \
     http://localhost:5000/detect-signature-ai
```

### Full Example with All Parameters
```bash
curl -X POST -F "file=@document.pdf" \
     -F "page_number=0" \
     -F "image_format=JPEG" \
     -F "quality=2.5" \
     http://localhost:5000/detect-signature-ai
```

### AI Detection Features
✅ **Detects as signatures:**
- Handwritten signatures (cursive or print)
- Initials
- Digital signatures
- Any form of signed authorization

❌ **Does NOT detect as signatures:**
- Printed text or names
- Stamps (unless they include handwritten signature)
- Checkmarks or X marks in boxes
- Form field labels

## Testing with Postman

### Setting Up Postman

1. **Open Postman** and create a new collection called "Document Processing API"

2. **Set up Environment Variables** (optional but recommended):
   - Click on the "Environments" tab
   - Create a new environment called "Local Development"
   - Add variables:
     - `base_url`: `http://localhost:5000`
     - `file_path`: Path to your test PDF or image file

### Testing Redaction Endpoints

#### 1. Test TFN Redaction Only

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/redact-document`
- **Headers**: None (Postman will automatically set Content-Type for form-data)

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your PDF or image file
- Key: `redaction_types` (Type: Text)
  - Value: `tfn`

**Steps:**
1. Click on the "Body" tab
2. Select "form-data"
3. Add the `file` key and select your PDF or image file
4. Add the `redaction_types` key with value `tfn`
5. Click "Send"

#### 2. Test Multiple Data Types Redaction

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/redact-document`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your PDF or image file
- Key: `redaction_types` (Type: Text)
  - Value: `tfn,phone,email`

#### 3. Test All Data Types Redaction

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/redact-document`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your PDF or image file
- Key: `redaction_types` (Type: Text)
  - Value: `tfn,phone,email,address,ssn,credit_card`

### Testing Image Processing

#### 1. Test Image Redaction

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/redact-document`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your image file (JPG, PNG, etc.)
- Key: `redaction_types` (Type: Text)
  - Value: `phone,email`

**Expected Result:**
- Image will be automatically converted to PDF
- Sensitive data will be redacted
- Redacted PDF will be returned

#### 2. Test Image OCR Extraction

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/extract-ocr`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your image file

**Expected Result:**
- Image will be converted to PDF
- OCR data will be extracted and returned as JSON

### Testing Debug Endpoint

#### 1. Debug TFN Coordinates

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/debug-tfn-coordinates`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your PDF or image file
- Key: `redaction_types` (Type: Text)
  - Value: `tfn`

**Expected Response:**
```json
{
  "sensitive_data_found": [
    {
      "type": "tfn",
      "key": "TFN",
      "value": "832431540",
      "polygon": [x1, y1, x2, y2, x3, y3, x4, y4],
      "confidence": 1.0,
      "page": 0
    }
  ],
  "sensitive_values_extracted": ["832431540"],
  "word_coordinates_found": [...],
  "total_redactions": 4,
  "redaction_types_requested": ["tfn"],
  "azure_data_structure": {
    "total_pages": 2,
    "total_words": 289,
    "total_key_value_pairs": 36
  }
}
```

#### 2. Debug Multiple Data Types

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/debug-tfn-coordinates`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your PDF or image file
- Key: `redaction_types` (Type: Text)
  - Value: `phone,email`

### Testing Other Endpoints

#### 1. Health Check

**Request Setup:**
- **Method**: `GET`
- **URL**: `{{base_url}}/health`

#### 2. API Information

**Request Setup:**
- **Method**: `GET`
- **URL**: `{{base_url}}/`

#### 3. Extract OCR Data

**Request Setup:**
- **Method**: `POST`
- **URL**: `{{base_url}}/extract-ocr`

**Body (form-data):**
- Key: `file` (Type: File)
  - Value: Select your PDF or image file

### Postman Collection Example

Here's a sample Postman collection you can import:

```json
{
  "info": {
    "name": "Document Processing API",
    "description": "API for document renaming and sensitive data redaction"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/health"
      }
    },
    {
      "name": "API Information",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/"
      }
    },
    {
      "name": "Redact TFN Only",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/redact-document",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": []
            },
            {
              "key": "redaction_types",
              "value": "tfn",
              "type": "text"
            }
          ]
        }
      }
    },
    {
      "name": "Redact Multiple Types",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/redact-document",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": []
            },
            {
              "key": "redaction_types",
              "value": "tfn,phone,email",
              "type": "text"
            }
          ]
        }
      }
    },
    {
      "name": "Redact Image",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/redact-document",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": []
            },
            {
              "key": "redaction_types",
              "value": "phone,email",
              "type": "text"
            }
          ]
        }
      }
    },
    {
      "name": "AI Signature Detection",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/detect-signature-ai",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": []
            },
            {
              "key": "page_number",
              "value": "0",
              "type": "text"
            },
            {
              "key": "image_format",
              "value": "PNG",
              "type": "text"
            },
            {
              "key": "quality",
              "value": "2.0",
              "type": "text"
            }
          ]
        }
      }
    },
    {
      "name": "Debug Sensitive Coordinates",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/debug-tfn-coordinates",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": []
            },
            {
              "key": "redaction_types",
              "value": "tfn,phone,email",
              "type": "text"
            }
          ]
        }
      }
    }
  ]
}
```

### Common Testing Scenarios

#### 1. Test with Different File Types
- **PDF documents** (should work as before)
- **JPG images** (should be converted to PDF and processed)
- **PNG images** (should be converted to PDF and processed)
- **Other image formats** (BMP, TIFF, GIF, WEBP)

#### 2. Test with Different Content Types
- **Tax documents** (should find TFNs)
- **Contact forms** (should find phone numbers and emails)
- **Financial documents** (should find credit card numbers)
- **Personal information forms** (should find addresses and SSNs)

#### 3. Test Error Cases
- **No file provided**: Send request without file
- **Invalid file type**: Upload unsupported file format
- **Invalid redaction types**: Use unsupported data types
- **Large files**: Test with files > 16MB

#### 4. Test Response Handling
- **Successful redaction**: Check if redacted PDF is returned
- **No sensitive data found**: Verify appropriate message
- **Error responses**: Check error message format

### Tips for Postman Testing

1. **Save Responses**: Use Postman's "Save Response" feature to keep examples
2. **Use Environment Variables**: Set up variables for base URL and file paths
3. **Test Different Scenarios**: Create multiple requests for different data types
4. **Check Headers**: Verify Content-Type is set correctly for form-data
5. **Monitor Console**: Check the Flask server console for detailed logs

## How It Works

### Document Renaming
1. **Upload**: PDF or image file is uploaded to the API
2. **Conversion**: If image, convert to PDF using PIL and ReportLab
3. **OCR**: Azure Form Recognizer extracts text from the PDF
4. **AI Analysis**: OpenAI analyzes the text to understand context
5. **Renaming**: A descriptive filename is generated and applied
6. **Return**: The renamed file is returned to the user

### Document Redaction
1. **Upload**: PDF or image file is uploaded to the API
2. **Conversion**: If image, convert to PDF using PIL and ReportLab
3. **OCR with Coordinates**: Azure Form Recognizer extracts text and coordinates from the PDF
4. **Sensitive Data Detection**: The system searches for specified types of sensitive data
5. **Pattern Matching**: Uses regex patterns to find sensitive data in text
6. **Coordinate Conversion**: Coordinates are converted from inches to PDF points
7. **Redaction**: Black rectangles are drawn over detected sensitive data
8. **Return**: The redacted PDF file is returned to the user

### Image to PDF Conversion
1. **Image Processing**: Open image using PIL (Python Imaging Library)
2. **Format Conversion**: Convert to RGB if necessary for compatibility
3. **Scaling**: Calculate optimal scaling to fit image on A4 page with margins
4. **PDF Creation**: Use ReportLab to create PDF with centered image
5. **Quality Preservation**: Maintain image quality while ensuring proper fit

## Error Handling

The API includes comprehensive error handling for:
- Missing or invalid files
- Unsupported file types
- Invalid redaction types
- Image conversion errors
- Azure OCR service errors
- OpenAI API errors
- File system errors

## File Size Limits

- Maximum file size: 16MB
- Supported formats: PDF and images (JPG, JPEG, PNG, BMP, TIFF, TIF, GIF, WEBP)

## Security Considerations

- Files are processed in a temporary directory
- Temporary files are cleaned up after processing
- Filenames are sanitized to prevent security issues
- Environment variables are used for sensitive credentials
- Image conversion is done securely with proper error handling

## Development

To run in development mode:
```bash
python app.py
```

The server will run with debug mode enabled and reload on code changes.
