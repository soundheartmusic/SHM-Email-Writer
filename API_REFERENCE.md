# API Reference

**Complete documentation of all REST API endpoints for the Musician Pitch Email Generator.**

Version: 5.0.0 (v5.0_date-auto-config)

---

## 📋 Table of Contents

1. [Base URL](#base-url)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [Generate Initial Email](#1-generate-initial-email)
   - [Generate Follow-Up Ideas](#2-generate-follow-up-ideas)
   - [Generate Follow-Up Sequence](#3-generate-follow-up-sequence)
   - [Generate Single Follow-Up](#4-generate-single-follow-up)
   - [Regenerate Follow-Up Email](#5-regenerate-follow-up-email)
4. [Common Request Parameters](#common-request-parameters)
5. [Response Formats](#response-formats)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)

---

## 🌐 Base URL

```
http://localhost:3000
```

For production, replace with your deployed URL.

---

## 🔒 Authentication

Currently, the API does not require authentication. For production use, add:
- API Key authentication (recommended)
- JWT tokens
- OAuth 2.0

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md#authentication--security) for implementation details.

---

## 📡 Endpoints

### 1. Generate Initial Email

Generate the first pitch email to a venue.

#### Endpoint
```
POST /generate-email
```

#### Request Headers
```
Content-Type: application/json
```

#### Request Body

```json
{
  "infoDump": "Jazz pianist with 15 years of professional experience...",
  "videoLinks": [
    "https://youtube.com/watch?v=example1",
    "https://youtube.com/watch?v=example2",
    "https://youtube.com/watch?v=example3"
  ],
  "emailStyle": "Professional but friendly",
  "signatureBlock": "John Doe\n555-123-4567\njohn@jazzpianist.com\nwww.johndo ejazz.com",
  "availability": "November 9-26th"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `infoDump` | string | Yes | Detailed information about the musician (background, experience, style, achievements, etc.) |
| `videoLinks` | array | Yes | 1-3 performance video URLs |
| `emailStyle` | string | Yes | Desired tone/personality (e.g., "Professional", "Casual", "Friendly", "Corporate") |
| `signatureBlock` | string | Yes | Contact information (name, phone, email, website) |
| `availability` | string | Yes | Availability dates (e.g., "November 9-26th", "OPEN", specific date ranges) |
| `currentDate` | string | No | ISO 8601 date string. Auto-captured by frontend. Used for date filtering in v5.0 |

#### Response

**Status**: 200 OK

```json
{
  "subject": "Jazz expertise nearby?",
  "email": "Hi {{firstname}}\n\nI just wanted to reach out about bringing some live music for {{venue}}...\n\n[email body continues]\n\nJohn Doe\n555-123-4567\njohn@jazzpianist.com\n\n\n\n[200 blank lines]\n\nRemove future contact here\n{{unsubscribe_link}}"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Generated subject line (2-5 words, NO merge tags) |
| `email` | string | Complete email body with merge tags, signature, and unsubscribe footer |

#### Example cURL

```bash
curl -X POST http://localhost:3000/generate-email \
  -H "Content-Type: application/json" \
  -d '{
    "infoDump": "Jazz pianist with 15 years professional experience...",
    "videoLinks": ["https://youtube.com/watch?v=example1"],
    "emailStyle": "Professional but friendly",
    "signatureBlock": "John Doe\n555-123-4567\njohn@jazzpianist.com",
    "availability": "November 9-26th"
  }'
```

---

### 2. Generate Follow-Up Ideas

Generate 7 follow-up email concept ideas based on the musician's information.

#### Endpoint
```
POST /generate-followup-ideas
```

#### Request Body

```json
{
  "infoDump": "Jazz pianist with 15 years of professional experience..."
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `infoDump` | string | Yes | Musician's detailed information (same as used in initial email) |

#### Response

**Status**: 200 OK

```json
{
  "ideas": [
    "Past Festival Appearances",
    "Radio spots",
    "Quotes from venue owners",
    "Musical versatility",
    "Technical setup expertise",
    "Last chance for live music",
    "Final goodbye"
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ideas` | array | Array of 7 short concept phrases (2-4 words each). Last 2 are always "Last chance" and "Final goodbye" |

#### Notes

- The AI analyzes the `infoDump` and extracts 5 unique concepts
- Last 2 concepts are always "Last chance for music" and "Final goodbye"
- These ideas are used as talking points for the follow-up sequence

---

### 3. Generate Follow-Up Sequence

Generate a complete sequence of 7 follow-up emails all at once.

#### Endpoint
```
POST /generate-followup-sequence
```

#### Request Body

```json
{
  "infoDump": "Jazz pianist with 15 years experience...",
  "videoLinks": [
    "https://youtube.com/watch?v=example1",
    "https://youtube.com/watch?v=example2",
    "https://youtube.com/watch?v=example3"
  ],
  "emailStyle": "Professional but friendly",
  "signatureBlock": "John Doe\n555-123-4567\njohn@jazzpianist.com",
  "ideas": [
    "Past Festival Appearances",
    "Radio spots",
    "Quotes from venue owners",
    "Musical versatility",
    "Technical setup expertise",
    "Last chance for live music",
    "Final goodbye"
  ],
  "availability": "November 9-26th",
  "currentDate": "2025-10-28T12:00:00Z"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `infoDump` | string | Yes | Musician's detailed information |
| `videoLinks` | array | Yes | 1-3 performance video URLs |
| `emailStyle` | string | Yes | Desired email tone/personality |
| `signatureBlock` | string | Yes | Contact information |
| `ideas` | array | Yes | Array of 7 follow-up concepts from `/generate-followup-ideas` |
| `availability` | string | Yes | Availability dates |
| `currentDate` | string | No | ISO 8601 date string for date filtering (v5.0) |

#### Response

**Status**: 200 OK

```json
{
  "sequence": [
    {
      "subject": "The festival story",
      "email": "Hello {{firstname}}\n\nI just wanted to reach out again...\n\n[full email body]\n\nJohn Doe\n...\n{{unsubscribe_link}}",
      "waitDays": 7,
      "idea": "Past Festival Appearances",
      "videoLinkUsed": 0
    },
    {
      "subject": "The radio connection",
      "email": "Hi there {{firstname}}\n\n...",
      "waitDays": 14,
      "idea": "Radio spots",
      "videoLinkUsed": 0
    },
    // ... 5 more emails
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `sequence` | array | Array of 7 email objects |
| `sequence[].subject` | string | Email subject line |
| `sequence[].email` | string | Complete email body |
| `sequence[].waitDays` | number | Days to wait before sending this email (7, 14, 21, 31, 41, 51, 61) |
| `sequence[].idea` | string | The talking point/concept this email focuses on |
| `sequence[].videoLinkUsed` | number | Index of video link used in this email (0-2) |

#### Notes

- Emails are sent: Day 7, 14, 21, 31, 41, 51, 61 after initial email
- Each email focuses on a different talking point from `ideas`
- Video links rotate: emails 0-1 use link 0, emails 2-3 use link 1, etc.
- **v5.0**: Availability dates are automatically filtered for each email's send date

---

### 4. Generate Single Follow-Up

Generate one follow-up email at a time (one-by-one approach).

#### Endpoint
```
POST /generate-single-followup
```

#### Request Body

```json
{
  "infoDump": "Jazz pianist with 15 years experience...",
  "videoLinks": [
    "https://youtube.com/watch?v=example1",
    "https://youtube.com/watch?v=example2",
    "https://youtube.com/watch?v=example3"
  ],
  "emailStyle": "Professional but friendly",
  "signatureBlock": "John Doe\n555-123-4567\njohn@jazzpianist.com",
  "idea": "Past Festival Appearances",
  "emailIndex": 0,
  "fromName": "John Doe",
  "availability": "November 9-26th",
  "currentDate": "2025-10-28T12:00:00Z"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `infoDump` | string | Yes | Musician's detailed information |
| `videoLinks` | array | Yes | 1-3 performance video URLs |
| `emailStyle` | string | Yes | Desired email tone/personality |
| `signatureBlock` | string | Yes | Contact information |
| `idea` | string | Yes | The talking point for this specific email |
| `emailIndex` | number | Yes | Which email in sequence (0-6). 0 = first follow-up, 6 = final goodbye |
| `fromName` | string | Yes | Musician's name extracted from signature |
| `availability` | string | Yes | Availability dates |
| `currentDate` | string | No | ISO 8601 date string for date filtering (v5.0) |

#### Response

**Status**: 200 OK

```json
{
  "subject": "The festival story",
  "email": "Hello {{firstname}}\n\nI just wanted to reach out again about doing some live music for {{venue}}...\n\n[email body]\n\nJohn Doe\n555-123-4567\n\n{{unsubscribe_link}}",
  "waitDays": 7,
  "idea": "Past Festival Appearances",
  "fromName": "John Doe",
  "videoLinkUsed": 0
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Email subject line |
| `email` | string | Complete email body with merge tags |
| `waitDays` | number | Days to wait before sending (7, 14, 21, 31, 41, 51, or 61) |
| `idea` | string | The talking point this email focused on |
| `fromName` | string | Musician's name |
| `videoLinkUsed` | number | Index of video link used (0-2) |

#### Notes

- Use this endpoint for one-by-one email generation (user reviews each before generating next)
- `emailIndex` 0-4: Regular follow-ups focused on specific talking points
- `emailIndex` 5: "Last chance" email with urgency
- `emailIndex` 6: "Final goodbye" email with gracious closure
- **v5.0**: Dates automatically filtered based on `emailIndex` send schedule

---

### 5. Regenerate Follow-Up Email

Regenerate a follow-up email with maximum variety (if user doesn't like first version).

#### Endpoint
```
POST /regenerate-followup-email
```

#### Request Body

```json
{
  "infoDump": "Jazz pianist with 15 years experience...",
  "videoLinks": [
    "https://youtube.com/watch?v=example1",
    "https://youtube.com/watch?v=example2",
    "https://youtube.com/watch?v=example3"
  ],
  "emailStyle": "Professional but friendly",
  "signatureBlock": "John Doe\n555-123-4567\njohn@jazzpianist.com",
  "idea": "Past Festival Appearances",
  "emailIndex": 0
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `infoDump` | string | Yes | Musician's detailed information |
| `videoLinks` | array | Yes | 1-3 performance video URLs |
| `emailStyle` | string | Yes | Desired email tone/personality |
| `signatureBlock` | string | Yes | Contact information |
| `idea` | string | Yes | The talking point for this email |
| `emailIndex` | number | Yes | Which email in sequence (0-6) |

#### Response

**Status**: 200 OK

```json
{
  "subject": "What festivals taught me",
  "email": "Hi there {{firstname}}\n\n...\n\nJohn Doe\n...\n{{unsubscribe_link}}"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Regenerated subject line (WILDLY different from first version) |
| `email` | string | Regenerated email body with maximum variety |

#### Notes

- Uses temperature 0.9 (vs 0.8 for regular generation) for maximum variety
- Generates completely different approach while maintaining same talking point
- Use when user wants alternative version of an email

---

## 🔄 Common Request Parameters

### infoDump (string)

Detailed information about the musician. Should include:

- **Background**: Years of experience, musical training, career highlights
- **Musical Style**: Genres, instruments, vocal style
- **Notable Achievements**: Awards, recognitions, media coverage
- **Performance Experience**: Venues performed at, types of events
- **Technical Details**: Equipment, setup requirements
- **Unique Selling Points**: What makes them different/special
- **Testimonials**: Quotes from previous clients/venues (if available)

**Example**:
```
"Jazz pianist with 15 years of professional performance experience. Graduated from Berklee College of Music. Performed at Blue Note Jazz Club for 3 years as house pianist. Specializes in smooth jazz, bossa nova, and acoustic covers. Featured in Jazz Times Magazine as 'Artist to Watch 2023'. Repertoire of 200+ songs. Professional sound equipment with seamless setup. Customers consistently stay 2+ hours longer during performances."
```

### videoLinks (array)

1-3 URLs to performance videos (YouTube, Vimeo, etc.)

- Videos are distributed across the email sequence
- Emails 0-1 use first link, emails 2-3 use second link, emails 4-5 use third link, email 6 loops back to first
- Each email includes only ONE video link naturally in the content

### emailStyle (string)

Desired tone and personality for the emails. Examples:

- `"Professional"` - Formal, polished, business-like
- `"Casual"` - Relaxed, conversational, friendly
- `"Friendly but professional"` - Balanced approach
- `"Energetic and enthusiastic"` - Upbeat, exciting
- `"Humble and grateful"` - Modest, appreciative
- `"Confident but not arrogant"` - Self-assured but respectful

### availability (string) - v5.0 Feature

Availability dates in natural language format:

**Supported Formats**:
- `"November 9-26th"` - Date range
- `"Dec 1-15"` - Abbreviated month
- `"January 5-12"` - Single date range
- `"OPEN"` - No specific dates (system will ask venue for their dates)

**v5.0 Behavior**:
- System automatically filters dates based on follow-up send schedule
- If dates expire before email sends, email only asks about venue's availability
- Frontend automatically captures user's current date/time for filtering

### currentDate (string) - v5.0 Feature

ISO 8601 date string representing user's current date/time.

**Format**: `"2025-10-28T12:00:00Z"`

**Notes**:
- Automatically captured by frontend via `new Date().toISOString()`
- Used for intelligent date filtering
- Respects user's timezone automatically
- Optional parameter (defaults to server time if not provided)

---

## ✅ Response Formats

### Success Response

All successful requests return JSON with HTTP status 200.

```json
{
  "subject": "string",
  "email": "string",
  // ... additional fields depending on endpoint
}
```

### Merge Tags in Responses

Generated emails include merge tags that should be replaced before sending:

| Merge Tag | Description | Example Replacement |
|-----------|-------------|-------------------|
| `{{firstname}}` | Recipient's first name | "John" |
| `{{venue}}` | Venue/establishment name | "Blue Note Jazz Club" |
| `{{unsubscribe_link}}` | Unsubscribe URL | "https://yourapp.com/unsubscribe?token=xyz" |

**Important**:
- Subject lines NEVER contain merge tags (enforced in v5.0)
- Email body uses merge tags in salutation and first paragraph only
- `{{venue}}` appears only once in first paragraph, never in subject line

---

## ❌ Error Handling

### Error Response Format

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 400 | Bad Request | Missing required parameters, invalid format |
| 401 | Unauthorized | Invalid/missing API key (if authentication enabled) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | OpenAI API error, server error |
| 503 | Service Unavailable | OpenAI API down, server overloaded |

### Example Error Responses

**Missing Required Field**:
```json
{
  "error": "Missing required field: infoDump"
}
```

**OpenAI API Error**:
```json
{
  "error": "Failed to generate email: OpenAI API rate limit exceeded"
}
```

**Invalid Date Format**:
```json
{
  "error": "Invalid date format in availability field"
}
```

---

## ⏱️ Rate Limits

Currently no rate limits are enforced. For production, consider:

- **Per IP**: 10 requests per minute
- **Per API Key**: 100 requests per hour
- **Global**: 1000 requests per hour

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md#rate-limiting) for implementation.

---

## 🔍 Example Workflows

### Workflow 1: Generate Initial Email Only

```javascript
// 1. Generate initial pitch email
const response = await fetch('http://localhost:3000/generate-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    infoDump: "Jazz pianist with 15 years...",
    videoLinks: ["https://youtube.com/..."],
    emailStyle: "Professional",
    signatureBlock: "John Doe\n555-123-4567",
    availability: "November 9-26th"
  })
});

const { subject, email } = await response.json();

// 2. Replace merge tags
const personalizedEmail = email
  .replace(/\{\{firstname\}\}/g, 'Michael')
  .replace(/\{\{venue\}\}/g, 'Blue Note Jazz Club')
  .replace(/\{\{unsubscribe_link\}\}/g, 'https://app.com/unsub?id=123');

// 3. Send via your email service
await sendEmail({
  to: 'venue@example.com',
  subject: subject,
  body: personalizedEmail
});
```

### Workflow 2: Complete 8-Email Sequence

```javascript
// 1. Generate initial email
const initialResponse = await fetch('http://localhost:3000/generate-email', { /* ... */ });
const initialEmail = await initialResponse.json();

// 2. Generate follow-up ideas
const ideasResponse = await fetch('http://localhost:3000/generate-followup-ideas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ infoDump: "Jazz pianist..." })
});
const { ideas } = await ideasResponse.json();

// 3. Generate all 7 follow-ups
const sequenceResponse = await fetch('http://localhost:3000/generate-followup-sequence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    infoDump: "Jazz pianist...",
    videoLinks: ["..."],
    emailStyle: "Professional",
    signatureBlock: "John Doe\n...",
    ideas: ideas,
    availability: "November 9-26th",
    currentDate: new Date().toISOString()
  })
});
const { sequence } = await sequenceResponse.json();

// 4. Schedule all emails
// Initial email - send immediately
scheduleEmail(initialEmail, 0);

// Follow-ups - schedule based on waitDays
sequence.forEach((email, index) => {
  scheduleEmail(email, email.waitDays);
});
```

### Workflow 3: One-by-One Review

```javascript
// 1. Generate initial email
const initialEmail = await generateInitialEmail();
await userReviewAndApprove(initialEmail);

// 2. Generate follow-up ideas
const { ideas } = await generateFollowUpIdeas();
const editedIdeas = await userEditIdeas(ideas);

// 3. Generate and review each follow-up one by one
for (let i = 0; i < 7; i++) {
  const followUpResponse = await fetch('http://localhost:3000/generate-single-followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      infoDump: "Jazz pianist...",
      videoLinks: ["..."],
      emailStyle: "Professional",
      signatureBlock: "John Doe\n...",
      idea: editedIdeas[i],
      emailIndex: i,
      fromName: "John Doe",
      availability: "November 9-26th",
      currentDate: new Date().toISOString()
    })
  });
  
  const followUp = await followUpResponse.json();
  
  // User reviews and can regenerate if needed
  if (!await userApproves(followUp)) {
    followUp = await regenerateFollowUp(followUp);
  }
  
  saveFollowUp(followUp, i);
}
```

---

## 📝 Notes

### Subject Line Rules (v5.0 Enhanced)

- **Length**: 2-5 words maximum
- **Merge Tags**: NEVER included in subject lines (multiple enforcement layers)
- **Personalization**: Uses actual details from artist's info (genres, achievements, etc.)
- **Uniqueness**: Every subject line is completely different (anti-spam)
- **Curiosity**: Designed to create "curiosity gaps" that demand opening

### Date Intelligence (v5.0 New Feature)

- Automatically captures user's timezone from browser
- Filters availability dates for each follow-up's send date
- Adjusts date ranges when start dates have passed
- Gracefully handles expired dates by only asking venue's availability
- No configuration required - works globally

### Video Link Distribution

- Links rotate evenly across email sequence
- Each email includes only ONE video link
- Distributed as: Emails 0-1 = Link 0, Emails 2-3 = Link 1, Emails 4-5 = Link 2, Email 6 = Link 0
- Links are naturally integrated into email content, not listed separately

---

**Last Updated**: October 28, 2025  
**API Version**: 5.0.0 (v5.0_date-auto-config)  
**Base URL**: `http://localhost:3000` (change for production)

