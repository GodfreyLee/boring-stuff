const express = require("express");
const axios = require("axios");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { processReceipt } = require("./reimburse");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

// Replace with your Azure endpoint and key
const endpoint = process.env.AZURE_ENDPOINT;
const apiKey = process.env.AZURE_API_KEY;
const apiVersion = "2024-11-30";

app.use(express.json());

// CORS middleware to allow frontend connections
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// OCR from public URL
app.post("/ocr/url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });
  try {
    const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
    const headers = {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const body = {
      urlSource: url,
      features: ["ocr.highResolution"],
    };
    const response = await axios.post(analyzeUrl, body, {
      headers,
      validateStatus: null,
    });
    const opLoc = response.headers["operation-location"];
    if (!opLoc)
      return res.status(500).json({ error: "No operation-location header" });
    // Poll for result
    const result = await pollResult(opLoc);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OCR from uploaded file
app.post("/ocr/file", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
    const headers = {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/pdf",
      Accept: "application/json",
    };
    const fileData = fs.readFileSync(req.file.path);
    const response = await axios.post(analyzeUrl, fileData, {
      headers,
      validateStatus: null,
    });
    const opLoc = response.headers["operation-location"];
    fs.unlinkSync(req.file.path); // Clean up
    if (!opLoc)
      return res.status(500).json({ error: "No operation-location header" });
    // Poll for result
    const result = await pollResult(opLoc);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receipt validation endpoint - OCR + AI validation
app.post("/receipt/validate", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const fileData = fs.readFileSync(req.file.path);

    // Process the receipt using the reimburse module
    const result = await processReceipt(fileData);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Return structured response
    res.json({
      isValidReceipt: result.isValid,
      totalAmount: result.totalAmount,
      extractedText: result.extractedText,
      error: result.error || null,
    });
  } catch (err) {
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Polling function
async function pollResult(operationLocation) {
  const headers = {
    "Ocp-Apim-Subscription-Key": apiKey,
    Accept: "application/json",
  };
  while (true) {
    const res = await axios.get(operationLocation, { headers });
    if (res.data.status === "succeeded") {
      return res.data;
    } else if (res.data.status === "failed") {
      throw new Error("Analysis failed");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

app.listen(port, () => {
  console.log(`OCR backend listening at http://localhost:${port}`);
});
