"use client";

import { useState, useRef } from "react";
import Navigation from "@/components/Navigation";

interface ResumeScreeningResult {
  score: number;
  matched_skills: string[];
}

interface ScreeningCriteria {
  skills: string[];
  minYearsExperience: number;
  location: string;
  educationLevel: string;
  logic: string;
}

const SKILL_OPTIONS = [
  "node",
  "docker",
  "express",
  "python",
  "nextjs",
  "react",
];
const LOCATION_OPTIONS = ["brisbane", "melbourne", "sydney", "other"];
const EDUCATION_OPTIONS = ["bachelor", "master", "doctor", "other"];

export default function ResumeScreenPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResumeScreeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [skills, setSkills] = useState<string[]>(["node"]);
  const [minYearsExperience, setMinYearsExperience] = useState<number>(0);
  const [location, setLocation] = useState<string>("brisbane");
  const [educationLevel, setEducationLevel] = useState<string>("bachelor");

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
      setError("Please select a PDF file only");
      return;
    }

    setError(null);
    setSelectedFile(pdfFile);
    setResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file only");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setResult(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addSkill = (skill: string) => {
    if (!skills.includes(skill)) {
      setSkills([...skills, skill]);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  };

  const processResume = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Add the filters as JSON string (based on the curl example in resumeScreening.js)
      const filters: ScreeningCriteria = {
        skills,
        minYearsExperience,
        location,
        educationLevel,
        logic: "AND",
      };

      formData.append("filters", JSON.stringify(filters));

      const response = await fetch("http://localhost:4000/resume/filter", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to process resume";
      setError(errorMessage);
    }

    setIsProcessing(false);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setSkills(["node"]);
    setMinYearsExperience(0);
    setLocation("brisbane");
    setEducationLevel("bachelor");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "Excellent Match";
    if (score >= 0.6) return "Good Match";
    if (score >= 0.4) return "Fair Match";
    return "Poor Match";
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
            📄 Resume Screening
          </h1>
          <p className="text-lg font-minecraft text-gray-300">
            Upload a resume PDF and set criteria to score candidate
            compatibility
          </p>
        </div>

        <div className="retro-container bg-white/80 backdrop-blur-sm p-8 mb-8">
          {/* Drag and Drop Area */}
          <div
            className={`border-4 border-dashed p-8 rounded-lg text-center transition-colors mb-6 ${
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
                  Drop Resume PDF Here
                </h3>
                <p className="text-gray-600 font-minecraft mb-4">
                  Or click browse to select a PDF file
                </p>
                <div className="text-sm font-minecraft text-gray-500">
                  <p className="mb-1">📋 Supported: PDF files only</p>
                  <p>📊 Max size: 15MB</p>
                </div>
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
              📄 Browse PDF
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
            <div className="mb-6">
              <h3 className="text-lg font-minecraft text-gray-700 font-bold mb-3">
                Selected File:
              </h3>
              <div className="flex items-center justify-between bg-gray-100 p-3 rounded border">
                <div className="flex items-center space-x-3">
                  <span className="font-minecraft text-gray-700 text-sm">
                    {selectedFile.name}
                  </span>
                  <span className="font-minecraft text-gray-500 text-xs">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Screening Criteria Form */}
          <div className="space-y-6">
            <h3 className="text-lg font-minecraft text-gray-700 font-bold">
              Screening Criteria:
            </h3>

            {/* Skills */}
            <div>
              <label className="block text-sm font-minecraft text-gray-700 font-bold mb-2">
                Required Skills:
              </label>
              <div className="mb-3">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addSkill(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="retro-input px-3 py-2 font-minecraft"
                  disabled={isProcessing}
                >
                  <option value="">Add a skill...</option>
                  {SKILL_OPTIONS.filter((skill) => !skills.includes(skill)).map(
                    (skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-minecraft bg-blue-100 text-blue-800"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                      disabled={isProcessing}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Minimum Years Experience */}
            <div>
              <label className="block text-sm font-minecraft text-gray-700 font-bold mb-2">
                Minimum Years Experience:
              </label>
              <select
                value={minYearsExperience}
                onChange={(e) => setMinYearsExperience(Number(e.target.value))}
                className="retro-input px-3 py-2 font-minecraft"
                disabled={isProcessing}
              >
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} year{i !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-minecraft text-gray-700 font-bold mb-2">
                Location:
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="retro-input px-3 py-2 font-minecraft capitalize"
                disabled={isProcessing}
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc} value={loc} className="capitalize">
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Education Level */}
            <div>
              <label className="block text-sm font-minecraft text-gray-700 font-bold mb-2">
                Education Level:
              </label>
              <select
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value)}
                className="retro-input px-3 py-2 font-minecraft capitalize"
                disabled={isProcessing}
              >
                {EDUCATION_OPTIONS.map((edu) => (
                  <option key={edu} value={edu} className="capitalize">
                    {edu}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Process Button */}
          {selectedFile && (
            <div className="text-center mt-6">
              <button
                onClick={processResume}
                disabled={isProcessing || skills.length === 0}
                className={`retro-btn retro-btn-primary px-8 py-4 text-lg font-minecraft ${
                  isProcessing || skills.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {isProcessing ? "🔍 Processing Resume..." : "🔍 Screen Resume"}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-6">
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
        {result && (
          <div className="retro-container bg-white/90 backdrop-blur-sm p-6 mb-6">
            <h3 className="text-xl font-minecraft text-gray-800 font-bold text-center mb-6">
              📊 Screening Results
            </h3>

            {/* Score Display */}
            <div className="text-center mb-6">
              <div
                className={`text-6xl font-minecraft font-bold mb-2 ${getScoreColor(
                  result.score
                )}`}
              >
                {Math.round(result.score * 100)}%
              </div>
              <div
                className={`text-xl font-minecraft ${getScoreColor(
                  result.score
                )}`}
              >
                {getScoreLabel(result.score)}
              </div>
            </div>

            {/* Matched Skills */}
            <div className="mb-6">
              <h4 className="text-lg font-minecraft text-gray-700 font-bold mb-3">
                Matched Criteria:
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.matched_skills.length > 0 ? (
                  result.matched_skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-minecraft bg-green-100 text-green-800"
                    >
                      ✓ {skill}
                    </span>
                  ))
                ) : (
                  <span className="font-minecraft text-gray-500 text-sm">
                    No matching criteria found
                  </span>
                )}
              </div>
            </div>

            {/* Reset Button */}
            <div className="text-center">
              <button
                onClick={resetForm}
                className="retro-btn retro-btn-secondary px-6 py-3 font-minecraft"
              >
                🔄 Screen Another Resume
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
