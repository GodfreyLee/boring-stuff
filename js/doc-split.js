const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { OpenAI } = require("openai");
require("dotenv").config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Azure Document Intelligence configuration
const endpoint = process.env.AZURE_ENDPOINT;
const apiKey = process.env.AZURE_API_KEY;
const apiVersion = "2024-11-30";

// Helper function to perform OCR on a single file
async function performOCROnFile(fileBuffer) {
  try {
    const analyzeUrl = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
    const headers = {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/pdf",
      Accept: "application/json",
    };

    const response = await axios.post(analyzeUrl, fileBuffer, {
      headers,
      validateStatus: null,
    });

    const opLoc = response.headers["operation-location"];
    if (!opLoc) throw new Error("No operation-location header");

    const result = await pollResult(opLoc);

    // Extract text content from the result
    let extractedText = "";
    if (result.analyzeResult && result.analyzeResult.content) {
      extractedText = result.analyzeResult.content;
    }

    return extractedText;
  } catch (error) {
    console.error("OCR error:", error);
    return "";
  }
}

// Polling function for Azure Document Intelligence
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

// Helper function to analyze pages with OpenAI
async function analyzeDocumentPages(pageTexts) {
  try {
    const prompt = `I have a multi-page document that has been split into individual pages. Please analyze the text content of each page and group pages that belong to the same document type or category together. Give each group a descriptive name.

Here are the pages:
${pageTexts
  .map((page) => `Page ${page.pageNumber}: ${page.text.substring(0, 500)}...`)
  .join("\n\n")}

Please respond with a JSON object in this format:
{
  "groups": [
    {
      "name": "Descriptive Group Name",
      "description": "Brief description of what this group contains",
      "pages": [1, 2, 3]
    }
  ]
}

Group pages that appear to be:
- Same document type (e.g., invoices, contracts, receipts, certificates)
- Same company or organization
- Same format or template
- Related content

Make sure every page number from 1 to ${
      pageTexts.length
    } is included in exactly one group.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a document analysis expert. Analyze document pages and group them logically based on content, format, and document type.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("OpenAI analysis error:", error);
    // Fallback: create a single group with all pages
    return {
      groups: [
        {
          name: "All Pages",
          description: "All pages grouped together due to analysis error",
          pages: pageTexts.map((p) => p.pageNumber),
        },
      ],
    };
  }
}

// Helper function to create grouped PDF files
async function createGroupedPDFs(
  groupingResponse,
  pageFiles,
  originalPdfDoc,
  outputDir
) {
  const groupedFiles = [];

  for (const group of groupingResponse.groups) {
    try {
      const groupDoc = await PDFDocument.create();

      // Add pages to the group document
      for (const pageNum of group.pages) {
        const pageIndex = pageNum - 1; // Convert to 0-based index
        if (pageIndex >= 0 && pageIndex < originalPdfDoc.getPageCount()) {
          const [copiedPage] = await groupDoc.copyPages(originalPdfDoc, [
            pageIndex,
          ]);
          groupDoc.addPage(copiedPage);
        }
      }

      // Save the grouped PDF
      const sanitizedName = group.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const groupFileName = `${sanitizedName}_${Date.now()}.pdf`;
      const groupFilePath = path.join(outputDir, groupFileName);

      const groupBytes = await groupDoc.save();
      fs.writeFileSync(groupFilePath, groupBytes);

      groupedFiles.push({
        name: group.name,
        description: group.description || "",
        pages: group.pages,
        filePath: groupFilePath,
        fileName: groupFileName,
      });
    } catch (error) {
      console.error(`Error creating group "${group.name}":`, error);
    }
  }

  return groupedFiles;
}

// Main function to process document splitting
async function processDocumentSplit(file) {
  const tempDir = path.join(__dirname, "temp", Date.now().toString());
  const pagesDir = path.join(tempDir, "pages");
  const groupsDir = path.join(tempDir, "groups");

  try {
    // Create temporary directories
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.mkdirSync(groupsDir, { recursive: true });

    // Step 1: Split PDF into individual pages
    console.log("Splitting PDF into individual pages...");
    const pdfBuffer = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    const pageTexts = [];
    const pageFiles = [];

    // Split each page and perform OCR
    for (let i = 0; i < pageCount; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);

      const pageFileName = `page_${i + 1}.pdf`;
      const pageFilePath = path.join(pagesDir, pageFileName);
      const pageBytes = await singlePageDoc.save();
      fs.writeFileSync(pageFilePath, pageBytes);
      pageFiles.push(pageFilePath);

      // Step 2: Perform OCR on each page
      console.log(`Performing OCR on page ${i + 1}...`);
      const pageText = await performOCROnFile(pageBytes);
      pageTexts.push({
        pageNumber: i + 1,
        text: pageText,
        filePath: pageFilePath,
      });
    }

    // Step 3: Send all texts to OpenAI for grouping
    console.log("Analyzing pages with AI for grouping...");
    const groupingResponse = await analyzeDocumentPages(pageTexts);

    // Step 4: Create grouped PDFs based on AI response
    console.log("Creating grouped documents...");
    const groupedFiles = await createGroupedPDFs(
      groupingResponse,
      pageFiles,
      pdfDoc,
      groupsDir
    );

    // Clean up individual page files
    pageFiles.forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    return {
      success: true,
      totalPages: pageCount,
      groups: groupedFiles.map((group) => ({
        name: group.name,
        pages: group.pages,
        fileName: path.basename(group.filePath),
      })),
      message: "Document successfully split and grouped",
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

// Function to find and serve grouped files
function findGroupedFile(filename) {
  const tempDirs = fs
    .readdirSync(path.join(__dirname, "temp"))
    .filter((dir) =>
      fs.statSync(path.join(__dirname, "temp", dir)).isDirectory()
    );

  // Search for the file in temp directories
  for (const tempDir of tempDirs) {
    const groupsDir = path.join(__dirname, "temp", tempDir, "groups");
    if (fs.existsSync(groupsDir)) {
      const potentialPath = path.join(groupsDir, filename);
      if (fs.existsSync(potentialPath)) {
        return potentialPath;
      }
    }
  }

  return null;
}

// Function to cleanup old temp files
function cleanupOldFiles() {
  try {
    const tempBaseDir = path.join(__dirname, "temp");
    if (fs.existsSync(tempBaseDir)) {
      const tempDirs = fs
        .readdirSync(tempBaseDir)
        .filter((dir) =>
          fs.statSync(path.join(tempBaseDir, dir)).isDirectory()
        );

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      let cleanedCount = 0;

      tempDirs.forEach((dirName) => {
        const dirPath = path.join(tempBaseDir, dirName);
        const dirTimestamp = parseInt(dirName);

        if (dirTimestamp < oneHourAgo) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          cleanedCount++;
        }
      });

      return {
        message: `Cleaned up ${cleanedCount} old temporary directories`,
      };
    } else {
      return { message: "No temp directory found" };
    }
  } catch (error) {
    throw new Error(`Cleanup error: ${error.message}`);
  }
}

module.exports = {
  processDocumentSplit,
  findGroupedFile,
  cleanupOldFiles,
};
