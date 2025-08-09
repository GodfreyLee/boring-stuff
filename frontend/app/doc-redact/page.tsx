"use client";

import { useState, useRef } from "react";
import Navigation from "@/components/Navigation";

interface RedactedDocument {
  originalFileName: string;
  newFileName: string;
  downloadUrl: string;
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
}

export default function DocRedactPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<RedactedDocument[]>([]);
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

  const processDocuments = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);

    // Initialize results with pending status
    const initialResults: RedactedDocument[] = selectedFiles.map((file) => ({
      originalFileName: file.name,
      newFileName: "",
      downloadUrl: "",
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

        const response = await fetch("http://localhost:5000/redact-document", {
          method: "POST",
          body: formData,
        });

        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);

        // Log all headers for debugging
        for (let [key, value] of response.headers.entries()) {
          console.log(`Header ${key}: ${value}`);
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle file download response
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);

        // Extract new filename from Content-Disposition header if available
        const contentDisposition = response.headers.get("Content-Disposition");
        console.log("Content-Disposition header:", contentDisposition);

        let newFileName = file.name;
        if (contentDisposition) {
          console.log("Found Content-Disposition header");

          // Try multiple patterns for filename extraction
          let filenameMatch = contentDisposition.match(
            /filename\*?="?([^";\n]+)"?/
          );
          if (!filenameMatch) {
            filenameMatch = contentDisposition.match(/filename\*?=([^;\n]+)/);
          }

          console.log("Filename match result:", filenameMatch);
          if (filenameMatch) {
            newFileName = filenameMatch[1].replace(/"/g, "").trim();
            console.log("Extracted new filename:", newFileName);
          }
        } else {
          console.log("No Content-Disposition header found, using fallback");
          // Fallback: add "_redacted" to the original filename
          const nameWithoutExt = file.name.replace(/\.pdf$/i, "");
          newFileName = `${nameWithoutExt}_redacted.pdf`;
          console.log("Fallback filename:", newFileName);
        }

        console.log("Final filename:", newFileName);

        // Update result
        setResults((prev) =>
          prev.map((result, index) =>
            index === i
              ? {
                  ...result,
                  newFileName: newFileName,
                  downloadUrl: downloadUrl,
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
                  error: err.message || "Failed to redact document",
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
    // Clean up blob URLs
    results.forEach((result) => {
      if (result.downloadUrl) {
        URL.revokeObjectURL(result.downloadUrl);
      }
    });
  };

  const downloadFile = (result: RedactedDocument) => {
    if (result.downloadUrl) {
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = result.newFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadAllFiles = () => {
    const completedResults = results.filter(
      (result) => result.status === "completed" && result.downloadUrl
    );
    completedResults.forEach((result) => {
      setTimeout(() => downloadFile(result), 100); // Small delay between downloads
    });
  };

  const getCompletedCount = () => {
    return results.filter((result) => result.status === "completed").length;
  };

  const getErrorCount = () => {
    return results.filter((result) => result.status === "error").length;
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
            Document Redactor
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload PDF documents to redact them with sensitive information
            removal
          </p>
        </div>

        <div className="retro-container bg-white/80 backdrop-blur-sm p-8 mb-8">
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
                    : "Drop your PDF documents here"}
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
                onClick={processDocuments}
                disabled={isProcessing}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isProcessing
                  ? "⏳ Processing..."
                  : `🔒 Redact ${selectedFiles.length} Document${
                      selectedFiles.length > 1 ? "s" : ""
                    }`}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 p-4 rounded-lg mb-6">
              <p className="font-minecraft text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="retro-container bg-white/80 backdrop-blur-sm p-8">
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
            <div className="retro-container bg-blue-900/80 border-4 border-blue-500 p-6 mb-6">
              <h3 className="text-2xl font-minecraft text-blue-200 mb-4">
                📊 Redaction Summary
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
                    Successfully Redacted
                  </h4>
                  <p className="font-minecraft text-white text-2xl">
                    {getCompletedCount()}
                  </p>
                </div>

                <div className="retro-container bg-gray-700/50 p-4 text-center">
                  <h4 className="font-minecraft text-yellow-300 mb-2">
                    Errors
                  </h4>
                  <p className="font-minecraft text-white text-2xl">
                    {getErrorCount()}
                  </p>
                </div>
              </div>

              {/* Download All Button */}
              {getCompletedCount() > 0 && (
                <div className="text-center">
                  <button
                    onClick={downloadAllFiles}
                    className="retro-btn retro-btn-primary px-6 py-3 font-minecraft"
                  >
                    💾 Download All Redacted Files
                  </button>
                </div>
              )}
            </div>

            {/* Individual Results */}
            <div className="space-y-4">
              <h3 className="text-xl font-minecraft text-white mb-4">
                📋 Individual Results:
              </h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`retro-container border-4 p-4 ${
                    result.status === "completed"
                      ? "bg-green-900/80 border-green-500"
                      : result.status === "error"
                      ? "bg-red-900/80 border-red-500"
                      : result.status === "processing"
                      ? "bg-yellow-900/80 border-yellow-500"
                      : "bg-gray-700/80 border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-minecraft text-white text-lg">
                        {result.originalFileName}
                      </h4>
                      {result.newFileName && (
                        <p className="font-minecraft text-gray-300 text-sm">
                          → {result.newFileName}
                        </p>
                      )}
                    </div>
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

                  {result.status === "completed" && result.downloadUrl && (
                    <div className="text-center">
                      <button
                        onClick={() => downloadFile(result)}
                        className="retro-btn retro-btn-primary px-4 py-2 font-minecraft"
                      >
                        💾 Download
                      </button>
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-3">
                      <p className="font-minecraft text-red-300">
                        {result.error}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
