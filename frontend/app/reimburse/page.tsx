"use client";

import { useState, useRef } from "react";
import Navigation from "@/components/Navigation";

export default function ReimbursePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
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

    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type === "application/pdf") {
      setSelectedFile(files[0]);
      setError(null);
    } else {
      setError("Please select a PDF file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0] && files[0].type === "application/pdf") {
      setSelectedFile(files[0]);
      setError(null);
    } else {
      setError("Please select a PDF file");
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processReceipt = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://localhost:4000/receipt/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to process receipt");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Retro grid pattern overlay */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `
            linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      <Navigation />

      <main className="relative z-10 max-w-4xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-minecraft text-white drop-shadow-lg mb-4">
            Receipt Reimbursement
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload your receipt PDF to extract and validate reimbursement
            details
          </p>
        </div>

        <div className="retro-container bg-gray-800/90 backdrop-blur-sm p-8 mb-8">
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
                <p className="text-xl font-minecraft text-white mb-2">
                  {selectedFile
                    ? selectedFile.name
                    : "Drop your PDF receipt here"}
                </p>
                <p className="text-sm font-minecraft text-gray-400">
                  or click the button below to browse
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

            {selectedFile && (
              <button
                onClick={resetForm}
                className="retro-btn retro-btn-warning px-4 py-3 font-minecraft"
                disabled={isProcessing}
              >
                🗑️ Clear
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Process Button */}
          {selectedFile && (
            <div className="text-center mb-6">
              <button
                onClick={processReceipt}
                disabled={isProcessing}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isProcessing ? "⏳ Processing..." : "🔍 Process Receipt"}
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

          {/* Results Display */}
          {result && (
            <div className="space-y-4">
              <div className="retro-container bg-green-900/80 border-4 border-green-500 p-6">
                <h3 className="text-2xl font-minecraft text-green-200 mb-4">
                  ✅ Receipt Analysis Complete
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="retro-container bg-gray-700/50 p-4">
                    <h4 className="font-minecraft text-yellow-300 mb-2">
                      Status
                    </h4>
                    <p className="font-minecraft text-white">
                      {result.isValidReceipt
                        ? "✅ Valid Receipt"
                        : "❌ Invalid Receipt"}
                    </p>
                  </div>

                  <div className="retro-container bg-gray-700/50 p-4">
                    <h4 className="font-minecraft text-yellow-300 mb-2">
                      Total Amount
                    </h4>
                    <p className="font-minecraft text-white text-xl">
                      {result.totalAmount
                        ? `$${result.totalAmount}`
                        : "Not detected"}
                    </p>
                  </div>
                </div>

                {result.extractedText && (
                  <div className="retro-container bg-gray-700/50 p-4 mt-4">
                    <h4 className="font-minecraft text-yellow-300 mb-2">
                      Extracted Text
                    </h4>
                    <div className="max-h-40 overflow-y-auto">
                      <pre className="font-minecraft text-gray-300 text-xs whitespace-pre-wrap">
                        {result.extractedText}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
