/**
 * ============================================================================
 * MUSICIAN PITCH EMAIL GENERATOR - MAIN SERVER FILE
 * ============================================================================
 * 
 * Version: 5.0.0 (v5.0_date-auto-config)
 * 
 * OVERVIEW:
 * This is the main Express server that powers the Musician Pitch Email Generator.
 * It provides REST API endpoints for generating AI-powered personalized pitch emails
 * for musicians to send to venues.
 * 
 * KEY FEATURES:
 * - Initial pitch email generation
 * - 7-email follow-up sequence generation
 * - Intelligent date filtering (v5.0) - prevents expired dates in emails
 * - Dynamic accolade extraction from artist info
 * - Anti-repetition system across email sequence
 * - Merge tag system ({{venue}}, {{firstname}}, {{unsubscribe_link}})
 * - Video link distribution across emails
 * - Greeting rotation (8 variations)
 * 
 * API ENDPOINTS:
 * POST /generate-email              - Generate initial pitch email
 * POST /generate-followup-ideas      - Generate 7 follow-up concept ideas
 * POST /generate-followup-sequence  - Generate complete 7-email sequence
 * POST /generate-single-followup     - Generate one follow-up email
 * POST /regenerate-followup-email    - Regenerate a follow-up with variation
 * GET  /                             - Serve main HTML page
 * GET  /followup-ideas.html          - Serve follow-up ideas page
 * GET  /followup-email.html          - Serve follow-up email review page
 * 
 * INTEGRATION POINTS:
 * - Database: Currently stateless, add DB calls in endpoints as needed
 * - Email Service: Replace merge tags and send via your ESP (SendGrid, etc.)
 * - Authentication: Add auth middleware to endpoints for production
 * 
 * ENVIRONMENT VARIABLES:
 * - OPENAI_API_KEY: Your OpenAI API key (required)
 * - PORT: Server port (optional, defaults to 3000)
 * 
 * See README.md, DEVELOPER_GUIDE.md, and API_REFERENCE.md for more details.
 * ============================================================================
 */

// Load environment variables from .env file
require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

// Import constants and configuration
const { DEFAULT_PORT, EMAIL_TEMPLATE, DISCLAIMER_VARIATIONS, GPT_MODEL, GREETING_ROTATION } = require('./constants');

// Import email generation utilities
const { generateEmailPrompt, callOpenAI } = require('./emailGenerator');

// Import date filtering utilities (v5.0 feature)
const { filterAvailabilityByDate, getWaitDays } = require('./dateUtils');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compact the EMAIL_TEMPLATE by reducing multiple newlines to single newlines.
 * This reduces token usage when sending prompts to OpenAI while maintaining readability.
 * The EMAIL_TEMPLATE is 400+ lines long, so this optimization is important.
 */
const PREAMBLE = EMAIL_TEMPLATE.replace(/\n{3,}/g, '\n');

/**
 * Safely extract JSON from OpenAI response that may include markdown code fences or extra text.
 * 
 * The AI sometimes returns JSON wrapped in ```json``` code fences or with explanatory text.
 * This function tries multiple strategies to extract valid JSON:
 * 1. Try parsing directly
 * 2. Remove code fences and try again
 * 3. Find JSON array markers [ ] and extract
 * 4. Find JSON object markers { } and extract
 * 
 * @param {string} text - Raw text from OpenAI response
 * @returns {object|array} Parsed JSON object or array
 * @throws {Error} If no valid JSON can be extracted
 */
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const withoutFences = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    try {
      return JSON.parse(withoutFences);
    } catch (_) {
      const arrStart = withoutFences.indexOf('[');
      const arrEnd = withoutFences.lastIndexOf(']');
      const objStart = withoutFences.indexOf('{');
      const objEnd = withoutFences.lastIndexOf('}');
      if (arrStart !== -1 && arrEnd > arrStart) {
        try { return JSON.parse(withoutFences.slice(arrStart, arrEnd + 1)); } catch (_) {}
      }
      if (objStart !== -1 && objEnd > objStart) {
        try { return JSON.parse(withoutFences.slice(objStart, objEnd + 1)); } catch (_) {}
      }
      throw new Error('Model response is not valid JSON');
    }
  }
}

/**
 * Append unsubscribe footer to generated email with large spacing.
 * 
 * The 200 blank lines push the unsubscribe link far below the visible email content.
 * This makes the email look more personal while still including the required unsubscribe option.
 * 
 * INTEGRATION POINT: Replace {{unsubscribe_link}} with actual unsubscribe URL before sending.
 * 
 * @param {string} email - The generated email body
 * @returns {string} Email with unsubscribe footer appended
 */
const FOOTER_SPACING_LINES = 200;
const UNSUBSCRIBE_FOOTER = 'Remove future contact here\n{{unsubscribe_link}}';
const appendFooter = (email) => `${email}\n${'\n'.repeat(FOOTER_SPACING_LINES)}${UNSUBSCRIBE_FOOTER}`;

/**
 * Map email index (0-7) to the appropriate greeting from GREETING_ROTATION.
 * 
 * The system rotates through 8 different greetings across the email sequence:
 * - Email 0 (Initial): "Hi"
 * - Email 1 (Follow-up 1): "Hello"
 * - Email 2 (Follow-up 2): "Hi there"
 * - Email 3 (Follow-up 3): "Hey there"
 * - Email 4 (Follow-up 4): "Hi again"
 * - Email 5 (Follow-up 5): "Hello again"
 * - Email 6 (Follow-up 6): "Greetings"
 * - Email 7 (Follow-up 7): "Hey"
 * 
 * This variation helps avoid spam detection and keeps emails feeling fresh.
 * 
 * @param {number} emailIndex - Index of email in sequence (0-7)
 * @returns {string} Greeting string (e.g., "Hi", "Hello", "Hi there")
 */
function getGreetingForIndex(emailIndex) {
  const idx = Math.max(0, Math.min(GREETING_ROTATION.length - 1, emailIndex));
  return GREETING_ROTATION[idx];
}

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

// Initialize Express application
const app = express();
const port = process.env.PORT || DEFAULT_PORT;

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Log API key status on startup (helpful for debugging)
console.log('API Key:', process.env.OPENAI_API_KEY ? 'Found' : 'Not found');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Enable CORS for cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Serve static files from public/ directory (HTML, CSS, JS)
app.use(express.static('public'));

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * ENDPOINT: Generate Initial Pitch Email
 * 
 * POST /generate-email
 * 
 * Generates the first pitch email that musicians send to venues.
 * 
 * REQUEST BODY:
 * {
 *   infoDump: string        - Detailed musician info (background, experience, style, etc.)
 *   videoLinks: string[]    - 1-3 performance video URLs
 *   emailStyle: string      - Desired tone (e.g., "Professional", "Casual")
 *   signatureBlock: string  - Contact info (name, phone, email, website)
 *   availability: string    - Availability dates (e.g., "November 9-26th", "OPEN")
 *   currentDate?: string    - ISO date string for date filtering (v5.0)
 * }
 * 
 * RESPONSE:
 * {
 *   subject: string  - Generated subject line (2-5 words, NO merge tags)
 *   email: string    - Complete email body with merge tags and unsubscribe footer
 * }
 * 
 * INTEGRATION POINTS:
 * - Add database call here to save generated email
 * - Add authentication middleware for production
 * - Replace merge tags before sending via email service
 * 
 * See API_REFERENCE.md for complete documentation.
 */
app.post('/ai/generate-email', async (req, res) => {
  try {
    // Step 1: Build AI prompt using helper function from emailGenerator.js
    const prompt = generateEmailPrompt(req.body);
    
    // Step 2: Call OpenAI API (can take 5-15 seconds)
    console.log('Sending request to OpenAI...');
    const completion = await callOpenAI(openai, prompt);
    const content = completion.choices[0].message.content;
    
    // Step 3: Parse response to extract subject line and email body
    // AI returns format: "SUBJECT: ..." followed by blank line and email body
    const parts = content.split('\n\n');
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const email = parts.slice(1).join('\n\n');
    
    // Step 4: Add unsubscribe footer with 200 blank lines
    const finalEmail = appendFooter(email);
    
    // Step 5: Return generated email
    // INTEGRATION: Save to database here if needed
    res.json({ subject, email: finalEmail });
    
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate email' });
  }
});

/**
 * ENDPOINT: Generate Follow-Up Ideas
 * 
 * POST /generate-followup-ideas
 * 
 * Generates 7 follow-up email concept ideas based on the musician's information.
 * These are short 2-4 word phrases that become the talking point for each follow-up.
 * 
 * REQUEST BODY:
 * {
 *   infoDump: string  - Musician's detailed information
 * }
 * 
 * RESPONSE:
 * {
 *   ideas: string[]  - Array of 7 concept phrases
 * }
 * 
 * EXAMPLES OF GENERATED IDEAS:
 * - "Past Festival Appearances"
 * - "Radio spots"
 * - "Quotes from venue owners"
 * - "Musical versatility"
 * - "Technical setup expertise"
 * - "Last chance for live music"  (always 6th)
 * - "Final goodbye"               (always 7th)
 * 
 * The AI analyzes the infoDump and extracts 5 unique concepts based on the
 * artist's actual background. The last 2 are always "Last chance" and "Final goodbye".
 * 
 * INTEGRATION POINTS:
 * - User can edit these ideas in the frontend before generating follow-ups
 * - These ideas are passed to /generate-followup-sequence or /generate-single-followup
 * 
 * See API_REFERENCE.md for complete documentation.
 */
app.post('/ai/generate-followup-ideas', async (req, res) => {
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
      model: GPT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    const ideas = extractJson(content);
    
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
app.post('/ai/generate-followup-sequence', async (req, res) => {
  try {
    const { infoDump, videoLinks, emailStyle, signatureBlock, ideas, currentDate, availability } = req.body;
    
    const sequence = [];
    const waitDays = [7, 14, 21, 31, 41, 51, 61]; // Wait days for each follow-up
    
    // Subject line examples for psychology-based engagement
    const subjectExamples = [
      "Have you given up on this?", "Live music this weekend?", "Still looking for entertainment?", 
      "Did you find someone already?", "Quick question about music", "Is this still a priority?",
      "Last chance for live music", "Final note about music"
    ];
    
    // DYNAMIC ACCOLADE EXTRACTION - Analyze artist's info dump first
    const accoladeExtractionPrompt = `ANALYZE this artist's information and EXTRACT their MOST compelling, specific accolades/achievements. Each must be COMPLETELY DIFFERENT and introduce NEW reasons to book them:

ARTIST INFO: ${infoDump}

CRITICAL REQUIREMENTS:
- Extract 7+ DISTINCT accolades (we need extras to ensure uniqueness)
- Each accolade must be COMPLETELY DIFFERENT from the others
- Each must provide a NEW reason why venues should book this artist
- NO OVERLAP or repetition between accolades
- Make each accolade specific and compelling

EXTRACT from these categories (choose DIFFERENT ones for each accolade):
1. Notable venues performed at (specific names, types, locations)
2. Years of experience and career milestones  
3. Musical genres, instruments, or unique styles
4. Awards, recognition, or media coverage
5. Audience reactions, testimonials, or repeat bookings
6. Technical skills, equipment, or professional setup
7. Special performances, tours, or significant events
8. Collaborations with other artists or industry professionals
9. Educational background or musical training
10. Unique selling points that differentiate them
11. Customer/audience impact stories
12. Professional reliability and setup expertise
13. Repertoire breadth and adaptability
14. Social media following or fan base
15. Recording or album achievements

RETURN exactly 7 COMPLETELY DIFFERENT, specific accolades. Each must introduce a NEW angle for booking. Format as JSON array of objects with "accolade", "category", and "booking_angle" fields.

Example format:
[
  {"accolade": "Performed at Blue Note Jazz Club for 3 years", "category": "venue_experience", "booking_angle": "proven_venue_success"},
  {"accolade": "15 years of professional performance experience", "category": "experience_milestone", "booking_angle": "seasoned_professional"},
  {"accolade": "Specializes in smooth jazz and acoustic covers", "category": "musical_style", "booking_angle": "perfect_atmosphere"},
  {"accolade": "Featured in Local Music Magazine as 'Artist to Watch'", "category": "media_recognition", "booking_angle": "media_validated_talent"},
  {"accolade": "Customers consistently stay 2+ hours longer during performances", "category": "audience_impact", "booking_angle": "revenue_increase"},
  {"accolade": "Professional sound equipment and seamless setup", "category": "technical_reliability", "booking_angle": "hassle_free_booking"},
  {"accolade": "Repertoire of 200+ songs across multiple genres", "category": "repertoire_breadth", "booking_angle": "versatile_entertainment"}
]`;

    let extractedAccolades = [];
    try {
      const accoladeCompletion = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [{ role: "user", content: accoladeExtractionPrompt }],
        temperature: 0.3, // Lower temperature for more consistent extraction
      });
      
      const accoladeContent = accoladeCompletion.choices[0].message.content;
      extractedAccolades = extractJson(accoladeContent);
    } catch (error) {
      console.error('Accolade extraction failed, using fallback:', error);
      // Fallback to diverse categories if extraction fails - each completely different
      extractedAccolades = [
        {"accolade": "Years of professional performance experience", "category": "experience", "booking_angle": "seasoned_professional"},
        {"accolade": "Proven ability to create engaging atmosphere", "category": "audience_engagement", "booking_angle": "customer_retention"},
        {"accolade": "Professional equipment and reliable setup", "category": "technical_reliability", "booking_angle": "hassle_free_booking"},
        {"accolade": "Diverse musical repertoire and adaptability", "category": "repertoire_versatility", "booking_angle": "broad_appeal"},
        {"accolade": "Strong audience connection and interaction", "category": "performance_skills", "booking_angle": "memorable_experience"},
        {"accolade": "Consistent professionalism and punctuality", "category": "business_reliability", "booking_angle": "dependable_partner"},
        {"accolade": "Unique musical style and presentation", "category": "distinctive_offering", "booking_angle": "competitive_advantage"}
      ];
    }

    for (let i = 0; i < ideas.length; i++) {
      // Filter availability dates for this specific email's send date
      const daysUntilSend = waitDays[i];
      const { hasValidDates, filteredAvailability } = filterAvailabilityByDate(availability, daysUntilSend, currentDate);
      
      const linkIndex = Math.floor(i / 2) % videoLinks.length;
      const videoLink = videoLinks[linkIndex] || '';
      
      let specialInstructions = '';
      let footerMessage = '';
      
      if (i === 5) {
        specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
        SUBJECT LINE: Create URGENCY WITH CURIOSITY using the artist's specific background - something like "Before you book [genre] music", "The [specific credential] opportunity", "Time-sensitive [style] booking". Make it curiosity-driven and relevant to their unique background.
        EMAIL BODY: Start with "I just wanted to reach out one last time about doing some live music for {{venue}}." Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates". Be professional but create FOMO.`;
      } else if (i === 6) {
        specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
        SUBJECT LINE: Create gentle closure with intrigue using their background - something like "One last thing about [genre]", "Before we go - [credential]", "Final note from [years] years". Create curiosity even in goodbye while being personal to them.
        EMAIL BODY: Start with "I wanted to reach out one final time about live music for {{venue}}." Politely acknowledge they haven't responded and you understand they're not interested. Be gracious but make it clear this is the end.`;
      } else if (i >= 1 && i <= 4) {
        const accoladeIndex = i - 1;
        const currentAccolade = extractedAccolades[accoladeIndex] || extractedAccolades[0];
        const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
        specialInstructions = `This is follow-up email #${i + 1}. 
        SPECIFIC ACCOLADE FOCUS: "${currentAccolade.accolade}" - This email must focus ENTIRELY on this specific achievement/credential from their background.
        BOOKING ANGLE: "${currentAccolade.booking_angle}" - Explain why THIS specific accolade makes them the perfect choice for booking.
        SUBJECT LINE: Create IRRESISTIBLE CURIOSITY around this specific accolade. Use their actual details - venues, years, genres, achievements, etc.
        EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." Focus ENTIRELY on the specific accolade "${currentAccolade.accolade}".`;
        footerMessage = `\n\n${randomDisclaimer}`;
      } else {
        const email1Accolade = extractedAccolades[4] || extractedAccolades[0];
        const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
        specialInstructions = `This is follow-up email #${i + 1}. 
        SPECIFIC ACCOLADE FOCUS: "${email1Accolade.accolade}" - Use this as the primary focus for this first follow-up.`;
        footerMessage = `\n\n${randomDisclaimer}`;
      }

      // Build availability instruction for this email
      const availabilityInstruction = hasValidDates && filteredAvailability 
        ? `MANDATORY AVAILABILITY: Include these specific dates in the email body (after pitch, before signature): "${filteredAvailability}". Frame professionally like "I have ${filteredAvailability} that could work well" or "These dates are available: ${filteredAvailability}".`
        : `AVAILABILITY NOTE: Artist's original dates have passed by the time this email sends. Do NOT mention any specific dates. Only ask about venue's available dates.`;
      
      const prompt = `${PREAMBLE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${ideas[i]}

${availabilityInstruction}

ANTI-REPETITION MANDATE:
- This email #${i + 1} must introduce COMPLETELY NEW information not used in any other email
- Each email in the sequence must focus on a DIFFERENT accolade/achievement
- NO overlapping content, selling points, or credentials between emails
- Each subject line must be UNIQUE and create different curiosity gaps
- Provide a fresh, new reason to book this artist that hasn't been mentioned before

CRITICAL REQUIREMENTS:
1. Greeting: Use exactly "${getGreetingForIndex(i + 1)} {{firstname}}" (NO COMMA EVER)
2. FIRST PARAGRAPH ONLY: Use {{venue}} merge tag exactly once in the opening sentence
3. Include 2-3 paragraphs of compelling content focused on the concept - make it WILDLY different from other emails
4. Include the video link naturally in the content
5. End with a strong call-to-action question
6. Add the opt-out message if required
7. Include the signature and contact info
8. Add the unsubscribe footer with proper spacing

VIDEO LINK DISTRIBUTION: This is email #${i + 1} using video link #${linkIndex + 1} of ${videoLinks.length}

${specialInstructions}

${footerMessage ? `MANDATORY DISCLAIMER PLACEMENT: Add this exact message on its own line BEFORE the signature block: "${footerMessage}"` : ''}`;
      
      const completion = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      });

      const content = completion.choices[0].message.content;
      const parts = content.split('\n\n');
      const subject = parts[0].replace('SUBJECT:', '').trim();
      const email = parts.slice(1).join('\n\n');
      const finalEmail = appendFooter(email);
      
      sequence.push({
        subject,
        email: finalEmail,
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
app.post('/ai/generate-single-followup', async (req, res) => {
  try {
    const { infoDump, videoLinks, emailStyle, signatureBlock, idea, emailIndex, fromName, currentDate, availability } = req.body;
    
    const waitDays = [7, 14, 21, 31, 41, 51, 61];
    
    // Filter availability dates based on when this email will be sent
    const daysUntilSend = waitDays[emailIndex] || 0;
    const { hasValidDates, filteredAvailability } = filterAvailabilityByDate(availability, daysUntilSend, currentDate);
    
    // Distribute video links evenly: emails 0,1 use link 0; emails 2,3 use link 1; emails 4,5 use link 2; email 6 uses link 0 again
    const linkIndex = Math.floor(emailIndex / 2) % videoLinks.length;
    const videoLink = videoLinks[linkIndex] || '';
    
    let specialInstructions = '';
    let footerMessage = '';
    
    // DYNAMIC ACCOLADE EXTRACTION for single follow-up - ENHANCED TO TARGET SPECIFIC TALKING POINT
    let extractedAccolade = null;
    if (emailIndex >= 0 && emailIndex <= 4) { // For emails 1-5, extract accolades related to the specific talking point
      const accoladeExtractionPrompt = `ANALYZE this artist's information and EXTRACT their most compelling, specific accolade/achievement that relates to the talking point "${idea}" for follow-up email #${emailIndex + 1}:

ARTIST INFO: ${infoDump}

TALKING POINT FOCUS: "${idea}"

CRITICAL REQUIREMENTS:
- Find information in the artist's background that DIRECTLY relates to "${idea}"
- Extract specific details, names, numbers, venues, achievements that support this talking point
- If "${idea}" mentions "radio spots" - look for radio play, airtime, stations, interviews
- If "${idea}" mentions "festival appearances" - look for specific festivals, dates, locations
- If "${idea}" mentions "quotes from ppl" - look for testimonials, reviews, feedback
- If "${idea}" mentions music style/genre - look for specific genres, instruments, repertoire
- Make the accolade SPECIFIC and COMPELLING with actual details from their background

EMAIL MAPPING STRATEGY:
- Email #1 (index 0): Use the talking point to find relevant credentials/experience
- Email #2 (index 1): Focus on venue experience or performance history related to the talking point
- Email #3 (index 2): Focus on audience impact or customer retention related to the talking point  
- Email #4 (index 3): Focus on technical reliability or professional setup related to the talking point
- Email #5 (index 4): Focus on musical style, repertoire, or unique offerings related to the talking point

SEARCH STRATEGY for "${idea}":
1. Look for EXACT matches to the talking point concept in the artist info
2. Find specific details, names, venues, years, achievements that support this topic
3. Extract concrete evidence that proves their expertise in this area
4. If no direct match, find the closest related achievement that supports the talking point

RETURN exactly ONE specific, compelling accolade that directly supports "${idea}" as a JSON object with "accolade", "category", and "booking_angle" fields.

Example format:
{"accolade": "Featured on WXYZ Radio's Morning Show 3 times in 2024", "category": "radio_exposure", "booking_angle": "media_validated_talent"}`;

      try {
        const accoladeCompletion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: "user", content: accoladeExtractionPrompt }],
          temperature: 0.3,
        });
        
        const accoladeContent = accoladeCompletion.choices[0].message.content;
        extractedAccolade = JSON.parse(accoladeContent);
      } catch (error) {
        console.error('Single accolade extraction failed:', error);
        // Fallback based on email index
        const fallbackAccolades = [
          {"accolade": "Professional experience and credentials", "category": "experience"},
          {"accolade": "Audience engagement and atmosphere creation", "category": "engagement"},
          {"accolade": "Professional setup and reliability", "category": "professionalism"},
          {"accolade": "Musical repertoire and style versatility", "category": "repertoire"}
        ];
        extractedAccolade = fallbackAccolades[emailIndex - 1] || fallbackAccolades[0];
      }
    }
    
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
      SUBJECT LINE: Create URGENCY WITH CURIOSITY using the artist's specific background - something like "Before you book [genre] music", "The [specific credential] opportunity", "Time-sensitive [style] booking". Make it curiosity-driven and relevant to their unique background.
      EMAIL BODY: Start with "I just wanted to reach out one last time about doing some live music for {{venue}}." Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates". Be professional but create FOMO.
      PROVIDE NEW INFORMATION: Focus specifically on calendar urgency and booking deadlines - information NOT mentioned in previous emails.`;
    } else if (emailIndex === 6) { // 7th email (index 6)
      specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
      CONTENT FOCUS: ${contentFocus[emailIndex]}
      SUBJECT LINE: Create gentle closure with intrigue using their background - something like "One last thing about [genre]", "Before we go - [credential]", "Final note from [years] years". Create curiosity even in goodbye while being personal to them.
      EMAIL BODY: Start with "I wanted to reach out one final time about live music for {{venue}}." Politely acknowledge they haven't responded and you understand they're not interested. Be gracious but make it clear this is the end.
      PROVIDE NEW INFORMATION: This should be a respectful goodbye with understanding tone - completely different from all previous emails.`;
    } else if (emailIndex >= 0 && emailIndex <= 4 && extractedAccolade) { // Emails 1-5 use extracted accolades related to talking points
      specialInstructions = `This is follow-up email #${emailIndex + 1} focused on the talking point: "${idea}"
      
      TALKING POINT FOCUS: "${idea}" - This email must focus ENTIRELY on this specific topic from the user's chosen talking points.
      SPECIFIC ACCOLADE FOCUS: "${extractedAccolade.accolade}" - Use this specific achievement/credential that relates to "${idea}".
      BOOKING ANGLE: "${extractedAccolade.booking_angle}" - Explain why THIS specific accolade related to "${idea}" makes them the perfect choice for booking.
      
      SUBJECT LINE CREATION:
      - Create IRRESISTIBLE CURIOSITY specifically around "${idea}" and the related accolade
      - Use their actual details from the info dump that relate to "${idea}"
      - Examples for different talking points:
        * If "${idea}" is about radio: "The radio story", "What WXYZ taught me", "The airplay secret"
        * If "${idea}" is about festivals: "The [Festival Name] experience", "What festivals taught me"
        * If "${idea}" is about quotes/testimonials: "What venues say", "The feedback story"
        * If "${idea}" is about music style: "The [genre] advantage", "Why [style] works"
      - Make it specific to THEIR background and the talking point "${idea}"
      
      EMAIL BODY REQUIREMENTS:
      - Start with "I just wanted to reach out again about doing some live music for {{venue}}."
      - Focus ENTIRELY on the talking point "${idea}" using the specific accolade "${extractedAccolade.accolade}"
      - Pull specific details from their info dump that support "${idea}"
      - Make this email completely unique to their background and this specific talking point
      - If "${idea}" mentions radio spots, focus on their radio experience, stations, shows, interviews
      - If "${idea}" mentions festivals, focus on specific festivals they've played, dates, audiences
      - If "${idea}" mentions quotes, include actual testimonials or feedback from their background
      - If "${idea}" mentions music style, focus on their specific genres, instruments, repertoire
      
      CRITICAL ANTI-REPETITION RULES:
      - This email must introduce COMPLETELY NEW information about "${idea}" not mentioned in previous emails
      - Do NOT repeat any selling points, phrases, or credentials from other emails in the sequence
      - Focus ONLY on "${idea}" and its unique booking value using their specific background details
      - Make the subject line completely different from all previous subject lines
      - Ensure this email provides a fresh, new reason to book this artist based on "${idea}"
      
      PROVIDE NEW INFORMATION: This email should introduce the talking point "${idea}" with specific evidence from their background and explain why it makes them perfect for the venue.`;
      // Randomly select a disclaimer variation for each follow-up email
      const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
      footerMessage = `\n\n${randomDisclaimer}`;
    } else {
      // Fallback for emails without extracted accolades - still focus on the talking point
      specialInstructions = `This is follow-up email #${emailIndex + 1} focused on the talking point: "${idea}"
      
      TALKING POINT FOCUS: "${idea}" - This email must focus ENTIRELY on this specific topic from the user's chosen talking points.
      CONTENT FOCUS: ${contentFocus[emailIndex]} - This must be the PRIMARY focus and provide NEW information not covered in previous emails.
      
      SUBJECT LINE CREATION:
      - Create curiosity specifically around the talking point "${idea}"
      - Use specific details from their background that relate to "${idea}"
      - Examples for different talking points:
        * If "${idea}" is about radio: "The radio connection", "Your airplay opportunity"
        * If "${idea}" is about festivals: "The festival experience", "What crowds taught me"
        * If "${idea}" is about quotes/testimonials: "What people say", "The venue feedback"
        * If "${idea}" is about music style: "The [genre] you need", "Why [style] works"
      - Make it specific to their actual background and the talking point "${idea}"
      
      EMAIL BODY REQUIREMENTS:
      - Start with "I just wanted to reach out again about doing some live music for {{venue}}."
      - Focus ENTIRELY on the talking point "${idea}" using details from their info dump
      - Pull specific information that supports "${idea}" from their background
      - Make this email completely unique to their background and this specific talking point
      - If "${idea}" mentions radio, focus on any radio-related experience or potential
      - If "${idea}" mentions festivals, focus on festival experience or festival-style performance ability
      - If "${idea}" mentions quotes, focus on testimonials, reviews, or feedback they've received
      - If "${idea}" mentions music style, focus on their specific genres, instruments, or musical approach
      
      PROVIDE NEW INFORMATION: Each email must introduce fresh angles and benefits related to "${idea}". Make sure to provide specific details and value propositions from their unique background that support this talking point.`;
      // Randomly select a disclaimer variation for each follow-up email
      const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
      footerMessage = `\n\n${randomDisclaimer}`;
    }
    
    // Build availability instruction based on filtered dates
    const availabilityInstruction = hasValidDates && filteredAvailability 
      ? `MANDATORY AVAILABILITY: Include these specific dates in the email body (after pitch, before signature): "${filteredAvailability}". Frame professionally like "I have ${filteredAvailability} that could work well" or "These dates are available: ${filteredAvailability}".`
      : `AVAILABILITY NOTE: Artist's original dates have passed by the time this email sends. Do NOT mention any specific dates. Only ask about venue's available dates.`;
    
    const prompt = `${PREAMBLE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${idea}

${availabilityInstruction}

CRITICAL REQUIREMENTS:
1. Greeting: Use exactly "${getGreetingForIndex(emailIndex + 1)} {{firstname}}" (NO COMMA EVER)
2. FIRST PARAGRAPH ONLY: Use {{venue}} merge tag exactly once in the opening sentence
3. Include 2-3 paragraphs of compelling content focused ENTIRELY on "${idea}" - make it WILDLY different from other emails
4. Include the video link naturally in the content
5. End with a strong call-to-action question related to "${idea}"
6. Add the opt-out message if required
7. Include the signature and contact info
8. Add the unsubscribe footer with proper spacing

TALKING POINT EXAMPLES:
- If "${idea}" = "radio spots" → Focus on radio play, stations, interviews, airtime from their background
- If "${idea}" = "Past Festival Appearances" → Focus on specific festivals, dates, crowds from their background  
- If "${idea}" = "quotes from ppl" → Focus on testimonials, reviews, feedback from their background
- If "${idea}" = "the kind of music he plays" → Focus on genres, style, instruments from their background
- If "${idea}" = "Zach's Genre Blend" → Focus on their unique musical style mixing from their background

VIDEO LINK DISTRIBUTION: This is email #${emailIndex + 1} using video link #${linkIndex + 1} of ${videoLinks.length}

${specialInstructions}

${footerMessage ? `MANDATORY DISCLAIMER PLACEMENT: Add this exact message on its own line BEFORE the signature block: "${footerMessage}"` : ''}`;
    
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
app.post('/ai/regenerate-followup-email', async (req, res) => {
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
      CONTENT FOCUS: ${contentFocus[emailIndex]}`;
    } else if (emailIndex === 6) { // 7th email - "Final goodbye"
      specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
      CONTENT FOCUS: ${contentFocus[emailIndex]}`;
    } else {
      specialInstructions = `This is follow-up email #${emailIndex + 1}. 
      CONTENT FOCUS: ${contentFocus[emailIndex]}`;
    }

    const prompt = `${PREAMBLE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${idea}

CRITICAL REQUIREMENTS:
1. Greeting: Use exactly "${getGreetingForIndex(emailIndex + 1)} {{firstname}}" (NO COMMA EVER)
2. FIRST PARAGRAPH ONLY: Use {{venue}} merge tag exactly once in the opening sentence
3. Include 2-3 paragraphs of compelling content focused on the concept - make it WILDLY different from other emails
4. Include the video link naturally in the content
5. End with a strong call-to-action question
6. Add the opt-out message if required
7. Include the signature and contact info
8. Add the unsubscribe footer with proper spacing

VIDEO LINK DISTRIBUTION: This is email #${emailIndex + 1} using video link #${linkIndex + 1} of ${videoLinks.length}

REGENERATION REQUIREMENT: Make this version WILDLY DIFFERENT from the original.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9, // Very high temperature for maximum variety
    });

    const content = completion.choices[0].message.content;
    const parts = content.split('\n\n');
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const email = parts.slice(1).join('\n\n');
    const finalEmail = appendFooter(email);
    
    res.json({ subject, email: finalEmail });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate email' });
  }
});

/**
 * Serve static files and specific routes
 */
app.get('/ai/followup-ideas.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'followup-ideas.html'));
});

app.get('/ai/followup-email.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'followup-email.html'));
});

/**
 * Serve the main application page
 * @route GET /
 */
app.get('/ai/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});