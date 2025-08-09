# Receipt Validation API

This endpoint validates receipts using Azure Document Intelligence for OCR and OpenAI for intelligent validation.

## New Endpoint

### Receipt Validation

- **POST** `/receipt/validate`
- **Form-Data:** `file` (PDF upload)
- **Returns:** JSON with validation result

## Response Format

```json
{
  "isValidReceipt": true,
  "totalAmount": 25.99,
  "extractedText": "STORE NAME\nItem 1: $10.00\nItem 2: $15.99\nTotal: $25.99",
  "error": null
}
```

Or for invalid receipts:

```json
{
  "isValidReceipt": false,
  "totalAmount": -1,
  "extractedText": "Some non-receipt text...",
  "error": null
}
```

## How It Works

1. **OCR Processing**: Uses Azure Document Intelligence to extract text from the uploaded PDF
2. **AI Validation**: Sends extracted text to OpenAI GPT-3.5-turbo to:
   - Determine if the document is a valid receipt
   - Extract the total amount if it's a valid receipt
   - Return -1 if it's not a valid receipt

## Test Commands

**PowerShell:**

```powershell
# Test with a receipt PDF
$form = @{
    file = Get-Item "receipt.pdf"
}
Invoke-RestMethod -Uri "http://localhost:3000/receipt/validate" -Method POST -Form $form
```

**curl (if available):**

```bash
curl -X POST http://localhost:3000/receipt/validate -F "file=@receipt.pdf"
```

## Environment Variables Required

Make sure your `.env` file contains:

```
AZURE_ENDPOINT=your_azure_endpoint
AZURE_API_KEY=your_azure_key
OPENAI_API_KEY=your_openai_key
```

## Files

- `reimburse.js` - Contains the receipt processing logic
- `ocr-backend.js` - Main Express server with all endpoints
