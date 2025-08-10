require("dotenv").config();
var express = require('express');
var router = express.Router();
const multer = require('multer');
const { z } = require('zod');
let { Criteria } = require('./resumeCriteria');
var axios = require('axios');
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
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed'));
    }
});
router.get('/resume/criteria', async (req, res) => {
    console.log(Criteria)
    return res.status(200).json(Criteria)
})

router.post('/resume/filter', upload.single('file'), async (req, res) => {
    try {
        if (Criteria["value"] == null) {
            Criteria = {
                value: {

                    skills: ['node', 'docker', 'express', 'c'],
                    minYearsExperience: 3,
                    location: 'Brisbane',
                    educationLevel: 'bachelor',
                    logic: 'AND'
                }
            }
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Missing PDF file under field "file".' });
        }


        // OCR 
        const opLocation = await startAnalysisBuffer(req.file.buffer, req.file.mimetype);

        // poll for result
        const analyzeResult = await pollOperation(opLocation);
        const text = analyzeResult?.content || '';

        //Ai field extraction
        const data = await extractCandidateAndFilters(text);


        //requirement match score
        const dummyapplicant = { "candidate": { "name": "Jing Ngai Wong", "email": "gordonwong76@gmail.com", "phone": "+61 435017882" }, "skills": ["c", "c++", "c#", "python", "flutter", "java", "javascript", "typescript", "nodejs", "node-red", "react", "flask", "sql", "ms office", "bootstrap", "web application deployment on aws", "firebase", "figma"], "minYearsExperience": 1, "location": "Brisbane, Australia", "educationLevel": "master", "logic": "AND" }
        const score = await applicantScoring(data, Criteria["value"])
        return res.status(200).json(score);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});
async function startAnalysisBuffer(buffer, contentType = 'application/pdf') {

    const url = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
    console.log(url);
    const resp = await axios.post(url, buffer, {
        headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': contentType,
            'Accept': 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (s) => s === 202, // expect 202 Accepted
    });

    const opLocation = resp.headers['operation-location'];
    if (!opLocation) throw new Error('Missing operation-location header');
    return opLocation;
}

async function pollOperation(opLocation, { intervalMs = 1000, timeoutMs = 60000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
        const resp = await axios.get(opLocation, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Accept': 'application/json',
            },
        });
        const data = resp.data || {};
        if (data.status === 'succeeded') return data.analyzeResult; // v4 payload
        if (data.status === 'failed' || data.status === 'cancelled') {
            throw new Error(`Analysis ${data.status}: ${JSON.stringify(data)}`);
        }
        const retryAfter = Number(resp.headers['retry-after']);
        const sleepMs = retryAfter ? retryAfter * 1000 : intervalMs;
        if (Date.now() + sleepMs > deadline) throw new Error('Polling timed out');
        await new Promise(r => setTimeout(r, sleepMs));
    }
}
router.get('/resume/testPrompt', async (req, res) => {
    try {
        const dummyapplicant = { "candidate": { "name": "Jing Ngai Wong", "email": "gordonwong76@gmail.com", "phone": "+61 435017882" }, "skills": ["c", "c++", "c#", "python", "flutter", "java", "javascript", "typescript", "nodejs", "node-red", "react", "flask", "sql", "ms office", "bootstrap", "web application deployment on aws", "firebase", "figma"], "minYearsExperience": 1, "location": "Brisbane, Australia", "educationLevel": "master", "logic": "AND" }
        const score = await applicantScoring(dummyapplicant, Criteria["value"])
        console.log(score)
    } catch (e) {
        console.log(e);
    }
});
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
            matchedskills.push(applicant.minYearsExperience)
            score += 10;
        } else if (criteria.minYearsExperience > 0) {
            matchedskills.push(applicant.minYearsExperience)
            score += (applicant.minYearsExperience / criteria.minYearsExperience) * 10;
        }
    }

    // Location match
    if (criteria.location) {
        totalPossible += 5;
        if (applicant.location && applicant.location.toLowerCase().includes(criteria.location.toLowerCase())) {
            matchedskills.push(applicant.location);
            score += 5;
        }
    }

    // Education level match
    if (criteria.educationLevel) {
        totalPossible += 5;
        if (applicant.educationLevel && applicant.educationLevel.toLowerCase() === criteria.educationLevel.toLowerCase()) {
            matchedskills.push(applicant.educationLevel);
            score += 5;
        }
    }

    // Return normalised score between 0 and 1
    return { score: totalPossible > 0 ? score / totalPossible : 0, matched_skills: matchedskills };


}
async function extractCandidateAndFilters(ocrText = "", focus = {}) {
    console.log(Criteria);
    console.log(ocrText);
    const prompt =
        `
    You are an information extraction engine.
    Extract facts directly from the resume text and output strictly valid JSON matching the provided schema.
    Rules:
    1) Extract the applicant's name, email, phone
    1) Only extract facts explicitly present—no guessing.
    2) skills: normalize to lowercase tokens (single words or hyphenated), remove duplicates.
    3) minYearsExperience: if work dates exist, estimate total full years across roles (non-overlapping) and floor to an integer; otherwise omit.
    4) location: short free-text from the resume (city/state/country if present).
    5) educationLevel: map highest level found to one of: highschool | diploma | bachelor | master | phd. Omit if unclear.
    6) logic: set to "AND".
    7) candidate: fill name/email/phone if present; omit missing fields.
    8) No commentary or extra keys—only the schema fields.

    input ${ocrText}
        
    output format as a json object
    `
    const body = {
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: prompt
        }],
        max_tokens: 500,
        temperature: 0.1,

    };

    const response = await axios.post(
        openaiEndpoint,
        body,
        {
            headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60000
        }
    )
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