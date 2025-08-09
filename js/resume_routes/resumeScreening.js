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
        if (!req.file) {
            return res.status(400).json({ error: 'Missing PDF file under field "file".' });
        }
        let criteria = Criteria.value;

        // OCR 
        const opLocation = await startAnalysisBuffer(req.file.buffer, req.file.mimetype);

        // poll for result
        const analyzeResult = await pollOperation(opLocation);
        const text = analyzeResult?.content || '';

        //Ai field extraction
        const data = await extractCandidateAndFilters();
        return res.status(200).json(data);

        //Filtering 
        const dummyapplicant = { "candidate": { "name": "Jing Ngai Wong", "email": "gordonwong76@gmail.com", "phone": "+61 435017882" }, "skills": ["c", "c++", "c#", "python", "flutter", "java", "javascript", "typescript", "nodejs", "node-red", "react", "flask", "sql", "ms office", "bootstrap", "web application deployment on aws", "firebase", "figma"], "minYearsExperience": 1, "location": "Brisbane, Australia", "educationLevel": "master", "logic": "AND" }
        const score = await applicantScoring(dummyapplicant, criteria)
        return res.json({
            file: { name: req.file.originalname, size: req.file.size },
            chars: text.length,
            text, // return full text now; later you can keep only what you need
        });

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
        const score = await applicantScoring(dummyapplicant, criteria)
    } catch (e) {
        console.log(e);
    }
});
async function extractCandidateAndFilters(ocrText = "", focus = {}) {
    console.log(openaiApiKey);
    let ocrTest =
        `
    Jing Ngai (Gordon) Wong Mobile: 
    +61 435017882 E-MAIL: gordonwong76@gmail.com GitHub: @G0rdon761\nEDUCATION\nQueensland University of Technology (QUT) - GPA 6/7 Master of Information Technology\nJul 2024 - Dec 2025\n· Major in Computer Science\n· Industry Project: developing an asset management system using Django.\nMar 2021 - Nov 2023\nQueensland University of Technology (QUT) - 6.083/7 Bachelor of Information Technology\n· Major in Computer Science\n· Capstone Project: developed a mobile app for social matching using Flutter and Firebase\nWORK EXPERIENCE\nFrontline Clothing Limited, Hong Kong | Internship Jul 2021 - Dec 2021\n· Assist with 
    installation of an anti-virus software on every company owned computer\n· Set up and install the CCTV system in the main office area\n· Logging support requests\n· Resolve tickets at the first point of contact where possible\n· Escalating issues to appropriate team members\n· Ensuring all IT service requests are managed efficiently and in a timely manner.\n· Troubleshooting and problem-solving various issues, including Microsoft 365 applications,\n· Doing basic repairs to fault hardware\n 
    LANGUAGE & OTHER SKILLS\n· Language: Fluent English, Cantonese, and Mandarin\n· Technical Skills: C, C++, C#, Python, Flutter, Java, JavaScript, TypeScript, NodeJS, Node-RED, React, Flask, SQL, MS Office, Bootstrap, web application deployment on AWS and Firebase, Figma,\n· Interest: Audio production, Playing guitar, F1\nPROJECTS\nHellven Studio| Freelance Web Developer Jan 2025 - Present\n· Designing the layout of the website using Figma\n· Developing a responsive website for an audio recording studio using HTML, CSS, Javascript, REACT.\n· Implementing a credit section with embedded YouTube videos and Instagram reels\n· 
    Collaborated with clients to iteratively refine the design, incorporating feedback to create a website which satisfy the client.\n· implemented an intuitive content management system to facilitate seamless updates and efficiently handle customer inquiries\nMahjong Helper| App Developer Jan 2025 - Present\n· Designing the UI layout of the app using Figma, focus on mobile responsiveness and user-friendly interaction\n· Develop the middleware tool using REACT native to facilitate communication between the app and the AI backend\n· Integrated the ChatGPT API to process user input, generate intelligent hints, and return contextual AI-driven response for Mahjong gameplay.\nLEADERSHIP & OTHER EXPERIENCE\nCream House Café, Brisbane | Volunteer Stage Manager\nNov 2024 - Dec 2024\n· Coordinated stage setup, lighting, and sound for live performances.\n· Managed a team of technicians and ensured seamless performance transitions.\n· Oversaw rehearsals and live shows to maintain production quality.\n· Resolved conflicts between technicians and event coordinators to maintain seamless production workflow.\n· Facilitated clear communication between technical staff and production teams to align expectations.\nDepartment of Computing, PolyU | Volunteer Forum helper\nDec 2022\n· Assisted in event setup, and crowd management.\n· Provided on-site support to ensure smooth event operations.\n· Coordinated with performers, and staff to meet event requirements.\n· Helped troubleshoot last-minute issues and ensured attendee satisfaction.\n· Helped capture key moments of events through photography, ensuring high-quality images.\nPLK Vicwood KT Chong Sixth Form College, Hong Kong | Volunteer Audio and Video Engineer\nNov 2020 - Dec 2022\n· Coordinated stage setup, lighting, and sound for live performances.\n· Oversaw rehearsals and live shows to maintain production quality.\n· Resolved conflicts between technicians and event coordinators to maintain seamless production workflow.\n· Facilitated clear communication with event organizer to align expectations.\n· Applied IT troubleshooting skills to diagnose and fix audio-visual issues.\n· Integrated audio and video systems with IT networks for event streaming
    `
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

    input ${ocrTest}
        
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