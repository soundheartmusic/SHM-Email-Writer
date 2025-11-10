# Musician Pitch Email Generator v5.0

**An AI-powered email generation system with intelligent date auto-configuration, timezone awareness, and dynamic personalization for musicians pitching to venues.**

[![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)](https://github.com/yourrepo)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🎯 Overview

This is a full-stack web application that generates highly personalized pitch emails for musicians to send to venues. It uses OpenAI's GPT-4 API to create unique, compelling email sequences (1 intro + 7 follow-ups) with advanced anti-spam features and intelligent date management.

### Key Features

- ✅ **AI-Powered Email Generation** - Uses GPT-4 to create personalized, compelling emails
- ✅ **Intelligent Date Auto-Configuration** - Automatically filters availability dates based on follow-up send schedules
- ✅ **Timezone-Aware Processing** - Works globally with any timezone automatically
- ✅ **8-Email Sequence** - 1 intro email + 7 strategic follow-ups with unique content
- ✅ **Anti-Repetition System** - Each email introduces completely new information
- ✅ **Dynamic Accolade Extraction** - AI analyzes artist info and extracts unique selling points
- ✅ **Merge Tag System** - Template variables for personalization ({{venue}}, {{firstname}}, {{unsubscribe_link}})
- ✅ **Subject Line Security** - Multi-layer enforcement prevents merge tags in subject lines
- ✅ **Video Link Distribution** - Smart rotation of performance videos across email sequence
- ✅ **Professional Formatting** - Greeting rotation, signature blocks, unsubscribe footers

---

## 📁 Project Structure

```
musician-pitch-email-generator/
├── index.js                 # Main Express server with API endpoints
├── constants.js             # Email templates, prompts, and configuration
├── emailGenerator.js        # Email prompt generation and OpenAI API calls
├── dateUtils.js            # Date parsing and filtering utilities (v5.0)
├── package.json            # Dependencies and project metadata
├── .env                    # Environment variables (not in repo)
├── VERSION.md              # Detailed version history and changelog
├── README.md               # This file
├── DEVELOPER_GUIDE.md      # Integration guide for developers
├── API_REFERENCE.md        # Complete API endpoint documentation
└── public/                 # Frontend HTML files
    ├── index.html          # Main form and email generation UI
    ├── followup-ideas.html # Follow-up concept editor
    └── followup-email.html # Follow-up email review and editing
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- OpenAI API key (GPT-4 access required)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd musician-pitch-email-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```bash
   touch .env
   ```

4. **Add your OpenAI API key to `.env`**
   ```
   OPENAI_API_KEY=sk-your-openai-api-key-here
   PORT=3000
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 🏗️ Architecture

### Backend (Node.js/Express)

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT REQUEST                       │
│          (Form Data + Current Date/Time)                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   EXPRESS SERVER                         │
│                    (index.js)                           │
│  • Receives request with user input                     │
│  • Filters availability dates (dateUtils.js)           │
│  • Builds AI prompt (emailGenerator.js)                │
│  • Calls OpenAI API                                     │
│  • Processes response                                   │
│  • Returns generated email                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   OPENAI GPT-4 API                      │
│  • Receives detailed prompt with artist info            │
│  • Generates personalized email content                │
│  • Returns subject line + email body                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│               RESPONSE TO CLIENT                        │
│  • Subject line                                         │
│  • Email body with merge tags                           │
│  • Metadata (wait days, video link used, etc.)         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Input** → Form collects: artist info, video links, email style, signature, availability
2. **Date Capture** → Browser captures user's current date/time automatically
3. **Date Filtering** → Server filters availability dates based on email send schedule
4. **Prompt Building** → System builds detailed AI prompt with filtered dates
5. **AI Generation** → OpenAI generates personalized email content
6. **Response Processing** → Server extracts subject/body and adds unsubscribe footer
7. **Client Display** → Frontend displays generated email for review/editing

---

## 🔌 API Endpoints

### Core Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate-email` | POST | Generate initial pitch email |
| `/generate-followup-ideas` | POST | Generate 7 follow-up concept ideas |
| `/generate-followup-sequence` | POST | Generate complete 7-email follow-up sequence |
| `/generate-single-followup` | POST | Generate one follow-up email (one-by-one approach) |
| `/regenerate-followup-email` | POST | Regenerate a follow-up email with variation |

See **[API_REFERENCE.md](API_REFERENCE.md)** for complete endpoint documentation with request/response examples.

---

## 🗓️ Date Intelligence (v5.0)

The system automatically manages availability dates to prevent showing expired dates in follow-up emails.

### How It Works

1. **User enters dates**: "November 9-26th"
2. **Browser captures current date**: Automatic, timezone-aware
3. **System calculates send dates**: Day 7, 14, 21, 31, 41, 51, 61
4. **Filters dates per email**: Shows only valid dates for each send date
5. **Adjusts messaging**: Gracefully handles expired dates

### Example

**Scenario**: Today is October 28, user enters "November 9-26th"

| Email # | Sends On | Availability Shown |
|---------|----------|-------------------|
| Email 1 | Nov 4 (7 days) | "November 9-26" ✅ |
| Email 2 | Nov 11 (14 days) | "November 11-26" ✅ |
| Email 3 | Nov 18 (21 days) | "November 18-26" ✅ |
| Email 4 | Nov 28 (31 days) | None (expired) ❌ |
| Email 5+ | Dec 8+ | None (expired) ❌ |

---

## 🎨 Frontend

Three HTML pages handle the user interface:

1. **index.html** - Main form for artist info and initial email generation
2. **followup-ideas.html** - Edit the 7 follow-up concepts/talking points
3. **followup-email.html** - Review and edit each follow-up email one by one

### User Flow

```
Start → Fill Form → Generate Email → Review Email → Generate Follow-Up Ideas
  → Edit Ideas → Generate Follow-Ups → Review Each Email → Approve/Edit
  → Export to Email Platform
```

---

## 🔧 Configuration

### Environment Variables

```bash
OPENAI_API_KEY=sk-...    # Your OpenAI API key (required)
PORT=3000                # Server port (optional, defaults to 3000)
```

### Constants (constants.js)

- `EMAIL_TEMPLATE` - Master AI prompt template (400+ lines)
- `GPT_MODEL` - AI model to use (default: "gpt-4o")
- `GREETING_ROTATION` - 8 greeting variations for email sequence
- `DISCLAIMER_VARIATIONS` - 18 disclaimer variations for follow-ups
- `DEFAULT_PORT` - Fallback port (3000)

---

## 🛠️ Integration Guide

See **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** for complete integration instructions including:

- How to plug into existing systems
- Database integration points
- Email service provider integration
- Customization options
- API authentication
- Rate limiting
- Error handling

---

## 📊 Features by Version

### v5.0.0 - Current (v5.0_date-auto-config)
- Timezone-aware date filtering system
- Smart date parsing and auto-expiration
- Strengthened subject line merge tag ban
- Frontend date/time capture

### v4.0.0 (v4.0_namerotator_misc)
- Greeting rotation system (8 variations)
- Enhanced subject line generation
- GPT-4o model upgrade

### v3.1.0 (v3.1-relevantemails)
- Talking point-focused email generation
- Enhanced accolade extraction

### v3.0.0
- Dynamic accolade extraction system
- Advanced anti-repetition engine
- Irresistible subject line generation

See **[VERSION.md](VERSION.md)** for complete version history.

---

## 🔒 Security

- ✅ **API Key Protection** - Never commit `.env` file to version control
- ✅ **Input Validation** - All user inputs are validated
- ✅ **CORS Enabled** - Cross-origin requests supported
- ✅ **Merge Tag Safety** - Multiple layers prevent merge tags in subject lines
- ⚠️ **Rate Limiting** - Recommended for production (not implemented)
- ⚠️ **Authentication** - Recommended for production (not implemented)

---

## 📦 Dependencies

```json
{
  "express": "^4.18.2",        // Web server framework
  "dotenv": "^16.3.1",         // Environment variable management
  "openai": "^4.20.1",         // OpenAI API client
  "cors": "^2.8.5"             // Cross-origin resource sharing
}
```

---

## 🧪 Testing

Currently no automated tests. Recommended additions:

- Unit tests for `dateUtils.js` functions
- Integration tests for API endpoints
- End-to-end tests for email generation flow

---

## 🚀 Deployment

### Option 1: DigitalOcean/VPS

   ```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <repo> && cd <repo>
npm install
cp .env.example .env  # Add your API key

# Install PM2 process manager
   sudo npm install -g pm2
pm2 start index.js --name musician-email-gen
pm2 startup
pm2 save
   ```

### Option 2: Heroku

   ```bash
heroku create musician-email-generator
heroku config:set OPENAI_API_KEY=sk-your-key-here
git push heroku main
```

### Option 3: Docker

```dockerfile
# Dockerfile example
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - See LICENSE file for details

---

## 📞 Support

For issues, questions, or integration support:
- Check the [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- Review [API_REFERENCE.md](API_REFERENCE.md)
- Open an issue on GitHub

---

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Express.js community
- All contributors

---

**Version**: 5.0.0 (v5.0_date-auto-config)  
**Last Updated**: October 28, 2025  
**Node Version**: 14+  
**License**: MIT
