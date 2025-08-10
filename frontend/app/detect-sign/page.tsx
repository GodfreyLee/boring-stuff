"use client";

import { useState, useRef } from "react";
import Navigation from "@/components/Navigation";

interface SignatureDetectionResult {
  success: boolean;
  filename: string;
  is_signed: boolean;
  signature_detection: {
    confidence: string;
    description: string;
    location: string;
  };
  analysis_details: {
    image_format_used: string;
    image_dimensions: string;
    quality_scale: number;
    dpi: string;
    ai_model: string;
  };
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
}

export default function DetectSignPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<SignatureDetectionResult[]>([]);
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

    setError(null);
    setSelectedFiles(pdfFiles);
    setResults([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");

    if (pdfFiles.length === 0) {
      setError("Please select PDF files only");
      return;
    }

    setError(null);
    setSelectedFiles(pdfFiles);
    setResults([]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setSelectedFiles([]);
    setResults([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const detectSignatures = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const processedResults: SignatureDetectionResult[] = [];

      for (const file of selectedFiles) {
        // Add initial processing state for this file
        const initialResult: SignatureDetectionResult = {
          success: false,
          filename: file.name,
          is_signed: false,
          signature_detection: {
            confidence: "",
            description: "",
            location: "",
          },
          analysis_details: {
            image_format_used: "",
            image_dimensions: "",
            quality_scale: 0,
            dpi: "",
            ai_model: "",
          },
          status: "processing",
        };

        setResults((prev) => [...prev, initialResult]);

        try {
          // Send PDF directly to the endpoint
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(
            "http://localhost:5000/detect-signature-ai",
            {
              method: "POST",
              body: formData,
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          // Ensure all data fields are properly serialized strings/primitives
          const sanitizedResult: SignatureDetectionResult = {
            ...data,
            status: "completed" as const,
            filename: String(data.filename || file.name),
            signature_detection: {
              confidence: String(data.signature_detection?.confidence || ""),
              description: String(data.signature_detection?.description || ""),
              location: String(data.signature_detection?.location || ""),
            },
            analysis_details: {
              ai_model: String(data.analysis_details?.ai_model || ""),
              image_format_used: String(
                data.analysis_details?.image_format_used || ""
              ),
              image_dimensions: String(
                data.analysis_details?.image_dimensions || ""
              ),
              dpi: String(data.analysis_details?.dpi || ""),
              quality_scale: Number(data.analysis_details?.quality_scale || 0),
            },
          };

          processedResults.push(sanitizedResult);

          // Update the specific file result
          setResults((prev) =>
            prev.map((result) =>
              result.filename === file.name ? sanitizedResult : result
            )
          );
        } catch (err: unknown) {
          const errorResult: SignatureDetectionResult = {
            success: false,
            filename: file.name,
            is_signed: false,
            signature_detection: {
              confidence: "",
              description: "",
              location: "",
            },
            analysis_details: {
              image_format_used: "",
              image_dimensions: "",
              quality_scale: 0,
              dpi: "",
              ai_model: "",
            },
            status: "error",
            error:
              err instanceof Error ? err.message : "Failed to detect signature",
          };

          processedResults.push(errorResult);

          // Update the specific file result with error
          setResults((prev) =>
            prev.map((result) =>
              result.filename === file.name ? errorResult : result
            )
          );
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process files");
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
            🔍 Signature Detector
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload PDF documents to detect digital signatures using advanced AI
            analysis. Supports multiple files for batch processing.
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
                <h3 className="text-xl font-minecraft text-gray-700 font-bold mb-2">
                  Drop PDF Files Here
                </h3>
                <p className="text-gray-600 font-minecraft mb-4">
                  Or click browse to select multiple PDF files
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
              📄 Browse PDFs
            </button>

            {selectedFiles.length > 0 && (
              <button
                onClick={removeFile}
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

          {/* Selected Files Display */}
          {selectedFiles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-minecraft text-gray-700 font-bold mb-3">
                Selected Files ({selectedFiles.length}):
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-100 p-3 rounded border"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-minecraft text-gray-700 text-sm">
                        {file.name}
                      </span>
                      <span className="font-minecraft text-gray-500 text-xs">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {results.find((r) => r.filename === file.name) && (
                        <span className="font-minecraft text-xs text-blue-600">
                          {
                            results.find((r) => r.filename === file.name)
                              ?.status
                          }
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {selectedFiles.length > 0 && results.length === 0 && (
            <div className="text-center mb-6">
              <button
                onClick={detectSignatures}
                disabled={isProcessing}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isProcessing
                  ? "🔍 Processing Files..."
                  : `🔍 Detect Signatures (${selectedFiles.length})`}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-red-500 text-xl">❌</span>
                <div>
                  <h4 className="font-minecraft font-bold">Error</h4>
                  <p className="font-minecraft text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Display */}
        {results.length > 0 && (
          <div className="space-y-4 mb-6">
            <h3 className="text-xl font-minecraft text-white font-bold text-center drop-shadow-lg">
              Analysis Results
            </h3>

            {results.map((result, index) => (
              <div
                key={index}
                className={`retro-container backdrop-blur-sm p-4 ${
                  result.status === "completed"
                    ? result.is_signed
                      ? "bg-green-100/90 border-2 border-green-500"
                      : "bg-yellow-100/90 border-2 border-yellow-500"
                    : result.status === "processing"
                    ? "bg-blue-100/90 border-2 border-blue-500"
                    : "bg-red-100/90 border-2 border-red-500"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-minecraft text-gray-800 font-bold truncate flex-1 mr-4">
                    {result.filename}
                  </h4>
                  <div className="flex items-center space-x-2">
                    {result.status === "completed" && (
                      <span
                        className={`text-2xl ${
                          result.is_signed
                            ? "text-green-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {result.is_signed ? "✅" : "❌"}
                      </span>
                    )}
                    {result.status === "processing" && (
                      <span className="animate-spin text-blue-600 text-xl">
                        ⏳
                      </span>
                    )}
                    {result.status === "error" && (
                      <span className="text-red-600 text-xl">❌</span>
                    )}
                  </div>
                </div>

                <div className="font-minecraft text-sm">
                  {result.status === "completed" && (
                    <p
                      className={`${
                        result.is_signed ? "text-green-700" : "text-yellow-700"
                      }`}
                    >
                      {result.is_signed
                        ? "Signature Detected!"
                        : "No Signature Found"}
                    </p>
                  )}
                  {result.status === "processing" && (
                    <p className="text-blue-700">Processing document...</p>
                  )}
                  {result.status === "error" && (
                    <p className="text-red-700">{result.error}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Reset Button */}
            {results.some(
              (r) => r.status === "completed" || r.status === "error"
            ) && (
              <div className="text-center mt-6">
                <button
                  onClick={resetForm}
                  className="retro-btn retro-btn-secondary px-6 py-3 font-minecraft"
                >
                  🔄 Analyze More PDFs
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
