"use client";

import { useState, useRef } from "react";
import Navigation from "@/components/Navigation";

interface DocumentGroup {
  name: string;
  pages: number[];
  fileName: string;
}

interface SplitResult {
  success: boolean;
  totalPages: number;
  groups: DocumentGroup[];
  message: string;
}

export default function DocSplitPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SplitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(
    new Set()
  );
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
    const pdfFile = files.find((file) => file.type === "application/pdf");

    if (!pdfFile) {
      setError("Please select a PDF file");
      return;
    }

    if (files.length > 1) {
      setError("Please select only one PDF file at a time");
      return;
    }

    setError(null);
    setSelectedFile(pdfFile);
    setResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setError(null);
        setResult(null);
      } else {
        setError("Please select a PDF file");
      }
    }
  };

  const processDocument = async () => {
    if (!selectedFile) {
      setError("Please select a PDF file first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("http://localhost:4000/document/split", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data: SplitResult = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError("Document processing failed");
      }
    } catch (err) {
      console.error("Processing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = async (fileName: string, groupName: string) => {
    setDownloadingFiles((prev) => new Set(prev).add(fileName));

    try {
      const response = await fetch(
        `http://localhost:4000/document/download/${fileName}`
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${groupName.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      setError(
        `Failed to download ${groupName}: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setDownloadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
    }
  };

  const downloadAllFiles = async () => {
    if (!result?.groups) return;

    for (const group of result.groups) {
      await downloadFile(group.fileName, group.name);
      // Add a small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        background:
          "linear-gradient(135deg, #c1c1c1 0%, #a8a8a8 50%, #c1c1c1 100%)",
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,.03) 2px,
            rgba(0,0,0,.03) 4px
          ),
          linear-gradient(rgba(128,128,128,.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(128,128,128,.02) 1px, transparent 1px),
          linear-gradient(135deg, #c1c1c1 0%, #a8a8a8 50%, #c1c1c1 100%)
        `,
        backgroundSize: "100% 4px, 40px 40px, 40px 40px, 100% 100%",
      }}
    >
      {/* Old computer monitor bezel effect */}
      <div className="absolute inset-0 border-8 border-gray-900 shadow-inner"></div>

      <Navigation />

      <main className="relative z-10 max-w-6xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-minecraft text-white drop-shadow-lg mb-4">
            Document Splitter
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload a multi-page PDF bundle to intelligently split and group
            pages by document type
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
                {selectedFile ? (
                  <svg
                    className="w-8 h-8 text-green-400"
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
                ) : (
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
                )}
              </div>

              <div>
                <p className="text-xl font-minecraft text-gray-400 mb-2">
                  {selectedFile
                    ? `Selected: ${selectedFile.name}`
                    : "Drop your PDF bundle here"}
                </p>
                <p className="text-sm font-minecraft text-gray-400">
                  or click the button below to browse (single PDF file)
                </p>
                {selectedFile && (
                  <p className="text-sm font-minecraft text-gray-500 mt-2">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Browse Button */}
          <div className="text-center mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="retro-btn retro-btn-secondary px-6 py-3 font-minecraft"
              disabled={isProcessing}
            >
              📁 Browse File
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Process Button - Only show when file is selected */}
          {selectedFile && (
            <div className="text-center mb-6">
              <button
                onClick={processDocument}
                disabled={isProcessing}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-105 transform transition-transform"
                }`}
              >
                {isProcessing ? "🔄 Processing..." : "🚀 Process Document"}
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="retro-container bg-red-600/20 backdrop-blur-sm border-4 border-red-500 p-6 mb-8">
            <div className="text-center">
              <h3 className="font-minecraft text-red-400 text-lg mb-2">
                ⚠️ Error
              </h3>
              <p className="font-minecraft text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="retro-container bg-green-600/20 backdrop-blur-sm border-4 border-green-500 p-6 mb-8">
            <div className="text-center mb-6">
              <h3 className="font-minecraft text-green-400 text-xl mb-4">
                ✅ Document Processed Successfully!
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-gray-700/50 p-4 rounded">
                  <p className="font-minecraft text-yellow-300 text-lg">📄</p>
                  <p className="font-minecraft text-white text-sm">
                    Total Pages
                  </p>
                  <p className="font-minecraft text-yellow-300 text-xl">
                    {result.totalPages}
                  </p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded">
                  <p className="font-minecraft text-blue-300 text-lg">📚</p>
                  <p className="font-minecraft text-white text-sm">
                    Groups Created
                  </p>
                  <p className="font-minecraft text-blue-300 text-xl">
                    {result.groups.length}
                  </p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded text-center">
                  <button
                    onClick={downloadAllFiles}
                    disabled={downloadingFiles.size > 0}
                    className="retro-btn retro-btn-primary px-4 py-2 font-minecraft text-sm"
                  >
                    📥 Download All
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-minecraft text-green-300 text-lg text-center mb-4">
                Document Groups:
              </h4>
              {result.groups.map((group, index) => (
                <div
                  key={index}
                  className="bg-gray-700/50 p-4 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-minecraft text-yellow-300 text-lg font-bold mb-2">
                        {group.name}
                      </h3>
                      <p className="font-minecraft text-gray-300 text-sm">
                        Pages: {group.pages.join(", ")} • {group.pages.length}{" "}
                        page{group.pages.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadFile(group.fileName, group.name)}
                      disabled={downloadingFiles.has(group.fileName)}
                      className="retro-btn retro-btn-secondary px-4 py-2 font-minecraft text-sm ml-4"
                    >
                      {downloadingFiles.has(group.fileName)
                        ? "⏳ Downloading..."
                        : "📥 Download"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="retro-container bg-yellow-600/20 backdrop-blur-sm border-4 border-yellow-500 p-6 mb-8">
            <div className="text-center">
              <h3 className="font-minecraft text-yellow-300 text-xl mb-4">
                🔄 Processing Document...
              </h3>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-12 border-b-2 border-yellow-400"></div>
              </div>
              <div className="text-left max-w-md mx-auto">
                <p className="font-minecraft text-yellow-300  mt-4 text-center">
                  This process may take several minutes depending on document
                  size...
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Retro floating elements */}
      <div className="absolute top-20 left-10 w-4 h-4 bg-amber-400 opacity-60 animate-pulse shadow-lg"></div>
      <div className="absolute top-40 right-20 w-6 h-6 bg-green-400 opacity-60 animate-pulse delay-1000 shadow-lg"></div>
      <div className="absolute bottom-32 left-20 w-5 h-5 bg-cyan-400 opacity-60 animate-pulse delay-2000 shadow-lg"></div>
      <div className="absolute bottom-20 right-10 w-3 h-3 bg-orange-400 opacity-60 animate-pulse delay-500 shadow-lg"></div>
    </div>
  );
}
