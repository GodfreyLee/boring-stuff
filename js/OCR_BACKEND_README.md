# OCR Backend API

This Express.js backend provides endpoints to OCR PDF files using Azure Document Intelligence (Layout model).

## Endpoints

### 1. OCR from Public URL

- **POST** `/ocr/url`
- **Body:** `{ "url": "https://example.com/sample.pdf" }`
- **Returns:** JSON OCR result

### 2. OCR from Uploaded File

- **POST** `/ocr/file`
- **Form-Data:** `file` (PDF upload)
- **Returns:** JSON OCR result

## Setup

1. Install dependencies:
   ```sh
   npm install express axios multer
   ```
2. Set your Azure endpoint and key as environment variables:

   - `AZURE_ENDPOINT` (e.g. `https://<your-resource-name>.cognitiveservices.azure.com`)
   - `AZURE_API_KEY`

3. Start the server:
   ```sh
   node ocr-backend.js
   ```

## Example cURL

**From URL:**

```sh
curl -X POST http://localhost:3000/ocr/url -H "Content-Type: application/json" -d '{"url": "https://example.com/sample.pdf"}'
```

**From File:**

```sh
curl -X POST http://localhost:3000/ocr/file -F "file=@sample.pdf"
```
