require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
const { DEFAULT_PORT, EMAIL_TEMPLATE } = require('./constants');
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
 * Generate follow-up email ideas
 * @route POST /generate-followup-ideas
 */
app.post('/generate-followup-ideas', async (req, res) => {
  try {
    const { infoDump } = req.body;
    
    const prompt = `Based on this musician's information, create 7 simple follow-up email concepts. Keep them short and concept-based that users can easily understand and edit.

MUSICIAN INFO: ${infoDump}

Generate exactly 7 short concept phrases (2-4 words each) for follow-up emails. Examples:
- "Who you've worked with"
- "Key performances"
- "Radio charting"
- "Playing on radio" 
- "Award winning performances"
- "Audience engagement"
- "Musical versatility"
- "Event experience"
- "Professional reliability"
- "Unique musical style"
- "Performance highlights"

The last 2 concepts should ALWAYS be:
- "Last chance for music" (6th email)
- "Final goodbye" (7th email)

Format as a JSON array of exactly 7 short concept strings.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    const ideas = JSON.parse(content);
    
    res.json({ ideas });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate follow-up ideas' });
  }
});

/**
 * Generate complete follow-up email sequence
 * @route POST /generate-followup-sequence
 */
app.post('/generate-followup-sequence', async (req, res) => {
  try {
    const { infoDump, videoLinks, emailStyle, signatureBlock, ideas } = req.body;
    
    const sequence = [];
    const waitDays = [7, 14, 21, 31, 41, 51, 61]; // Wait days for each follow-up
    
    for (let i = 0; i < ideas.length; i++) {
      const videoLink = videoLinks[i % videoLinks.length] || ''; // Cycle through videos
      
      let specialInstructions = '';
      let footerMessage = '';
      
      if (i === 5) { // 6th email - "Last chance"
        specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
        SUBJECT LINE: Use urgent but professional language like "Last Chance", "Final Opportunity", "Closing Our Books"
        EMAIL BODY: Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates", "wrapping up our outreach". Be professional but create FOMO (fear of missing out). Mention this is the final opportunity to book before you move on to other markets/opportunities.`;
      } else if (i === 6) { // 7th email - "Final goodbye"
        specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
        SUBJECT LINE: Use finality language like "Final Note", "Moving On", "Last Message"
        EMAIL BODY: Politely acknowledge they haven't responded and you understand they're not interested. Use phrases like "we haven't heard back and understand you may not be looking for live music right now", "we'll focus our efforts elsewhere", "wishing you all the best". Be gracious but make it clear this is the end.`;
      } else {
        footerMessage = '\n\nIf it\'s not a good fit, just let me know, and I won\'t reach out again :)';
      }

      const prompt = `${EMAIL_TEMPLATE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${ideas[i]}

This is follow-up email #${i + 1} in a sequence. Make it focused on the concept above. Keep it brief but compelling. 

CRITICAL: ALWAYS include the full email structure:
1. Start with "Hi {{firstname}}" (NO COMMA EVER)
2. Include 2-3 paragraphs of compelling content about the musician focused on the concept
3. Include the video link naturally in the content  
4. End with a strong call-to-action question
5. Add the opt-out message if required
6. Include the signature and contact info
7. Add the unsubscribe footer with proper spacing

${specialInstructions}

${footerMessage ? `IMPORTANT: Add this exact message before the signature: "${footerMessage}"` : ''}`;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const content = completion.choices[0].message.content;
      const parts = content.split('\n\n');
      const subject = parts[0].replace('SUBJECT:', '').trim();
      const email = parts.slice(1).join('\n\n');

      sequence.push({
        subject,
        email,
        waitDays: waitDays[i],
        idea: ideas[i]
      });
    }
    
    res.json({ sequence });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate follow-up sequence' });
  }
});

/**
 * Generate single follow-up email (one by one approach)
 * @route POST /generate-single-followup
 */
app.post('/generate-single-followup', async (req, res) => {
  try {
    const { infoDump, videoLinks, emailStyle, signatureBlock, idea, emailIndex, fromName } = req.body;
    
    const waitDays = [7, 14, 21, 31, 41, 51, 61];
    const videoLink = videoLinks[emailIndex % videoLinks.length] || '';
    
    let specialInstructions = '';
    let footerMessage = '';
    
    if (emailIndex === 5) { // 6th email (index 5)
      specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
      SUBJECT LINE: Use urgent but professional language like "Last Chance", "Final Opportunity", "Closing Our Books"
      EMAIL BODY: Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates", "wrapping up our outreach". Be professional but create FOMO (fear of missing out). Mention this is the final opportunity to book before you move on to other markets/opportunities.`;
    } else if (emailIndex === 6) { // 7th email (index 6)
      specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
      SUBJECT LINE: Use finality language like "Final Note", "Moving On", "Last Message"
      EMAIL BODY: Politely acknowledge they haven't responded and you understand they're not interested. Use phrases like "we haven't heard back and understand you may not be looking for live music right now", "we'll focus our efforts elsewhere", "wishing you all the best". Be gracious but make it clear this is the end.`;
    } else {
      footerMessage = '\n\nIf it\'s not a good fit, just let me know, and I won\'t reach out again :)';
    }
    
    const prompt = `${EMAIL_TEMPLATE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${idea}

This is follow-up email #${emailIndex + 1} in a sequence. Make it focused on the concept above. Keep it brief but compelling. 

CRITICAL: ALWAYS include the full email structure:
1. Start with "Hi {{firstname}}" (NO COMMA EVER)
2. Include 2-3 paragraphs of compelling content about the musician focused on the concept
3. Include the video link naturally in the content  
4. End with a strong call-to-action question
5. Add the opt-out message if required
6. Include the signature and contact info
7. Add the unsubscribe footer with proper spacing

${specialInstructions}

${footerMessage ? `IMPORTANT: Add this exact message before the signature: "${footerMessage}"` : ''}`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    
    const content = completion.choices[0].message.content;
    const parts = content.split('\n\n');
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const email = parts.slice(1).join('\n\n');
    
    res.json({
      subject,
      email,
      waitDays: waitDays[emailIndex],
      idea,
      fromName: fromName || signatureBlock.split('\n')[0] || 'Musician Name'
    });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate follow-up email' });
  }
});

/**
 * Regenerate a single follow-up email
 * @route POST /regenerate-followup-email
 */
app.post('/regenerate-followup-email', async (req, res) => {
  try {
    const { infoDump, videoLinks, emailStyle, signatureBlock, idea, emailIndex } = req.body;
    
    const videoLink = videoLinks[emailIndex % videoLinks.length] || '';
    
    let specialInstructions = '';
    let footerMessage = '';
    
    if (emailIndex === 5) { // 6th email - "Last chance"
      specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
      SUBJECT LINE: Use urgent but professional language like "Last Chance", "Final Opportunity", "Closing Our Books"
      EMAIL BODY: Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates", "wrapping up our outreach". Be professional but create FOMO (fear of missing out). Mention this is the final opportunity to book before you move on to other markets/opportunities.`;
    } else if (emailIndex === 6) { // 7th email - "Final goodbye"
      specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
      SUBJECT LINE: Use finality language like "Final Note", "Moving On", "Last Message"
      EMAIL BODY: Politely acknowledge they haven't responded and you understand they're not interested. Use phrases like "we haven't heard back and understand you may not be looking for live music right now", "we'll focus our efforts elsewhere", "wishing you all the best". Be gracious but make it clear this is the end.`;
    } else {
      footerMessage = '\n\nIf it\'s not a good fit, just let me know, and I won\'t reach out again :)';
    }

    const prompt = `${EMAIL_TEMPLATE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${idea}

This is follow-up email #${emailIndex + 1} in a sequence. Make it focused on the concept above. Keep it brief but compelling. 

CRITICAL: ALWAYS include the full email structure:
1. Start with "Hi {{firstname}}" (NO COMMA EVER)
2. Include 2-3 paragraphs of compelling content about the musician focused on the concept
3. Include the video link naturally in the content  
4. End with a strong call-to-action question
5. Add the opt-out message if required
6. Include the signature and contact info
7. Add the unsubscribe footer with proper spacing

${specialInstructions}

${footerMessage ? `IMPORTANT: Add this exact message before the signature: "${footerMessage}"` : ''}

Generate a NEW version that's different from previous attempts.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Higher temperature for more variety
    });

    const content = completion.choices[0].message.content;
    const parts = content.split('\n\n');
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const email = parts.slice(1).join('\n\n');
    
    res.json({ subject, email });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate email' });
  }
});

/**
 * Serve static files and specific routes
 */
app.get('/followup-ideas.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'followup-ideas.html'));
});

app.get('/followup-email.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'followup-email.html'));
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