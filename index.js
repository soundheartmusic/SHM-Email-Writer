require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
const { DEFAULT_PORT, EMAIL_TEMPLATE, DISCLAIMER_VARIATIONS } = require('./constants');
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
        model: 'gpt-4',
        messages: [{ role: "user", content: accoladeExtractionPrompt }],
        temperature: 0.3, // Lower temperature for more consistent extraction
      });
      
      const accoladeContent = accoladeCompletion.choices[0].message.content;
      extractedAccolades = JSON.parse(accoladeContent);
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
      // Distribute video links evenly: emails 0,1 use link 0; emails 2,3 use link 1; emails 4,5 use link 2; email 6 uses link 0 again
      const linkIndex = Math.floor(i / 2) % videoLinks.length;
      const videoLink = videoLinks[linkIndex] || '';
      
      let specialInstructions = '';
      let footerMessage = '';
      
      if (i === 5) { // 6th email - "Last chance"
        specialInstructions = `This is a "LAST CHANCE" email with professional urgency and scarcity. 
        SUBJECT LINE: Create URGENCY WITH CURIOSITY using the artist's specific background - something like "Before you book [genre] music", "The [specific credential] opportunity", "Time-sensitive [style] booking". Make it curiosity-driven and relevant to their unique background.
        EMAIL BODY: Start with "I just wanted to reach out one last time about doing some live music for {{venue}}." Create urgency with phrases like "we're finalizing our performance calendar", "booking our last few dates". Be professional but create FOMO.`;
      } else if (i === 6) { // 7th email - "Final goodbye"
        specialInstructions = `This is the FINAL GOODBYE email with a polite but clear "we get the message" tone.
        SUBJECT LINE: Create gentle closure with intrigue using their background - something like "One last thing about [genre]", "Before we go - [credential]", "Final note from [years] years". Create curiosity even in goodbye while being personal to them.
        EMAIL BODY: Start with "I wanted to reach out one final time about live music for {{venue}}." Politely acknowledge they haven't responded and you understand they're not interested. Be gracious but make it clear this is the end.`;
      } else if (i >= 1 && i <= 4) { // Emails 2-5 use extracted accolades
        const accoladeIndex = i - 1; // Map email 2-5 to accolade index 0-3
        const currentAccolade = extractedAccolades[accoladeIndex] || extractedAccolades[0];
        
        // Randomly select a disclaimer variation for each follow-up email
        const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
        specialInstructions = `This is follow-up email #${i + 1}. 
        SPECIFIC ACCOLADE FOCUS: "${currentAccolade.accolade}" - This email must focus ENTIRELY on this specific achievement/credential from their background.
        BOOKING ANGLE: "${currentAccolade.booking_angle}" - Explain why THIS specific accolade makes them the perfect choice for booking.
        SUBJECT LINE: Create IRRESISTIBLE CURIOSITY around this specific accolade. Use their actual details - venues, years, genres, achievements, etc. Examples: "The [venue name] story", "What [X years] taught me", "The [genre] secret", "Why [achievement] matters". Make it specific to THEIR background and create a curiosity gap.
        EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." Focus ENTIRELY on the specific accolade "${currentAccolade.accolade}". Use their actual details and make this email completely unique to their background.
        
        CRITICAL ANTI-REPETITION RULES:
        - This email must introduce COMPLETELY NEW information not mentioned in previous emails
        - Do NOT repeat any selling points, phrases, or credentials from other emails in the sequence
        - Focus ONLY on this specific accolade and its unique booking value
        - Make the subject line completely different from all previous subject lines
        - Ensure this email provides a fresh, new reason to book this artist`;
        footerMessage = `\n\n${randomDisclaimer}`;
      } else {
        // Email 1 - general credentials overview using a different accolade
        const email1Accolade = extractedAccolades[4] || extractedAccolades[0]; // Use 5th accolade for email 1
        const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
        specialInstructions = `This is follow-up email #${i + 1}. 
        SPECIFIC ACCOLADE FOCUS: "${email1Accolade.accolade}" - Use this as the primary focus for this first follow-up.
        SUBJECT LINE: Create curiosity around this specific accolade from their background. Use their actual details to create intrigue like "The [specific detail] story", "What [achievement] means", "Why [credential] matters". Make it specific to their actual background and completely different from other subject lines.
        EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." Focus on the specific accolade "${email1Accolade.accolade}" while being completely personalized to their background.
        
        CRITICAL: This must be completely different from emails 2-5 which will focus on different accolades.`;
        footerMessage = `\n\n${randomDisclaimer}`;
      }

      const prompt = `${EMAIL_TEMPLATE}

INPUTS:
Artist Messaging: ${infoDump}
Video Links: ${videoLink}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: Follow-up email - focus on booking discussion

FOLLOW-UP FOCUS: ${ideas[i]}

ANTI-REPETITION MANDATE:
- This email #${i + 1} must introduce COMPLETELY NEW information not used in any other email
- Each email in the sequence must focus on a DIFFERENT accolade/achievement
- NO overlapping content, selling points, or credentials between emails
- Each subject line must be UNIQUE and create different curiosity gaps
- Provide a fresh, new reason to book this artist that hasn't been mentioned before

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

${footerMessage ? `MANDATORY DISCLAIMER PLACEMENT: Add this exact message on its own line BEFORE the signature block: "${footerMessage}"` : ''}`;
      
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
    
    // DYNAMIC ACCOLADE EXTRACTION for single follow-up
    let extractedAccolade = null;
    if (emailIndex >= 1 && emailIndex <= 4) { // Only for emails 2-5
      const accoladeExtractionPrompt = `ANALYZE this artist's information and EXTRACT their most compelling, specific accolade/achievement for follow-up email #${emailIndex + 1}:

ARTIST INFO: ${infoDump}

CRITICAL: This accolade must be COMPLETELY DIFFERENT from what would be used in other emails in the sequence. Each email needs a UNIQUE reason to book this artist.

EMAIL MAPPING STRATEGY:
- Email #2 (index 1): Focus on venue experience or performance history
- Email #3 (index 2): Focus on audience impact or customer retention
- Email #4 (index 3): Focus on technical reliability or professional setup
- Email #5 (index 4): Focus on musical style, repertoire, or unique offerings

For EMAIL #${emailIndex + 1}, extract ONE specific accolade from these categories (choose the most relevant):
- Notable venues performed at (specific names, types, locations)
- Years of experience and career milestones  
- Musical genres, instruments, or unique styles
- Awards, recognition, or media coverage
- Audience reactions, testimonials, or repeat bookings
- Technical skills, equipment, or professional setup
- Special performances, tours, or significant events
- Collaborations with other artists or industry professionals
- Educational background or musical training
- Customer/audience impact stories
- Professional reliability and business aspects
- Repertoire breadth and adaptability

RETURN exactly ONE specific, compelling accolade as a JSON object with "accolade", "category", and "booking_angle" fields.

Example format:
{"accolade": "Performed at Blue Note Jazz Club for 3 years", "category": "venue_experience", "booking_angle": "proven_venue_success"}`;

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
    } else if (emailIndex >= 1 && emailIndex <= 4 && extractedAccolade) { // Emails 2-5 use extracted accolades
      specialInstructions = `This is follow-up email #${emailIndex + 1}. 
      SPECIFIC ACCOLADE FOCUS: "${extractedAccolade.accolade}" - This email must focus ENTIRELY on this specific achievement/credential from their background.
      BOOKING ANGLE: "${extractedAccolade.booking_angle}" - Explain why THIS specific accolade makes them the perfect choice for booking.
      SUBJECT LINE: Create IRRESISTIBLE CURIOSITY around this specific accolade. Use their actual details - venues, years, genres, achievements, etc. Examples: "The [venue name] story", "What [X years] taught me", "The [genre] secret", "Why [achievement] matters". Make it specific to THEIR background and create a curiosity gap.
      EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." Focus ENTIRELY on the specific accolade "${extractedAccolade.accolade}". Use their actual details and make this email completely unique to their background.
      
      CRITICAL ANTI-REPETITION RULES:
      - This email must introduce COMPLETELY NEW information not mentioned in previous emails
      - Do NOT repeat any selling points, phrases, or credentials from other emails in the sequence
      - Focus ONLY on this specific accolade and its unique booking value
      - Make the subject line completely different from all previous subject lines
      - Ensure this email provides a fresh, new reason to book this artist
      PROVIDE NEW INFORMATION: This email should introduce this specific accolade and explain why it makes them perfect for the venue.`;
      // Randomly select a disclaimer variation for each follow-up email
      const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
      footerMessage = `\n\n${randomDisclaimer}`;
    } else {
      // Email 1 or fallback
      specialInstructions = `This is follow-up email #${emailIndex + 1}. 
      CONTENT FOCUS: ${contentFocus[emailIndex]} - This must be the PRIMARY focus and provide NEW information not covered in previous emails.
      SUBJECT LINE: Create curiosity around their overall credentials and experience. Use specific details from their background to create intrigue like "The [genre] professional you need", "What [years] years brings", "[Venue type] veteran available". Make it specific to their actual background.
      EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." Focus on their overall credentials and experience while being completely personalized to their background.
      PROVIDE NEW INFORMATION: Each email must introduce fresh angles and benefits. Make sure to provide specific details and value propositions related to their unique background.`;
      // Randomly select a disclaimer variation for each follow-up email
      const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
      footerMessage = `\n\n${randomDisclaimer}`;
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
      SUBJECT LINE: Use professional, venue-appropriate psychology like "Live music this weekend?", "A+ Singer for you", "Have you given up?", "Pro Live Band", "Quick question"
      EMAIL BODY: Start with "I just wanted to reach out again about doing some live music for {{venue}}." 
      CRITICAL: Make this email COMPLETELY different from previous ones by focusing specifically on ${contentFocus[emailIndex]}. Do NOT repeat selling points from other emails.
      PROVIDE NEW INFORMATION: Each email must introduce fresh angles and benefits. If this is about ${contentFocus[emailIndex]}, make sure to provide specific details and value propositions related to this focus area only.`;
      // Randomly select a disclaimer variation for each follow-up email
      const randomDisclaimer = DISCLAIMER_VARIATIONS[Math.floor(Math.random() * DISCLAIMER_VARIATIONS.length)];
      footerMessage = `\n\n${randomDisclaimer}`;
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

${footerMessage ? `MANDATORY DISCLAIMER PLACEMENT: Add this exact message on its own line BEFORE the signature block: "${footerMessage}"` : ''}`;

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