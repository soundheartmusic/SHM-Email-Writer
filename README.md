# Musician Pitch Email Generator

A full-stack web application that helps musicians generate customized pitch emails to venues using OpenAI's GPT-4 API.

## Features

- Simple, modern UI built with HTML and Tailwind CSS
- Form for inputting musician details and preferences
- Integration with OpenAI GPT-4 for email generation
- Real-time email preview
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- OpenAI API key

## Local Setup

1. Clone the repository
2. Create a `.env` file in the root directory with the following content:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser and navigate to `http://localhost:3000`

## Deployment to DigitalOcean

1. Create a new DigitalOcean Droplet (Basic plan is sufficient)
2. SSH into your Droplet
3. Install Node.js and npm:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Clone your repository to the server
5. Create the `.env` file with your OpenAI API key
6. Install dependencies:
   ```bash
   npm install
   ```
7. Install PM2 (process manager):
   ```bash
   sudo npm install -g pm2
   ```
8. Start the application:
   ```bash
   pm2 start index.js
   ```
9. Set up PM2 to start on boot:
   ```bash
   pm2 startup
   ```

## Usage

1. Fill out the form with your:
   - Detailed information about your music and style
   - 1-3 performance video links
   - Preferred email personality style
   - Contact information for signature
   - Availability for the next 3 months
2. Click "Generate Pitch Email"
3. Copy the generated email and customize as needed

## Security Notes

- Never commit your `.env` file to version control
- Keep your OpenAI API key secure
- Consider implementing rate limiting for production use

## License

MIT 