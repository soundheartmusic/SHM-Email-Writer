/**
 * ============================================================================
 * EMAIL GENERATOR - PROMPT BUILDING & OPENAI API INTERFACE
 * ============================================================================
 * 
 * This module handles building AI prompts and calling the OpenAI API.
 * 
 * KEY RESPONSIBILITIES:
 * - Build detailed prompts from user input
 * - Extract music keywords from infoDump for subject line generation
 * - Call OpenAI API with proper configuration
 * - Return AI-generated content
 * 
 * PROMPT STRUCTURE:
 * The prompt includes:
 * 1. EMAIL_TEMPLATE (400+ line master template with all rules)
 * 2. User inputs (infoDump, videoLinks, emailStyle, signature, availability)
 * 3. Music keywords extracted from infoDump
 * 4. Critical instructions about video link usage
 * 
 * INTEGRATION:
 * Used by index.js endpoints to generate email content.
 * The actual EMAIL_TEMPLATE lives in constants.js.
 * 
 * See README.md for more details.
 * ============================================================================
 */

const { GPT_MODEL, TEMPERATURE, EMAIL_TEMPLATE } = require('./constants');

/**
 * Generate an AI prompt for the initial pitch email.
 * 
 * This function takes user input and builds a comprehensive prompt that includes:
 * - The master EMAIL_TEMPLATE (400+ lines of instructions)
 * - User's artist information (infoDump)
 * - Performance video links
 * - Desired email style/tone
 * - Contact information (signature)
 * - Availability dates
 * - Extracted music keywords for subject line personalization
 * 
 * The prompt instructs the AI to:
 * - Generate a 2-5 word subject line (NO merge tags)
 * - Write a compelling, personalized email body
 * - Include exactly ONE video link naturally in content
 * - Use merge tags {{venue}}, {{firstname}} appropriately
 * - Add signature and unsubscribe instructions
 * 
 * MUSIC KEYWORD EXTRACTION:
 * Scans infoDump for genre keywords (jazz, blues, rock, etc.) to help AI
 * create more personalized, relevant subject lines.
 * 
 * @param {Object} userData - The user's input data from form
 * @param {string} userData.infoDump - Detailed info about the musician (background, experience, style)
 * @param {string[]} userData.videoLinks - Array of 1-3 performance video URLs
 * @param {string} userData.emailStyle - Preferred email tone (e.g., "Professional", "Casual")
 * @param {string} userData.signatureBlock - Contact information (name, phone, email, website)
 * @param {string} userData.availability - Availability dates (e.g., "November 9-26th", "OPEN")
 * @returns {string} The complete AI prompt ready to send to OpenAI
 */
function generateEmailPrompt(userData) {
  const { infoDump, videoLinks, emailStyle, signatureBlock, availability } = userData;
  
  // Extract music style/genre hints from infoDump for better subject line generation
  const musicKeywords = infoDump.toLowerCase().match(/(?:jazz|blues|rock|folk|classical|acoustic|pop|electronic|latin|country|indie|soul|r&b|hip.?hop|reggae|world|fusion)/g) || [];
  
  // Compact the long template to reduce tokens
  const compactEmailTemplate = EMAIL_TEMPLATE.replace(/\n{3,}/g, '\n');
  
  return `${compactEmailTemplate}

INPUTS:
Artist Messaging: ${infoDump}
Music Keywords: ${musicKeywords.join(', ')}
Video Links: ${videoLinks.join(', ')}
Tone Style: ${emailStyle}
Signature: ${signatureBlock}
Availability: ${availability}

Write a short, effective email in that artist's voice.

CRITICAL LINK USAGE:
- Naturally reference exactly ONE video link in the body with a short lead-in, e.g., "Check out how I sound here: ${videoLinks[0]}", "Quick listen: ${videoLinks[0]}", or "Here’s a recent clip: ${videoLinks[0]}".
- Do not list all links; use only the single best link.
- Place the link inline in a sentence (not on its own line unless it reads naturally).`;
}

/**
 * Call OpenAI API to generate email content.
 * 
 * This function sends the constructed prompt to OpenAI's chat completions API
 * and returns the AI-generated response.
 * 
 * API CONFIGURATION:
 * - Model: GPT_MODEL (default: "gpt-4o")
 * - Temperature: TEMPERATURE (default: 0.7)
 *   Higher temperature (0.7-0.9) = more creative/varied responses
 *   Lower temperature (0.1-0.3) = more focused/consistent responses
 * 
 * RESPONSE FORMAT:
 * The AI returns text in format:
 * "SUBJECT: [subject line here]
 * 
 * [email body here]
 * [continues...]"
 * 
 * TYPICAL RESPONSE TIME: 5-15 seconds
 * 
 * ERROR HANDLING:
 * - API rate limits: Catch and retry with exponential backoff
 * - Invalid API key: Returns error immediately
 * - Timeout: Set timeout in production (not implemented)
 * 
 * COST CONSIDERATIONS:
 * - GPT-4: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
 * - Typical email generation uses 2K-4K tokens total
 * - Estimated cost per email: $0.10-$0.25
 * 
 * INTEGRATION POINTS:
 * - Add retry logic for rate limits
 * - Add timeout handling for production
 * - Log token usage for cost tracking
 * 
 * @param {Object} openai - OpenAI client instance (initialized in index.js)
 * @param {string} prompt - The complete AI prompt with template + user input
 * @returns {Promise<Object>} OpenAI API completion response object
 * @throws {Error} If API call fails (rate limit, invalid key, timeout, etc.)
 */
async function callOpenAI(openai, prompt) {
  return await openai.chat.completions.create({
    model: GPT_MODEL,           // AI model to use (gpt-4o, gpt-4, gpt-3.5-turbo, etc.)
    messages: [{ role: "user", content: prompt }],  // User message with full prompt
    temperature: TEMPERATURE,    // Creativity level (0.0-1.0)
  });
}

module.exports = {
  generateEmailPrompt,
  callOpenAI
}; 