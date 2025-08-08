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
    
    // Subject line examples for psychology-based engagement
    const subjectExamples = [
      "Have you given up on this?", "Live music this weekend?", "Still looking for entertainment?", 
      "Did you find someone already?", "Quick question about music", "Is this still a priority?",
      "Last chance for live music", "Final note about music"
    ];
    
    for (let i = 0; i < ideas.length; i++) {
      // Distribute video links evenly: emails 0,1 use link 0; emails 2,3 use link 1; emails 4,5 use link 2; email 6 uses link 0 again
      const linkIndex = Math.floor(i / 2) % videoLinks.length;
      const videoLink = videoLinks[linkIndex] || '';
      
      let specialInstructions = '';
      let footerMessage = '';
      
      if (i === 5) { // 6th email - "Last chance"
        specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
        SUBJECT LINE: Use psychology-driven urgency like "Have you given up on live music?", "Last chance for entertainment?", "Final opportunity for music?"
        EMAIL BODY: Start with "I just wanted to reach out one last time about doing some live music for {{venue}}." Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates". Be professional but create FOMO.`;
      } else if (i === 6) { // 7th email - "Final goodbye"
        specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
        SUBJECT LINE: Use finality with psychology like "Final note about music", "Moving on from live music", "Last message about entertainment"
        EMAIL BODY: Start with "I wanted to reach out one final time about live music for {{venue}}." Politely acknowledge they haven't responded and you understand they're not interested. Be gracious but make it clear this is the end.`;
      } else {
        specialInstructions = `This is follow-up email #${i + 1}. 
        SUBJECT LINE: Use psychology-driven curiosity like "Still looking for live music?", "Quick question about entertainment", "Did you find someone already?", "Is live music still a priority?"
        EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." Make this email COMPLETELY different from previous ones in wording and approach while staying on the concept focus.`;
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

CRITICAL REQUIREMENTS:
1. Start with "Hi {{firstname}}" (NO COMMA EVER)
2. FIRST PARAGRAPH ONLY: Use {{venue}} merge tag exactly once in the opening sentence
3. Include 2-3 paragraphs of compelling content focused on the concept - make it WILDLY different from other emails
4. Include the video link naturally in the content
5. End with a strong call-to-action question
6. Add the opt-out message if required
7. Include the signature and contact info
8. Add the unsubscribe footer with proper spacing

VIDEO LINK DISTRIBUTION: This is email #${i + 1} using video link #${linkIndex + 1} of ${videoLinks.length}

${specialInstructions}

${footerMessage ? `IMPORTANT: Add this exact message before the signature: "${footerMessage}"` : ''}`;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8, // Higher temperature for more variety
      });

      const content = completion.choices[0].message.content;
      const parts = content.split('\n\n');
      const subject = parts[0].replace('SUBJECT:', '').trim();
      const email = parts.slice(1).join('\n\n');

      sequence.push({
        subject,
        email,
        waitDays: waitDays[i],
        idea: ideas[i],
        videoLinkUsed: linkIndex
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
    
    // Distribute video links evenly: emails 0,1 use link 0; emails 2,3 use link 1; emails 4,5 use link 2; email 6 uses link 0 again
    const linkIndex = Math.floor(emailIndex / 2) % videoLinks.length;
    const videoLink = videoLinks[linkIndex] || '';
    
    let specialInstructions = '';
    let footerMessage = '';
    
    // Define specific content focus for each email to provide NEW value each time
    const contentFocus = [
      "Focus on credentials/experience - highlight venues you've performed at, years of experience, professional background",
      "Focus on audience engagement - describe how your performances create atmosphere, energy, and customer retention", 
      "Focus on logistics/professionalism - emphasize reliable setup, sound quality, punctuality, and hassle-free experience",
      "Focus on repertoire/music style - showcase variety in setlist, ability to read the room, genre flexibility",
      "Focus on testimonials/social proof - mention feedback from previous venues, customer reactions, repeat bookings",
      "Last chance urgency - we're finalizing our calendar and booking final dates",
      "Final goodbye - we understand you're not interested and this is our final contact"
    ];

    if (emailIndex === 5) { // 6th email (index 5)
      specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
      CONTENT FOCUS: ${contentFocus[emailIndex]}
      SUBJECT LINE: Use psychology-driven urgency like "Have you given up on live music?", "Last chance for entertainment?", "Final opportunity for music?"
      EMAIL BODY: Start with "I just wanted to reach out one last time about doing some live music for {{venue}}." Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates". Be professional but create FOMO.
      PROVIDE NEW INFORMATION: Focus specifically on calendar urgency and booking deadlines - information NOT mentioned in previous emails.`;
    } else if (emailIndex === 6) { // 7th email (index 6)
      specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
      CONTENT FOCUS: ${contentFocus[emailIndex]}
      SUBJECT LINE: Use finality with psychology like "Final note about music", "Moving on from live music", "Last message about entertainment"
      EMAIL BODY: Start with "I wanted to reach out one final time about live music for {{venue}}." Politely acknowledge they haven't responded and you understand they're not interested. Be gracious but make it clear this is the end.
      PROVIDE NEW INFORMATION: This should be a respectful goodbye with understanding tone - completely different from all previous emails.`;
    } else {
      specialInstructions = `This is follow-up email #${emailIndex + 1}. 
      CONTENT FOCUS: ${contentFocus[emailIndex]} - This must be the PRIMARY focus and provide NEW information not covered in previous emails.
      SUBJECT LINE: Use psychology-driven curiosity like "Still looking for live music?", "Quick question about entertainment", "Did you find someone already?", "Is live music still a priority?"
      EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." 
      CRITICAL: Make this email COMPLETELY different from previous ones by focusing specifically on ${contentFocus[emailIndex]}. Do NOT repeat selling points from other emails.
      PROVIDE NEW INFORMATION: Each email must introduce fresh angles and benefits. If this is about ${contentFocus[emailIndex]}, make sure to provide specific details and value propositions related to this focus area only.`;
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

CRITICAL REQUIREMENTS:
1. Start with "Hi {{firstname}}" (NO COMMA EVER)
2. FIRST PARAGRAPH ONLY: Use {{venue}} merge tag exactly once in the opening sentence
3. Include 2-3 paragraphs of compelling content focused on the concept - make it WILDLY different from other emails
4. Include the video link naturally in the content
5. End with a strong call-to-action question
6. Add the opt-out message if required
7. Include the signature and contact info
8. Add the unsubscribe footer with proper spacing

VIDEO LINK DISTRIBUTION: This is email #${emailIndex + 1} using video link #${linkIndex + 1} of ${videoLinks.length}

${specialInstructions}

${footerMessage ? `IMPORTANT: Add this exact message before the signature: "${footerMessage}"` : ''}`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Higher temperature for variety
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
      fromName: fromName || signatureBlock.split('\n')[0] || 'Musician Name',
      videoLinkUsed: linkIndex
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
    
    // Distribute video links evenly
    const linkIndex = Math.floor(emailIndex / 2) % videoLinks.length;
    const videoLink = videoLinks[linkIndex] || '';
    
    let specialInstructions = '';
    let footerMessage = '';
    
    // Define specific content focus for each email to provide NEW value each time
    const contentFocus = [
      "Focus on credentials/experience - highlight venues you've performed at, years of experience, professional background",
      "Focus on audience engagement - describe how your performances create atmosphere, energy, and customer retention", 
      "Focus on logistics/professionalism - emphasize reliable setup, sound quality, punctuality, and hassle-free experience",
      "Focus on repertoire/music style - showcase variety in setlist, ability to read the room, genre flexibility",
      "Focus on testimonials/social proof - mention feedback from previous venues, customer reactions, repeat bookings",
      "Last chance urgency - we're finalizing our calendar and booking final dates",
      "Final goodbye - we understand you're not interested and this is our final contact"
    ];
    
    if (emailIndex === 5) { // 6th email - "Last chance"
      specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
      CONTENT FOCUS: ${contentFocus[emailIndex]}
      SUBJECT LINE: Use psychology-driven urgency like "Have you given up on live music?", "Last chance for entertainment?", "Final opportunity for music?"
      EMAIL BODY: Start with "I just wanted to reach out one last time about doing some live music for {{venue}}." Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates". Be professional but create FOMO.
      PROVIDE NEW INFORMATION: Focus specifically on calendar urgency and booking deadlines - information NOT mentioned in previous emails.`;
    } else if (emailIndex === 6) { // 7th email - "Final goodbye"
      specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
      CONTENT FOCUS: ${contentFocus[emailIndex]}
      SUBJECT LINE: Use finality with psychology like "Final note about music", "Moving on from live music", "Last message about entertainment"
      EMAIL BODY: Start with "I wanted to reach out one final time about live music for {{venue}}." Politely acknowledge they haven't responded and you understand they're not interested. Be gracious but make it clear this is the end.
      PROVIDE NEW INFORMATION: This should be a respectful goodbye with understanding tone - completely different from all previous emails.`;
    } else {
      specialInstructions = `This is follow-up email #${emailIndex + 1}. 
      CONTENT FOCUS: ${contentFocus[emailIndex]} - This must be the PRIMARY focus and provide NEW information not covered in previous emails.
      SUBJECT LINE: Use psychology-driven curiosity like "Still looking for live music?", "Quick question about entertainment", "Did you find someone already?", "Is live music still a priority?"
      EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." 
      CRITICAL: Make this email COMPLETELY different from previous ones by focusing specifically on ${contentFocus[emailIndex]}. Do NOT repeat selling points from other emails.
      PROVIDE NEW INFORMATION: Each email must introduce fresh angles and benefits. If this is about ${contentFocus[emailIndex]}, make sure to provide specific details and value propositions related to this focus area only.`;
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

CRITICAL REQUIREMENTS:
1. Start with "Hi {{firstname}}" (NO COMMA EVER)
2. FIRST PARAGRAPH ONLY: Use {{venue}} merge tag exactly once in the opening sentence
3. Include 2-3 paragraphs of compelling content focused on the concept - make it WILDLY different from other emails
4. Include the video link naturally in the content
5. End with a strong call-to-action question
6. Add the opt-out message if required
7. Include the signature and contact info
8. Add the unsubscribe footer with proper spacing

VIDEO LINK DISTRIBUTION: This is email #${emailIndex + 1} using video link #${linkIndex + 1} of ${videoLinks.length}

REGENERATION REQUIREMENT: Make this version WILDLY DIFFERENT from the original - use completely different wording, approach, and structure while maintaining the user's requested tone/style.

${specialInstructions}

${footerMessage ? `IMPORTANT: Add this exact message before the signature: "${footerMessage}"` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9, // Very high temperature for maximum variety
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