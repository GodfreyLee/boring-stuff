"use client";

import { useState, useRef, useEffect } from "react";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SignatureDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [convertedImage, setConvertedImage] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // Update image URL when converted image changes
  useEffect(() => {
    if (convertedImage) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      const newUrl = URL.createObjectURL(convertedImage);
      setImageUrl(newUrl);
    } else {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
    }
  }, [convertedImage]);

  const convertPdfToPng = async (file: File): Promise<Blob> => {
    try {
      // Dynamically import PDF.js to avoid SSR issues
      const pdfjsLib = await import("pdfjs-dist");

      // Set up worker only in browser environment using local worker file
      if (typeof window !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Get the first page
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

      // Create canvas - ensure no viewport object leaks to React
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to get canvas context");
      }

      // Extract dimensions as primitive values
      const width = Number(viewport.width);
      const height = Number(viewport.height);

      canvas.height = height;
      canvas.width = width;

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;

      // Convert canvas to PNG blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to convert canvas to blob"));
            }
          },
          "image/png",
          1.0
        );
      });
    } catch (error) {
      console.error("PDF conversion error:", error);
      throw new Error(
        `Failed to convert PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

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

    if (files.length > 1) {
      setError("Please select only one file at a time");
      return;
    }

    setError(null);
    setSelectedFile(pdfFiles[0]);
    setResult(null);
    setConvertedImage(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");

    if (pdfFiles.length === 0) {
      setError("Please select PDF files only");
      return;
    }

    if (files.length > 1) {
      setError("Please select only one file at a time");
      return;
    }

    setError(null);
    setSelectedFile(pdfFiles[0]);
    setResult(null);
    setConvertedImage(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setConvertedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const detectSignature = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResult({
      success: false,
      filename: selectedFile.name,
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
    });

    try {
      // Convert PDF to PNG
      const pngBlob = await convertPdfToPng(selectedFile);
      setConvertedImage(pngBlob);

      // Create form data with the converted PNG
      const formData = new FormData();
      const pngFile = new File(
        [pngBlob],
        `${selectedFile.name.replace(".pdf", "")}.png`,
        {
          type: "image/png",
        }
      );
      formData.append("file", pngFile);

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
      const sanitizedResult = {
        ...data,
        status: "completed" as const,
        filename: String(data.filename || selectedFile.name),
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

      setResult(sanitizedResult);
    } catch (err: any) {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              error: err.message || "Failed to detect signature",
              status: "error",
            }
          : null
      );
      setError(err.message || "Failed to detect signature");
    }

    setIsProcessing(false);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setConvertedImage(null);
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

      <main className="relative z-10 max-w-4xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-minecraft text-white drop-shadow-lg mb-4">
            Signature Detector
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload PDF documents to detect if they contain signatures
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
              {/* PDF icon */}
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
                  {selectedFile
                    ? `Selected: ${selectedFile.name}`
                    : "Drop your PDF here"}
                </p>
                <p className="text-sm font-minecraft text-gray-400">
                  or click the button below to browse (PDF files only)
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
              � Browse PDF
            </button>

            {selectedFile && (
              <button
                onClick={removeFile}
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

          {/* Selected File Display */}
          {selectedFile && (
            <div className="retro-container bg-gray-700/50 p-4 mb-6">
              <h3 className="font-minecraft text-yellow-300 mb-3">
                Selected PDF:
              </h3>
              <div className="flex items-center justify-between bg-gray-600/50 p-2 rounded">
                <div className="flex items-center space-x-3">
                  <span className="font-minecraft text-white text-sm">
                    {selectedFile.name}
                  </span>
                  <span className="font-minecraft text-gray-300 text-xs">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={removeFile}
                  className="retro-btn retro-btn-warning px-2 py-1 text-xs font-minecraft"
                  disabled={isProcessing}
                >
                  ❌
                </button>
              </div>
            </div>
          )}

          {/* Converted Image Preview */}
          {convertedImage && imageUrl && (
            <div className="retro-container bg-gray-700/50 p-4 mb-6">
              <h3 className="font-minecraft text-yellow-300 mb-3">
                Converted Image Preview:
              </h3>
              <div className="text-center">
                <img
                  src={imageUrl}
                  alt="Converted PDF"
                  className="max-w-full max-h-64 mx-auto border-2 border-gray-500 rounded"
                />
                <p className="font-minecraft text-gray-300 text-xs mt-2">
                  First page converted to PNG for signature detection
                </p>
              </div>
            </div>
          )}

          {/* Process Button */}
          {selectedFile && !result && (
            <div className="text-center mb-6">
              <button
                onClick={detectSignature}
                disabled={isProcessing}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isProcessing ? "🔍 Processing..." : "🔍 Detect Signature"}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="retro-container bg-red-500/20 border-2 border-red-500 p-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-red-400 text-xl">❌</span>
                <div>
                  <h4 className="font-minecraft text-red-400 font-bold">
                    Error
                  </h4>
                  <p className="font-minecraft text-red-300 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && result.status === "completed" && (
            <div className="retro-container bg-green-500/20 border-2 border-green-500 p-6">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <span
                    className={`text-4xl ${
                      result.is_signed ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {result.is_signed ? "✅" : "❌"}
                  </span>
                  <div>
                    <h3 className="font-minecraft text-green-400 text-2xl font-bold">
                      Analysis Complete
                    </h3>
                    <p
                      className={`font-minecraft text-lg ${
                        result.is_signed ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {result.is_signed
                        ? "Signature Detected!"
                        : "No Signature Found"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reset Button */}
              <div className="text-center mt-6">
                <button
                  onClick={resetForm}
                  className="retro-btn retro-btn-secondary px-6 py-3 font-minecraft"
                >
                  🔄 Analyze Another PDF
                </button>
              </div>
            </div>
          )}

          {/* Processing State */}
          {result && result.status === "processing" && (
            <div className="retro-container bg-blue-500/20 border-2 border-blue-500 p-6">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="animate-spin text-2xl">⏳</div>
                  <div>
                    <h3 className="font-minecraft text-blue-400 text-xl font-bold">
                      Processing...
                    </h3>
                    <p className="font-minecraft text-blue-300">
                      Analyzing your document
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error in Result */}
          {result && result.status === "error" && (
            <div className="retro-container bg-red-500/20 border-2 border-red-500 p-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-red-400 text-xl">❌</span>
                <div>
                  <h4 className="font-minecraft text-red-400 font-bold">
                    Processing Error
                  </h4>
                  <p className="font-minecraft text-red-300 text-sm">
                    {result.error}
                  </p>
                </div>
              </div>
              <div className="text-center mt-4">
                <button
                  onClick={resetForm}
                  className="retro-btn retro-btn-secondary px-4 py-2 font-minecraft"
                >
                  🔄 Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
