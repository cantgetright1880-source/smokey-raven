# BotForge - AI Chatbot Builder

## Project Overview
**Name:** BotForge
**Tagline:** Build Bots. Paint Personalities. 🚀

An ultra-customizable AI chatbot builder that's better than Aminos. Full control over every visual element, AI model options, and deployment.

---

## Core Features

### 1. Visual Customization (The "Paint" System)
- **Chat Widget Colors**
  - Primary color (bot bubbles)
  - Secondary color (user bubbles)
  - Accent color (buttons, links)
  - Text colors (bot text, user text)
  
- **Background Options**
  - Solid colors
  - Gradient backgrounds
  - Image backgrounds (upload custom)
  - Animated backgrounds
  
- **Font Customization**
  - Font family selection
  - Font size
  - Font weight
  - Chat bubble style (rounded, square, pill)

- **Bot Avatar**
  - Upload custom avatar
  - AI-generated avatar
  - Animated avatars (Lottie)
  - Position (left, right, hidden)

### 2. AI Configuration
- **Model Selection**
  - OpenAI (GPT-4, GPT-4o, GPT-4o-mini)
  - Anthropic (Claude 3.5, Claude 3)
  - Google (Gemini Pro)
  - Meta (Llama 3)
  - Mistral
  - Custom Ollama endpoint
  
- **Personality Settings**
  - System prompt editor
  - Temperature (creativity)
  - Max tokens
  - Top-p sampling
  - Presence penalty
  - Frequency penalty
  
- **Knowledge Base**
  - PDF upload
  - Website scraping
  - Text/CSV upload
  - Q&A pairs
  - Custom embeddings

### 3. Chat Widget Features
- **Widget Positioning**
  - Floating (corner)
  - Embedded (full page)
  - Slide-in panel
  
- **Launch Options**
  - Floating button (custom icon/image)
  - Auto-open on page load
  - Custom trigger phrases
  
- **Conversation Settings**
  - Welcome message
  - Placeholder text
  - Typing indicators
  - Sound notifications
  - Message timestamps
  - Copy message button
  - Share conversation

### 4. Analytics Dashboard
- Chat history
- User sessions
- Popular questions
- Sentiment analysis
- Response times
- Token usage

### 5. Deployment
- Embed code (HTML/JS)
- WordPress plugin
- Shopify app
- API access
- Webhook integrations

---

## Technical Stack
- **Frontend:** Vanilla JS + HTML + CSS (lightweight)
- **Backend:** Node.js + Express
- **Database:** SQLite (simple, portable)
- **AI:** Ollama (local, free) or external APIs
- **Hosting:** Static export or self-hosted

---

## File Structure
```
botforge/
├── public/
│   ├── index.html          # Main dashboard
│   ├── chat-widget.html    # Embeddable chat widget
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js          # Main app logic
│   │   ├── editor.js       # Visual editor
│   │   ├── preview.js       # Live preview
│   │   └── analytics.js    # Analytics charts
│   └── assets/
│       └── icons/
├── server.js               # Express server
├── database.js            # SQLite setup
├── api.js                 # AI API routes
└── config.json            # Bot configurations
```

---

## Color Palette Suggestion
- Primary: #6366f1 (Indigo)
- Secondary: #1e1e2e (Dark)
- Accent: #f59e0b (Amber)
- Success: #10b981
- Error: #ef4444

---

## For Vera to Build
This should be a full CRUD app where users can:
1. Create multiple bots
2. Customize every visual element with live preview
3. Configure AI models
4. Test in preview mode
5. Export embed code
6. View analytics

**Estimated Time:** 2-3 hours for MVP
