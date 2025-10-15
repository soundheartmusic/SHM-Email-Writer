const { GPT_MODEL, TEMPERATURE, EMAIL_TEMPLATE } = require('./constants');

/**
 * Generates an email prompt based on user input
 * @param {Object} userData - The user's input data
 * @param {string} userData.infoDump - Detailed information about the musician
 * @param {string[]} userData.videoLinks - Array of video links
 * @param {string} userData.emailStyle - Preferred email style
 * @param {string} userData.signatureBlock - Contact information
 * @param {string} userData.availability - Availability information
 * @returns {string} The generated prompt
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
 * Calls OpenAI API to generate email content
 * @param {Object} openai - OpenAI client instance
 * @param {string} prompt - The generated prompt
 * @returns {Promise<Object>} OpenAI completion response
 */
async function callOpenAI(openai, prompt) {
  return await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: TEMPERATURE,
  });
}

module.exports = {
  generateEmailPrompt,
  callOpenAI
}; 