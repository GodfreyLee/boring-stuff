const axios = require("axios");
require("dotenv").config();

// OpenAI API configuration
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiEndpoint = "https://api.openai.com/v1/chat/completions";

// Azure OCR configuration
const azureEndpoint = process.env.AZURE_ENDPOINT;
const azureApiKey = process.env.AZURE_API_KEY;
const apiVersion = "2024-11-30";

/**
 * Extract text from PDF using Azure Document Intelligence
 * @param {Buffer} fileData - PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(fileData) {
  try {
    // Validate environment variables
    if (!azureEndpoint) {
      throw new Error("AZURE_ENDPOINT environment variable is not set");
    }
    if (!azureApiKey) {
      throw new Error("AZURE_API_KEY environment variable is not set");
    }

    // Step 1: Submit document for analysis
    const analyzeUrl = `${azureEndpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
    console.log("OCR URL:", analyzeUrl); // Debug log

    const headers = {
      "Ocp-Apim-Subscription-Key": azureApiKey,
      "Content-Type": "application/pdf",
      Accept: "application/json",
    };

    console.log("Submitting document for OCR analysis..."); // Debug log
    const response = await axios.post(analyzeUrl, fileData, {
      headers,
      validateStatus: null,
    });

    console.log("OCR Response status:", response.status); // Debug log
    console.log("OCR Response headers:", response.headers); // Debug log

    if (response.status !== 202) {
      throw new Error(
        `Azure OCR failed with status ${response.status}: ${JSON.stringify(
          response.data
        )}`
      );
    }

    const operationLocation = response.headers["operation-location"];
    if (!operationLocation) {
      throw new Error("No operation-location header received from Azure");
    }

    console.log("Operation location:", operationLocation); // Debug log

    // Step 2: Poll for results
    const result = await pollOCRResult(operationLocation);

    // Step 3: Extract text from result
    const extractedText = extractTextFromOCRResult(result);
    return extractedText;
  } catch (error) {
    console.error("OCR Error:", error.message); // Debug log
    throw new Error(`OCR extraction failed: ${error.message}`);
  }
}

/**
 * Poll Azure OCR results until completion
 * @param {string} operationLocation - Azure operation URL
 * @returns {Promise<Object>} - OCR results
 */
async function pollOCRResult(operationLocation) {
  const headers = {
    "Ocp-Apim-Subscription-Key": azureApiKey,
    Accept: "application/json",
  };

  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max

  while (attempts < maxAttempts) {
    try {
      console.log(`Polling attempt ${attempts + 1}...`); // Debug log
      const res = await axios.get(operationLocation, { headers });

      console.log("Poll response status:", res.data.status); // Debug log

      if (res.data.status === "succeeded") {
        return res.data;
      } else if (res.data.status === "failed") {
        throw new Error(`OCR analysis failed: ${JSON.stringify(res.data)}`);
      }

      // Wait 1 second before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    } catch (error) {
      console.error("Polling error:", error.message); // Debug log
      throw new Error(`Polling failed: ${error.message}`);
    }
  }

  throw new Error("OCR analysis timed out after 30 seconds");
}

/**
 * Extract plain text from OCR result
 * @param {Object} ocrResult - Azure OCR response
 * @returns {string} - Plain text
 */
function extractTextFromOCRResult(ocrResult) {
  try {
    let text = "";

    if (ocrResult.analyzeResult && ocrResult.analyzeResult.content) {
      text = ocrResult.analyzeResult.content;
    } else if (ocrResult.analyzeResult && ocrResult.analyzeResult.pages) {
      // Fallback: extract from pages
      ocrResult.analyzeResult.pages.forEach((page) => {
        if (page.lines) {
          page.lines.forEach((line) => {
            text += line.content + "\n";
          });
        }
      });
    }

    console.log("Extracted text length:", text.length); // Debug log
    return text.trim();
  } catch (error) {
    console.error("Text extraction error:", error.message); // Debug log
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

/**
 * Use OpenAI to validate receipt and extract total amount
 * @param {string} text - Extracted text from receipt
 * @returns {Promise<number>} - Total amount or -1 if invalid receipt
 */
async function validateReceiptAndGetTotal(text) {
  try {
    // Validate environment variables
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const prompt = `
Analyze the following text extracted from a document and determine:
1. Is this a valid receipt/invoice?
2. If yes, what is the total amount?

Rules:
- Return only a number (the total amount) if it's a valid receipt, don't include dollar sign
- Return -1 if it's not a valid receipt
- Look for keywords like: total, amount due, subtotal, grand total, etc.
- A valid receipt should have merchant info, items/services, and a total amount
- Consider tax, tips, and final amounts

Text to analyze:
${text}

Response format: Return only the number (e.g., 25.99 or -1)`;

    console.log("Sending text to OpenAI for validation..."); // Debug log
    const response = await axios.post(
      openaiEndpoint,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data.choices[0].message.content.trim();
    console.log("OpenAI response:", result); // Debug log

    const amount = parseFloat(result);

    // Return -1 if parsing failed or if OpenAI returned -1
    return isNaN(amount) ? -1 : amount;
  } catch (error) {
    console.error("OpenAI validation error:", error.message); // Debug log
    throw new Error(`OpenAI validation failed: ${error.message}`);
  }
}

/**
 * Main function to process receipt: OCR + AI validation
 * @param {Buffer} fileData - PDF file buffer
 * @returns {Promise<{isValid: boolean, totalAmount: number, extractedText: string}>}
 */
async function processReceipt(fileData) {
  try {
    console.log("Starting receipt processing..."); // Debug log

    // Step 1: Extract text using OCR
    const extractedText = await extractTextFromPDF(fileData);

    if (!extractedText || extractedText.length < 10) {
      return {
        isValid: false,
        totalAmount: -1,
        extractedText: extractedText || "",
        error: "No meaningful text extracted from document",
      };
    }

    console.log("Text extracted successfully, length:", extractedText.length); // Debug log

    // Step 2: Validate with OpenAI and get total
    const totalAmount = await validateReceiptAndGetTotal(extractedText);

    console.log("Receipt processing completed. Total amount:", totalAmount); // Debug log

    return {
      isValid: totalAmount !== -1,
      totalAmount: totalAmount,
      extractedText: extractedText,
    };
  } catch (error) {
    console.error("Receipt processing error:", error.message); // Debug log
    return {
      isValid: false,
      totalAmount: -1,
      extractedText: "",
      error: error.message,
    };
  }
}

module.exports = {
  processReceipt,
  extractTextFromPDF,
  validateReceiptAndGetTotal,
};
