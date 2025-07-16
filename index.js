require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
const { DEFAULT_PORT } = require('./constants');
const { generateEmailPrompt, callOpenAI } = require('./emailGenerator');

// Initialize Express app
const app = express();
const port = process.env.PORT || DEFAULT_PORT;

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('API Key:', process.env.OPENAI_API_KEY ? 'Found' : 'Not found');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * Email generation endpoint
 * @route POST /generate-email
 */
app.post('/generate-email', async (req, res) => {
  try {
    const prompt = generateEmailPrompt(req.body);
    console.log('Sending request to OpenAI...');
    const completion = await callOpenAI(openai, prompt);
    const content = completion.choices[0].message.content;
    
    // Extract subject line and email body
    const parts = content.split('\n\n');
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const email = parts.slice(1).join('\n\n');
    
    res.json({ subject, email });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate email' });
  }
});

/**
 * Serve the main application page
 * @route GET /
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 