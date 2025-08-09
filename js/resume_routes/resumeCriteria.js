var express = require('express');
var router = express.Router();
const multer = require('multer');
const { z } = require('zod');
const FiltersSchema = z.object({
    skills: z.array(z.string()).optional().default([]),
    minYearsExperience: z.number().int().min(0).optional().default(0),
    location: z.string().optional(),
    educationLevel: z.enum(['highschool', 'diploma', 'bachelor', 'master', 'phd']).optional(),
    logic: z.enum(['AND', 'OR']).optional().default('AND')
});
let Criteria = { value: null };
router.post('/resume/criteria', express.json(), (req, res) => {

    try {
        const parsed = FiltersSchema.parse(req.body || {});
        Criteria.value = parsed;
        console.log(Criteria);
        return res.json({ ok: true, filters: parsed });
    } catch (e) {
        console.error('Zod errors:', e.errors);
        return res.status(400).json({ ok: false, error: 'Invalid filters', details: e.errors });
    }
});
module.exports = { router, Criteria };