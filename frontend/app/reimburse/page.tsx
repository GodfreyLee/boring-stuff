"use client";

import { useState, useRef } from "react";
import Navigation from "@/components/Navigation";

interface ProcessedReceipt {
  fileName: string;
  isValidReceipt: boolean;
  totalAmount: string | null;
  extractedText: string;
  error?: string;
  status: "pending" | "processing" | "completed" | "error";
}

export default function ReimbursePage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");

    if (pdfFiles.length === 0) {
      setError("Please select PDF files only");
      return;
    }

    if (pdfFiles.length !== files.length) {
      setError("Some files were not PDFs and were skipped");
    } else {
      setError(null);
    }

    setSelectedFiles((prev) => [...prev, ...pdfFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");

    if (pdfFiles.length === 0) {
      setError("Please select PDF files only");
      return;
    }

    if (pdfFiles.length !== files.length) {
      setError("Some files were not PDFs and were skipped");
    } else {
      setError(null);
    }

    setSelectedFiles((prev) => [...prev, ...pdfFiles]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const processReceipts = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);

    // Initialize results with pending status
    const initialResults: ProcessedReceipt[] = selectedFiles.map((file) => ({
      fileName: file.name,
      isValidReceipt: false,
      totalAmount: null,
      extractedText: "",
      status: "pending",
    }));
    setResults(initialResults);

    // Process each file sequentially
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Update status to processing
      setResults((prev) =>
        prev.map((result, index) =>
          index === i ? { ...result, status: "processing" } : result
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("http://localhost:4000/receipt/validate", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update result
        setResults((prev) =>
          prev.map((result, index) =>
            index === i
              ? {
                  ...result,
                  isValidReceipt: data.isValidReceipt,
                  totalAmount: data.totalAmount,
                  extractedText: data.extractedText || "",
                  status: "completed",
                }
              : result
          )
        );
      } catch (err: any) {
        // Update result with error
        setResults((prev) =>
          prev.map((result, index) =>
            index === i
              ? {
                  ...result,
                  error: err.message || "Failed to process receipt",
                  status: "error",
                }
              : result
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setResults([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getTotalAmount = () => {
    return results
      .filter((result) => result.totalAmount && result.isValidReceipt)
      .reduce((sum, result) => sum + parseFloat(result.totalAmount || "0"), 0)
      .toFixed(2);
  };

  const getValidReceiptsCount = () => {
    return results.filter((result) => result.isValidReceipt).length;
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #c1c1c1 0%, #a8a8a8 50%, #c1c1c1 100%)",
      }}
    >
      {/* Retro CRT scanlines effect */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,.1) 2px,
              rgba(0,0,0,.1) 4px
            ),
            linear-gradient(rgba(128,128,128,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(128,128,128,.05) 1px, transparent 1px)
          `,
            backgroundSize: "100% 4px, 40px 40px, 40px 40px",
          }}
        ></div>
      </div>

      {/* Old computer monitor bezel effect */}
      <div className="absolute inset-0 border-8 border-gray-900 shadow-inner"></div>

      <Navigation />

      <main className="relative z-10 max-w-6xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-minecraft text-white drop-shadow-lg mb-4">
            Batch Receipt Reimbursement
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload multiple receipt PDFs to extract and validate reimbursement
            details
          </p>
        </div>

        <div className="retro-container bg-white/80 text-gray-300 backdrop-blur-sm p-8 mb-8">
          {/* Drag and Drop Area */}
          <div
            className={`border-4 border-dashed p-8 rounded-lg text-center transition-colors ${
              isDragging
                ? "border-yellow-400 bg-yellow-400/10"
                : "border-gray-500 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              {/* File icon */}
              <div className="mx-auto w-16 h-16 bg-gray-600 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xl font-minecraft text-gray-400 mb-2">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} PDF${
                        selectedFiles.length > 1 ? "s" : ""
                      } selected`
                    : "Drop your PDF receipts here"}
                </p>
                <p className="text-sm font-minecraft text-gray-400">
                  or click the button below to browse (multiple files supported)
                </p>
              </div>
            </div>
          </div>

          {/* Upload Button */}
          <div className="text-center mb-6">
            <button
              onClick={handleUploadClick}
              className="retro-btn retro-btn-secondary px-6 py-3 font-minecraft mr-4"
              disabled={isProcessing}
            >
              📁 Browse Files
            </button>

            {selectedFiles.length > 0 && (
              <button
                onClick={resetForm}
                className="retro-btn retro-btn-warning px-4 py-3 font-minecraft"
                disabled={isProcessing}
              >
                🗑️ Clear All
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="retro-container bg-gray-700/50 p-4 mb-6">
              <h3 className="font-minecraft text-yellow-300 mb-3">
                Selected Files:
              </h3>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-600/50 p-2 rounded"
                  >
                    <span className="font-minecraft text-white text-sm">
                      {file.name}
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="retro-btn retro-btn-warning px-2 py-1 text-xs font-minecraft"
                      disabled={isProcessing}
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {selectedFiles.length > 0 && (
            <div className="text-center mb-6">
              <button
                onClick={processReceipts}
                disabled={isProcessing}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isProcessing
                  ? "⏳ Processing..."
                  : `🔍 Process ${selectedFiles.length} Receipt${
                      selectedFiles.length > 1 ? "s" : ""
                    }`}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="retro-container bg-red-900/80 border-4 border-red-500 p-4 mb-6">
              <h3 className="text-lg font-minecraft text-red-200 mb-2">
                ❌ Error
              </h3>
              <p className="font-minecraft text-red-300">{error}</p>
            </div>
          )}

          {/* Results Summary */}
          {results.length > 0 && (
            <div className="retro-container bg-blue-900/80 border-4 border-blue-500 p-6 mb-6">
              <h3 className="text-2xl font-minecraft text-blue-200 mb-4">
                📊 Batch Processing Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="retro-container bg-gray-700/50 p-4 text-center">
                  <h4 className="font-minecraft text-yellow-300 mb-2">
                    Total Files
                  </h4>
                  <p className="font-minecraft text-white text-2xl">
                    {results.length}
                  </p>
                </div>

                <div className="retro-container bg-gray-700/50 p-4 text-center">
                  <h4 className="font-minecraft text-yellow-300 mb-2">
                    Valid Receipts
                  </h4>
                  <p className="font-minecraft text-white text-2xl">
                    {getValidReceiptsCount()}
                  </p>
                </div>

                <div className="retro-container bg-gray-700/50 p-4 text-center">
                  <h4 className="font-minecraft text-yellow-300 mb-2">
                    Total Amount
                  </h4>
                  <p className="font-minecraft text-white text-2xl">
                    ${getTotalAmount()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Individual Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-minecraft text-white mb-4">
                📋 Individual Results:
              </h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`retro-container border-4 p-4 ${
                    result.status === "completed" && result.isValidReceipt
                      ? "bg-green-900/80 border-green-500"
                      : result.status === "error"
                      ? "bg-red-900/80 border-red-500"
                      : result.status === "processing"
                      ? "bg-yellow-900/80 border-yellow-500"
                      : "bg-gray-700/80 border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-minecraft text-white text-lg">
                      {result.fileName}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {result.status === "pending" && (
                        <span className="font-minecraft text-gray-300">
                          ⏳ Pending
                        </span>
                      )}
                      {result.status === "processing" && (
                        <span className="font-minecraft text-yellow-300">
                          🔄 Processing...
                        </span>
                      )}
                      {result.status === "completed" && (
                        <span className="font-minecraft text-green-300">
                          ✅ Completed
                        </span>
                      )}
                      {result.status === "error" && (
                        <span className="font-minecraft text-red-300">
                          ❌ Error
                        </span>
                      )}
                    </div>
                  </div>

                  {result.status === "completed" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="retro-container bg-gray-700/50 p-3">
                        <h5 className="font-minecraft text-yellow-300 mb-1">
                          Status
                        </h5>
                        <p className="font-minecraft text-white">
                          {result.isValidReceipt
                            ? "✅ Valid Receipt"
                            : "❌ Invalid Receipt"}
                        </p>
                      </div>

                      <div className="retro-container bg-gray-700/50 p-3">
                        <h5 className="font-minecraft text-yellow-300 mb-1">
                          Amount
                        </h5>
                        <p className="font-minecraft text-white">
                          {result.totalAmount
                            ? `$${result.totalAmount}`
                            : "Not detected"}
                        </p>
                      </div>
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-3">
                      <p className="font-minecraft text-red-300">
                        {result.error}
                      </p>
                    </div>
                  )}

                  {result.extractedText && result.status === "completed" && (
                    <details className="mt-3">
                      <summary className="font-minecraft text-yellow-300 cursor-pointer hover:text-yellow-200">
                        View Extracted Text
                      </summary>
                      <div className="retro-container bg-gray-700/50 p-3 mt-2 max-h-32 overflow-y-auto">
                        <pre className="font-minecraft text-gray-300 text-xs whitespace-pre-wrap">
                          {result.extractedText}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
