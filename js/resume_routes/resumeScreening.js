require("dotenv").config();
var express = require("express");
var router = express.Router();
const multer = require("multer");
const { z } = require("zod");
let { Criteria } = require("./resumeCriteria");
var axios = require("axios");
/*
curl -X POST http://localhost:3000/resumes/filter \
  -F "file=@/path/to/resume.pdf;type=application/pdf" \
  -F 'filters={
    "skills":["node","docker"],
    "minYearsExperience":2,
    "location":"Brisbane",
    "educationLevel":"bachelor",
    "logic":"AND"
  }'
*/

const endpoint = process.env.AZURE_ENDPOINT;
const apiKey = process.env.AZURE_API_KEY;
const apiVersion = "2024-11-30";
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiEndpoint = "https://api.openai.com/v1/chat/completions";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});
router.get("/resume/criteria", async (req, res) => {
  console.log("get criteria", Criteria);
  return res.status(200).json(Criteria);
});

router.post("/resume/criteria", upload.single("file"), async (req, res) => {
  try {
    // Parse the filters from the request
    let filters;
    if (req.body.filters) {
      if (typeof req.body.filters === "string") {
        filters = JSON.parse(req.body.filters);
      } else {
        filters = req.body.filters;
      }
    } else {
      // Default criteria if none provided
      filters = {
        skills: ["node", "docker", "express", "c"],
        minYearsExperience: 3,
        location: "Brisbane",
        educationLevel: "bachelor",
        logic: "AND",
      };
    }

    // Update global Criteria
    Criteria = {
      value: filters,
    };

    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Missing PDF file under field "file".' });
    }

    // OCR
    const opLocation = await startAnalysisBuffer(
      req.file.buffer,
      req.file.mimetype
    );

    // poll for result
    const analyzeResult = await pollOperation(opLocation);
    const text = analyzeResult?.content || "";

    //Ai field extraction
    const data = await extractCandidateAndFilters(text);

    //requirement match score
    const result = await applicantScoringPrompt(data, filters);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Keep the old endpoint for backward compatibility
router.post("/resume/filter", upload.single("file"), async (req, res) => {
  try {
    if (Criteria["value"] == null) {
      Criteria = {
        value: {
          skills: ["node", "docker", "express", "c"],
          minYearsExperience: 3,
          location: "Brisbane",
          educationLevel: "bachelor",
          logic: "AND",
        },
      };
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Missing PDF file under field "file".' });
    }

    // OCR
    const opLocation = await startAnalysisBuffer(
      req.file.buffer,
      req.file.mimetype
    );

    // poll for result
    const analyzeResult = await pollOperation(opLocation);
    const text = analyzeResult?.content || "";

    //Ai field extraction
    const data = await extractCandidateAndFilters(text);

    //requirement match score
    const result = await applicantScoringPrompt(data, Criteria["value"]);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
async function startAnalysisBuffer(buffer, contentType = "application/pdf") {
  const url = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
  console.log(url);
  const resp = await axios.post(url, buffer, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": contentType,
      Accept: "application/json",
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: (s) => s === 202, // expect 202 Accepted
  });

  const opLocation = resp.headers["operation-location"];
  if (!opLocation) throw new Error("Missing operation-location header");
  return opLocation;
}

async function pollOperation(
  opLocation,
  { intervalMs = 1000, timeoutMs = 60000 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const resp = await axios.get(opLocation, {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        Accept: "application/json",
      },
    });
    const data = resp.data || {};
    if (data.status === "succeeded") return data.analyzeResult; // v4 payload
    if (data.status === "failed" || data.status === "cancelled") {
      throw new Error(`Analysis ${data.status}: ${JSON.stringify(data)}`);
    }
    const retryAfter = Number(resp.headers["retry-after"]);
    const sleepMs = retryAfter ? retryAfter * 1000 : intervalMs;
    if (Date.now() + sleepMs > deadline) throw new Error("Polling timed out");
    await new Promise((r) => setTimeout(r, sleepMs));
  }
}
router.get("/resume/testPrompt", async (req, res) => {
  try {
    const dummyapplicant = {
      candidate: {
        name: "Jing Ngai Wong",
        email: "gordonwong76@gmail.com",
        phone: "+61 435017882",
      },
      skills: [
        "c",
        "c++",
        "c#",
        "python",
        "flutter",
        "java",
        "javascript",
        "typescript",
        "nodejs",
        "node-red",
        "react",
        "flask",
        "sql",
        "ms office",
        "bootstrap",
        "web application deployment on aws",
        "firebase",
        "figma",
      ],
      minYearsExperience: 1,
      location: "Brisbane, Australia",
      educationLevel: "master",
      logic: "AND",
    };
    const score = await applicantScoring(dummyapplicant, Criteria["value"]);
    console.log(score);
  } catch (e) {
    console.log(e);
  }
});
async function applicantScoringPrompt(applicant, criteria) {
  const prompt =
    `You are a strict evaluator. Compare an APPLICANT’s skills to a JOB CRITERIA with weights and output STRICT JSON only.

### Input
APPLICANT (JSON):
- skills: string[]  // e.g., ["nodejs","docker","react","sql"]

JOB CRITERIA (JSON):
- skills: (string | { name: string, weight?: number, aliases?: string[] })[]
  // Examples:
  // ["node","docker","express"]
  // or [{ "name": "node", "weight": 0.4, "aliases": ["nodejs","node.js"] }, { "name": "docker", "weight": 0.3 }, "express"]

### Matching rules (be deterministic)
1) Normalize all skill strings: trim, lowercase.
2) A criterion skill S is considered matched if ANY is true:
   a) exact match with an applicant skill;
   b) S is in the criterion’s aliases and any alias matches an applicant skill.
3) Do NOT infer synonyms unless provided via aliases. No semantic guessing.
4) Treat common variations or abbreviations of the same technology as equivalent (e.g., "node" and "nodejs" are the same skill).
5) If a criterion item is a plain string, treat it as { name: <string>, weight: null, aliases: [] }.
6) Skills weight handling:
   - count the number of matched skills to the criteria's skills set.
7) Evaluate minYearsExperience:
   - Score 1.0 if applicant meets or exceeds the requirement.
8) Evaluate location:
   - Score 1.0 if applicant location contains the criteria location.
   - Score 0.0 otherwise.
9) Evaluate educationLevel:
   - Map to rank: highschool=1, diploma=2, bachelor=3, master=4, phd=5.
   - Score 1 if applicant rank is larger or equal than criteria rank, else 0.
10) Final score = weighted score of:
    - Skills score (weight of 0.5 to total score),
    - minYearsExperience (weight of 0.2 to total score),
    - Location (weight of 0.15 to total score),
    - Education level (weight of 0.15 to total score)
    Clamp to [0,1].
11) Provide a breakdown showing individual component scores and skill-by-skill match details.


### Output (STRICT JSON, no prose)
{
  "score": number,               // float 0..1 with 3 decimals
  "components": {
    "skillsScore": number,
    "experienceScore": number,
    "locationScore": number,
    "educationScore": number
  },
  "matchedSkills": string[],
  "missingSkills": string[],
  "breakdown": [
    { "skill": string, "weight": number, "matched": boolean, "evidence": string | null }
  ]
}

### Now evaluate using the following payloads:

APPLICANT=
{{APPLICANT_JSON}}

JOB_CRITERIA=
{{JOB_CRITERIA_JSON}}` // paste the prompt above
      .replace("{{APPLICANT_JSON}}", JSON.stringify(applicant))
      .replace("{{JOB_CRITERIA_JSON}}", JSON.stringify(criteria));

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    },
    {
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );
  const content = response.data?.choices?.[0]?.message?.content;

  if (!content) {
    console.error("No content in OpenAI response:", response.data);
    throw new Error("Missing content in API response");
  }

  // Parse the model’s JSON string into an actual object
  let resultObj;
  try {
    resultObj = JSON.parse(content.trim());
  } catch (err) {
    console.error("Model output was not valid JSON:", content);
    throw err;
  }

  console.log("OpenAI JSON object:", resultObj);
  return resultObj;
}
async function applicantScoring(applicant, criteria) {
  let score = 0;
  let totalPossible = 0;
  let matchedskills = [];
  // Skills match without using .length
  if (criteria.skills && Array.isArray(criteria.skills)) {
    totalPossible += 10; // weight for skills
    let matchedCount = 0;
    let totalCount = 0;

    for (const skill of criteria.skills) {
      totalCount++;
      for (const aSkill of applicant.skills || []) {
        if (aSkill.toLowerCase() === skill.toLowerCase()) {
          matchedskills.push(aSkill);
          matchedCount++;
          break;
        }
      }
    }

    if (totalCount > 0) {
      score += (matchedCount / totalCount) * 10;
    }
  }

  // Minimum years of experience
  if (criteria.minYearsExperience !== undefined) {
    totalPossible += 10;
    if (applicant.minYearsExperience >= criteria.minYearsExperience) {
      matchedskills.push(applicant.minYearsExperience);
      score += 10;
    } else if (criteria.minYearsExperience > 0) {
      matchedskills.push(applicant.minYearsExperience);
      score +=
        (applicant.minYearsExperience / criteria.minYearsExperience) * 10;
    }
  }

  // Location match
  if (criteria.location) {
    totalPossible += 5;
    if (
      applicant.location &&
      applicant.location.toLowerCase().includes(criteria.location.toLowerCase())
    ) {
      matchedskills.push(applicant.location);
      score += 5;
    }
  }

  // Education level match
  if (criteria.educationLevel) {
    totalPossible += 5;
    if (
      applicant.educationLevel &&
      applicant.educationLevel.toLowerCase() ===
        criteria.educationLevel.toLowerCase()
    ) {
      matchedskills.push(applicant.educationLevel);
      score += 5;
    }
  }

  // Return normalised score between 0 and 1
  return {
    score: totalPossible > 0 ? score / totalPossible : 0,
    matched_skills: matchedskills,
  };
}
async function extractCandidateAndFilters(ocrText = "", focus = {}) {
  const prompt = `
    You are an information extraction engine.
    Extract facts directly from the resume text and output strictly valid JSON matching the provided schema.
    Rules:
    1) Extract the applicant's name, email, phone
    1) Only extract facts explicitly present—no guessing.
    2) skills: normalize to lowercase tokens (single words or hyphenated), remove duplicates.
    2a) For programming languages or technologies mentioned with extra words (e.g., "coding in C language", "experience with Python scripting"), extract only the core name (e.g., "c", "python").
    3) minYearsExperience: if work dates exist, estimate total full years across roles (non-overlapping) and floor to an integer; otherwise omit.
    4) location: short free-text from the resume (city/state/country if present).
    5) educationLevel: map highest level found to one of: highschool | diploma | bachelor | master | phd. Omit if unclear.
    6) logic: set to "AND".
    7) candidate: fill name/email/phone if present; omit missing fields.
    8) No commentary or extra keys—only the schema fields.

    input ${ocrText}
        
    output format as a json object
    `;
  const body = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 500,
    temperature: 0.1,
  };

  const response = await axios.post(openaiEndpoint, body, {
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 60000,
  });
  const content = response.data?.choices?.[0]?.message?.content;

  if (!content) {
    console.error("No content in OpenAI response:", response.data);
    throw new Error("Missing content in API response");
  }

  // Parse the model’s JSON string into an actual object
  let resultObj;
  try {
    resultObj = JSON.parse(content.trim());
  } catch (err) {
    console.error("Model output was not valid JSON:", content);
    throw err;
  }

  console.log("OpenAI JSON object:", resultObj);
  return resultObj;
}

module.exports = router;
