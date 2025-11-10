# Developer Integration Guide

**A comprehensive guide for integrating the Musician Pitch Email Generator into existing systems.**

---

## 📋 Table of Contents

1. [Integration Overview](#integration-overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [API Integration](#api-integration)
4. [Database Integration](#database-integration)
5. [Email Service Provider Integration](#email-service-provider-integration)
6. [Authentication & Security](#authentication--security)
7. [Customization Options](#customization-options)
8. [Testing & Debugging](#testing--debugging)
9. [Production Considerations](#production-considerations)
10. [Common Integration Patterns](#common-integration-patterns)

---

## 🎯 Integration Overview

### What This System Does

This is a **backend API service** that generates personalized email content using OpenAI's GPT-4. It's designed to be:
- **Stateless** - No database required (can be added)
- **API-first** - All functionality exposed via REST endpoints
- **Embeddable** - Can be integrated into existing applications
- **Extensible** - Easy to customize and extend

### Integration Approaches

#### Option 1: Standalone Service (Microservice Architecture)
```
[Your App] ←→ HTTP/REST ←→ [Email Generator Service]
                                    ↓
                              [OpenAI API]
```

- Run this as a separate service
- Call via HTTP REST API
- Easiest to integrate
- **Recommended for quick integration**

#### Option 2: Embedded (Monolithic)
```
[Your App Code]
    ├── Your Existing Modules
    └── Email Generator Module (imported)
            ↓
      [OpenAI API]
```

- Import the code directly into your app
- Use functions directly (no HTTP overhead)
- Requires Node.js backend
- Best for Node.js applications

#### Option 3: Serverless (AWS Lambda / Cloud Functions)
```
[Your App] → [API Gateway] → [Lambda Function] → [OpenAI API]
```

- Deploy endpoints as serverless functions
- Auto-scaling, pay-per-use
- Best for variable/unpredictable traffic

---

## 🏗️ Architecture Deep Dive

### File Responsibilities

| File | Purpose | Integration Points |
|------|---------|-------------------|
| **index.js** | Main Express server, API endpoints | Replace with your web framework |
| **emailGenerator.js** | Prompt building, OpenAI calls | Core logic - reusable |
| **dateUtils.js** | Date parsing & filtering | Utility - reusable anywhere |
| **constants.js** | Email templates, prompts | Customize for your brand |
| **public/\*.html** | Frontend UI | Replace with your UI |

### Key Functions to Understand

#### 1. Email Generation Flow

```javascript
// High-level flow in index.js
app.post('/generate-email', async (req, res) => {
  // 1. Receive user input
  const { infoDump, videoLinks, emailStyle, signatureBlock, availability, currentDate } = req.body;
  
  // 2. Build AI prompt (emailGenerator.js)
  const prompt = generateEmailPrompt(req.body);
  
  // 3. Call OpenAI API (emailGenerator.js)
  const completion = await callOpenAI(openai, prompt);
  
  // 4. Extract subject & body from response
  const content = completion.choices[0].message.content;
  const parts = content.split('\n\n');
  const subject = parts[0].replace('SUBJECT:', '').trim();
  const email = parts.slice(1).join('\n\n');
  
  // 5. Add unsubscribe footer
  const finalEmail = appendFooter(email);
  
  // 6. Return to client
  res.json({ subject, email: finalEmail });
});
```

#### 2. Date Filtering (v5.0 Feature)

```javascript
// dateUtils.js - filters dates based on when email will send
const { hasValidDates, filteredAvailability } = filterAvailabilityByDate(
  'November 9-26th',  // User's availability input
  7,                   // Days until this email sends
  new Date().toISOString() // Current date
);

// Returns:
// hasValidDates: true/false
// filteredAvailability: "November 9-26" or "" (if expired)
```

#### 3. Dynamic Prompt Building

```javascript
// The system builds detailed prompts with:
const prompt = `
  ${EMAIL_TEMPLATE}  // 400+ line master template
  
  INPUTS:
  Artist Messaging: ${infoDump}
  Video Links: ${videoLinks}
  Availability: ${filteredAvailability}
  
  ${specialInstructions}  // Email-specific rules
`;
```

---

## 🔌 API Integration

### Making API Calls from Your Application

#### Example: Generate Initial Email

```javascript
// From your application code
const response = await fetch('http://your-email-generator-service:3000/generate-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Add authentication headers here
  },
  body: JSON.stringify({
    infoDump: "Jazz pianist with 15 years experience...",
    videoLinks: [
      "https://youtube.com/watch?v=...",
      "https://youtube.com/watch?v=...",
      "https://youtube.com/watch?v=..."
    ],
    emailStyle: "Professional but friendly",
    signatureBlock: "John Doe\n555-123-4567\njohn@example.com",
    availability: "November 9-26th",
    currentDate: new Date().toISOString()
  })
});

const { subject, email } = await response.json();

// Now you have the generated email content
console.log('Subject:', subject);
console.log('Email Body:', email);
```

#### Example: Generate Follow-Up Sequence

```javascript
const response = await fetch('http://your-service:3000/generate-followup-sequence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    infoDump: "Jazz pianist...",
    videoLinks: ["url1", "url2", "url3"],
    emailStyle: "Professional but friendly",
    signatureBlock: "John Doe\n...",
    ideas: [
      "Past Festival Appearances",
      "Radio spots",
      "Quotes from venue owners",
      "Musical versatility",
      "Technical setup expertise",
      "Last chance for live music",
      "Final goodbye"
    ],
    availability: "November 9-26th",
    currentDate: new Date().toISOString()
  })
});

const { sequence } = await response.json();

// sequence is an array of 7 emails:
sequence.forEach((email, index) => {
  console.log(`Email #${index + 1}`);
  console.log('Wait Days:', email.waitDays);
  console.log('Subject:', email.subject);
  console.log('Body:', email.email);
});
```

### Error Handling

```javascript
try {
  const response = await fetch('http://your-service:3000/generate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Email generation failed');
  }
  
  const { subject, email } = await response.json();
  
} catch (error) {
  console.error('Email generation error:', error.message);
  // Handle error (show user-friendly message, retry, etc.)
}
```

---

## 💾 Database Integration

The system is currently stateless. Here's how to add database persistence:

### Tables to Create

#### 1. `musicians` Table
```sql
CREATE TABLE musicians (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  info_dump TEXT NOT NULL,
  email_style VARCHAR(255),
  signature_block TEXT,
  availability TEXT,
  video_link_1 VARCHAR(500),
  video_link_2 VARCHAR(500),
  video_link_3 VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `generated_emails` Table
```sql
CREATE TABLE generated_emails (
  id SERIAL PRIMARY KEY,
  musician_id INT REFERENCES musicians(id),
  email_type VARCHAR(50), -- 'initial' or 'followup'
  email_index INT, -- NULL for initial, 0-6 for follow-ups
  subject VARCHAR(500),
  body TEXT,
  wait_days INT,
  idea VARCHAR(255), -- For follow-ups
  video_link_used INT, -- Which video was used (0-2)
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  opened_at TIMESTAMP NULL,
  clicked_at TIMESTAMP NULL,
  replied_at TIMESTAMP NULL
);
```

#### 3. `email_campaigns` Table
```sql
CREATE TABLE email_campaigns (
  id SERIAL PRIMARY KEY,
  musician_id INT REFERENCES musicians(id),
  venue_name VARCHAR(255),
  venue_email VARCHAR(255),
  status VARCHAR(50), -- 'draft', 'active', 'paused', 'completed'
  current_email_index INT DEFAULT -1, -- -1 = not started, 0-7 = which email
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TIMESTAMP NULL
);
```

### Code Integration Example

```javascript
// Modified endpoint with database integration
app.post('/generate-email', async (req, res) => {
  try {
    const { userId, infoDump, videoLinks, emailStyle, signatureBlock, availability } = req.body;
    
    // 1. Save or update musician profile in database
    const musician = await db.query(`
      INSERT INTO musicians (user_id, info_dump, email_style, signature_block, availability, video_link_1, video_link_2, video_link_3)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE 
      SET info_dump = $2, email_style = $3, signature_block = $4, availability = $5, updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [userId, infoDump, emailStyle, signatureBlock, availability, videoLinks[0], videoLinks[1], videoLinks[2]]);
    
    const musicianId = musician.rows[0].id;
    
    // 2. Generate email (existing logic)
    const prompt = generateEmailPrompt(req.body);
    const completion = await callOpenAI(openai, prompt);
    const content = completion.choices[0].message.content;
    const parts = content.split('\n\n');
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const email = parts.slice(1).join('\n\n');
    const finalEmail = appendFooter(email);
    
    // 3. Save generated email to database
    await db.query(`
      INSERT INTO generated_emails (musician_id, email_type, email_index, subject, body, video_link_used)
      VALUES ($1, 'initial', NULL, $2, $3, 0)
    `, [musicianId, subject, finalEmail]);
    
    // 4. Return response
    res.json({ subject, email: finalEmail, musicianId });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📧 Email Service Provider Integration

### Integration with Popular ESPs

#### 1. SendGrid

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// After generating email
const msg = {
  to: 'venue@example.com',
  from: 'musician@example.com',
  subject: subject, // From generated email
  text: email,      // From generated email
  html: email.replace(/\n/g, '<br>'), // Simple HTML conversion
  // Merge tags will be replaced by SendGrid
  substitutions: {
    '{{firstname}}': 'John',
    '{{venue}}': 'Blue Note Jazz Club',
    '{{unsubscribe_link}}': 'https://yourapp.com/unsubscribe?token=...'
  }
};

await sgMail.send(msg);
```

#### 2. Mailchimp

```javascript
const mailchimp = require('@mailchimp/mailchimp_transactional')(process.env.MAILCHIMP_API_KEY);

// After generating email
const message = {
  from_email: 'musician@example.com',
  subject: subject,
  text: email,
  to: [{ email: 'venue@example.com', type: 'to' }],
  merge_vars: [{
    rcpt: 'venue@example.com',
    vars: [
      { name: 'FIRSTNAME', content: 'John' },
      { name: 'VENUE', content: 'Blue Note Jazz Club' }
    ]
  }]
};

await mailchimp.messages.send({ message });
```

#### 3. Custom SMTP

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Replace merge tags manually
let emailBody = email
  .replace(/\{\{firstname\}\}/g, 'John')
  .replace(/\{\{venue\}\}/g, 'Blue Note Jazz Club')
  .replace(/\{\{unsubscribe_link\}\}/g, 'https://yourapp.com/unsubscribe?token=...');

await transporter.sendMail({
  from: '"Musician Name" <musician@example.com>',
  to: 'venue@example.com',
  subject: subject,
  text: emailBody
});
```

### Merge Tag Replacement

```javascript
function replaceMergeTags(emailBody, data) {
  return emailBody
    .replace(/\{\{firstname\}\}/g, data.firstname || '')
    .replace(/\{\{venue\}\}/g, data.venueName || '')
    .replace(/\{\{unsubscribe_link\}\}/g, data.unsubscribeUrl || '');
}

// Usage
const personalizedEmail = replaceMergeTags(generatedEmail, {
  firstname: 'John',
  venueName: 'Blue Note Jazz Club',
  unsubscribeUrl: 'https://yourapp.com/unsubscribe?token=abc123'
});
```

---

## 🔒 Authentication & Security

### Adding API Authentication

```javascript
// Middleware for API key authentication
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Apply to all email generation endpoints
app.post('/generate-email', authenticateApiKey, async (req, res) => {
  // ... existing code
});
```

### JWT Authentication

```javascript
const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

app.post('/generate-email', authenticateJWT, async (req, res) => {
  // req.user contains decoded token data
  // ... existing code
});
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Limit each IP to 10 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests, please try again later'
});

app.post('/generate-email', limiter, async (req, res) => {
  // ... existing code
});
```

---

## 🎨 Customization Options

### 1. Customize Email Templates (constants.js)

```javascript
// constants.js
const EMAIL_TEMPLATE = `You are a helpful AI writing expert...
  
  CUSTOMIZATION POINT: Add your brand voice, specific guidelines, etc.
  
  Example:
  - Always mention our company's music booking platform
  - Include a link to our website in every email
  - Use casual, friendly tone (not too formal)
  
  ...rest of template
`;
```

### 2. Add Custom Merge Tags

```javascript
// In index.js, add new merge tags
const appendFooter = (email, customData) => {
  let finalEmail = email;
  
  // Add custom merge tags
  finalEmail = finalEmail.replace(/\{\{company_name\}\}/g, customData.companyName || '');
  finalEmail = finalEmail.replace(/\{\{booking_link\}\}/g, customData.bookingLink || '');
  
  // Existing footer logic
  return `${finalEmail}\n${'\n'.repeat(200)}${UNSUBSCRIBE_FOOTER}`;
};
```

### 3. Change AI Model or Parameters

```javascript
// constants.js
const GPT_MODEL = "gpt-4o";  // Change to "gpt-4", "gpt-3.5-turbo", etc.
const TEMPERATURE = 0.7;      // 0.0-1.0, higher = more creative

// In emailGenerator.js
async function callOpenAI(openai, prompt) {
  return await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: TEMPERATURE,
    max_tokens: 1500,  // Customize max response length
    top_p: 1.0,        // Nucleus sampling parameter
    frequency_penalty: 0.3,  // Reduce repetition
    presence_penalty: 0.0     // Encourage new topics
  });
}
```

### 4. Add Custom Email Types

```javascript
// Add a new endpoint for a custom email type
app.post('/generate-thank-you-email', async (req, res) => {
  const { venueName, performanceDate, highlights } = req.body;
  
  const customPrompt = `Generate a thank-you email to ${venueName} after performing on ${performanceDate}. 
  
  Highlights from the performance:
  ${highlights}
  
  Make it warm, grateful, and suggest booking again in the future.`;
  
  const completion = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [{ role: "user", content: customPrompt }],
    temperature: 0.7
  });
  
  const content = completion.choices[0].message.content;
  res.json({ email: content });
});
```

---

## 🧪 Testing & Debugging

### Testing API Endpoints

```bash
# Test email generation
curl -X POST http://localhost:3000/generate-email \
  -H "Content-Type: application/json" \
  -d '{
    "infoDump": "Jazz pianist with 15 years experience",
    "videoLinks": ["https://youtube.com/watch?v=example"],
    "emailStyle": "Professional",
    "signatureBlock": "John Doe\n555-123-4567",
    "availability": "November 9-26th",
    "currentDate": "2025-10-28T12:00:00Z"
  }'
```

### Debugging Tips

```javascript
// Add detailed logging
console.log('Received request:', {
  infoDump: req.body.infoDump?.substring(0, 50) + '...',
  videoLinksCount: req.body.videoLinks?.length,
  availability: req.body.availability
});

// Log OpenAI requests (be careful with sensitive data)
console.log('Sending to OpenAI:', {
  model: GPT_MODEL,
  promptLength: prompt.length,
  temperature: TEMPERATURE
});

// Log date filtering results
console.log('Date filtering:', {
  originalAvailability: availability,
  daysUntilSend: waitDays[emailIndex],
  hasValidDates,
  filteredAvailability
});
```

### Testing Date Logic

```javascript
// dateUtils.test.js
const { filterAvailabilityByDate } = require('./dateUtils');

// Test 1: Valid dates
const result1 = filterAvailabilityByDate('November 9-26th', 7, '2025-10-28T00:00:00Z');
console.assert(result1.hasValidDates === true, 'Should have valid dates');
console.assert(result1.filteredAvailability.includes('November'), 'Should include November');

// Test 2: Expired dates
const result2 = filterAvailabilityByDate('November 9-26th', 61, '2025-10-28T00:00:00Z');
console.assert(result2.hasValidDates === false, 'Should have no valid dates');
console.assert(result2.filteredAvailability === '', 'Should return empty string');
```

---

## 🚀 Production Considerations

### 1. Environment Configuration

```javascript
// config.js - centralize configuration
module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.GPT_MODEL || 'gpt-4o',
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7
  },
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },
  security: {
    apiKey: process.env.API_KEY,
    jwtSecret: process.env.JWT_SECRET
  }
};
```

### 2. Error Handling & Monitoring

```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Log to monitoring service (e.g., Sentry)
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});
```

### 3. Caching Strategy

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour

app.post('/generate-email', async (req, res) => {
  // Create cache key from request data
  const cacheKey = JSON.stringify(req.body);
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  // Generate email
  const result = await generateEmail(req.body);
  
  // Store in cache
  cache.set(cacheKey, result);
  
  res.json(result);
});
```

### 4. Cost Management (OpenAI API)

```javascript
// Track token usage
let totalTokensUsed = 0;

const completion = await openai.chat.completions.create({
  model: GPT_MODEL,
  messages: [{ role: "user", content: prompt }],
  temperature: TEMPERATURE
});

totalTokensUsed += completion.usage.total_tokens;
console.log('Tokens used:', completion.usage.total_tokens);
console.log('Total tokens this session:', totalTokensUsed);

// Estimated cost (GPT-4 pricing: $0.03/1K input tokens, $0.06/1K output tokens)
const estimatedCost = (
  (completion.usage.prompt_tokens * 0.03 / 1000) +
  (completion.usage.completion_tokens * 0.06 / 1000)
);
console.log('Estimated cost: $' + estimatedCost.toFixed(4));
```

---

## 🔄 Common Integration Patterns

### Pattern 1: Webhook Integration

```javascript
// Your app sends data to email generator, gets webhook when ready
app.post('/generate-email-async', async (req, res) => {
  const { callbackUrl, ...emailData } = req.body;
  
  // Return immediately
  res.json({ status: 'processing', jobId: 'unique-job-id' });
  
  // Generate email asynchronously
  generateEmail(emailData)
    .then(result => {
      // Send result to callback URL
      fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 'unique-job-id', ...result })
      });
    })
    .catch(error => {
      // Send error to callback URL
      fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 'unique-job-id', error: error.message })
      });
    });
});
```

### Pattern 2: Queue-Based Processing

```javascript
const Bull = require('bull');
const emailQueue = new Bull('email-generation');

// Add job to queue
app.post('/generate-email', async (req, res) => {
  const job = await emailQueue.add(req.body);
  res.json({ jobId: job.id, status: 'queued' });
});

// Process queue
emailQueue.process(async (job) => {
  const result = await generateEmail(job.data);
  return result;
});

// Check job status
app.get('/email-job/:jobId', async (req, res) => {
  const job = await emailQueue.getJob(req.params.jobId);
  const state = await job.getState();
  const result = job.returnvalue;
  
  res.json({ state, result });
});
```

### Pattern 3: GraphQL Integration

```javascript
const { ApolloServer, gql } = require('apollo-server-express');

const typeDefs = gql`
  type Email {
    subject: String!
    body: String!
  }
  
  input EmailInput {
    infoDump: String!
    videoLinks: [String!]!
    emailStyle: String!
    signatureBlock: String!
    availability: String
    currentDate: String!
  }
  
  type Mutation {
    generateEmail(input: EmailInput!): Email!
  }
`;

const resolvers = {
  Mutation: {
    generateEmail: async (_, { input }) => {
      const prompt = generateEmailPrompt(input);
      const completion = await callOpenAI(openai, prompt);
      const content = completion.choices[0].message.content;
      const parts = content.split('\n\n');
      return {
        subject: parts[0].replace('SUBJECT:', '').trim(),
        body: parts.slice(1).join('\n\n')
      };
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
server.applyMiddleware({ app });
```

---

## 📞 Need Help?

### Common Issues

**Issue: "OpenAI API rate limit exceeded"**
- Solution: Implement request queuing or retry logic with exponential backoff

**Issue: "Dates not filtering correctly"**
- Solution: Ensure `currentDate` is passed as ISO string in correct timezone

**Issue: "Merge tags appearing in subject lines"**
- Solution: v5.0 has multiple enforcement layers - this should not happen. Check that you're using latest version.

**Issue: "Emails sound too similar"**
- Solution: Increase temperature (0.8-0.9) or enhance `infoDump` with more unique details

### Getting Support

1. Check the [README.md](README.md) for basic setup
2. Review this guide for integration patterns
3. Check [API_REFERENCE.md](API_REFERENCE.md) for endpoint details
4. Open an issue on GitHub with:
   - System details (Node version, OS, etc.)
   - Code snippet showing the issue
   - Expected vs actual behavior
   - Error messages

---

**Happy Integrating! 🚀**

Last Updated: October 28, 2025  
Version: 5.0.0 (v5.0_date-auto-config)

