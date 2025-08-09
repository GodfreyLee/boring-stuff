# Document Renaming API

A Flask-based API that automatically renames PDF documents based on their content using Azure OCR and OpenAI.

## Features

- **PDF Text Extraction**: Uses Azure Form Recognizer (OCR) to extract text from PDF documents
- **AI-Powered Renaming**: Leverages OpenAI GPT to understand document context and generate descriptive filenames
- **File Management**: Handles file uploads, processing, and returns renamed files
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

Upload a PDF file to get it renamed based on its content.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the PDF

**Response:**
- Returns the renamed PDF file as a download

**Example using curl:**
```bash
curl -X POST -F "file=@document.pdf" http://localhost:5000/rename-document -o renamed_document.pdf
```

#### 2. Health Check
**GET** `/health`

Check if the API is running properly.

**Response:**
```json
{
  "status": "healthy",
  "message": "Document renaming API is running"
}
```

#### 3. API Information
**GET** `/`

Get information about available endpoints.

## How It Works

1. **File Upload**: The API accepts PDF files through a multipart form upload
2. **Text Extraction**: Azure Form Recognizer extracts text content from the PDF
3. **AI Analysis**: OpenAI GPT analyzes the extracted text to understand the document's context
4. **Filename Generation**: Based on the analysis, a descriptive filename is generated
5. **File Renaming**: The original file is renamed with the new descriptive name
6. **File Return**: The renamed file is returned to the user

## Error Handling

The API includes comprehensive error handling for:
- Missing or invalid files
- Unsupported file types (non-PDF)
- Azure OCR service errors
- OpenAI API errors
- File system errors

## File Size Limits

- Maximum file size: 16MB
- Supported format: PDF only

## Security Considerations

- Files are processed in a temporary directory
- Temporary files are cleaned up after processing
- Filenames are sanitized to prevent security issues
- Environment variables are used for sensitive credentials

## Development

To run in development mode:
```bash
python app.py
```

The server will run with debug mode enabled and reload on code changes.

## Production Deployment

For production deployment, consider:
- Using a production WSGI server (e.g., Gunicorn)
- Setting up proper logging
- Implementing rate limiting
- Adding authentication if needed
- Using HTTPS
- Setting up proper file storage (e.g., cloud storage)

## Troubleshooting

1. **Azure Credentials Error**: Ensure your Azure Form Recognizer endpoint and key are correct
2. **OpenAI API Error**: Verify your OpenAI API key is valid and has sufficient credits
3. **File Upload Issues**: Check file size and format (PDF only)
4. **Permission Errors**: Ensure the `uploads` directory is writable

## License

This project is open source and available under the MIT License.
