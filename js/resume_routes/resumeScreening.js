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
// Replace with your Azure endpoint and key
const endpoint = process.env.AZURE_ENDPOINT;
const apiKey = process.env.AZURE_API_KEY;
const apiVersion = "2024-11-30";

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

        //upload

        //retrieve

        // 3) Do OCR -> AI field extraction (stubbed)
        const opLocation = await startAnalysisBuffer(req.file.buffer, req.file.mimetype);

        // Step 2: poll for result
        const analyzeResult = await pollOperation(opLocation);
        const text = analyzeResult?.content || '';

        return res.json({
            file: { name: req.file.originalname, size: req.file.size },
            chars: text.length,
            text, // return full text now; later you can keep only what you need
        });
        // 4) Apply filtering logic (stub)
        // const isMatch = applyFilters(fields, parsedFilters);
        // 5) Return result
        return res.status(200).json({
            received: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype
            },
            filters: parsedFilters,
            // match: isMatch,
            // candidate: fields,
            message: 'PDF received and filters parsed. Proceeded to processing pipeline.'
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

module.exports = router;