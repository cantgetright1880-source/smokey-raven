/**
 * BotForge Server v2
 * - Free API: Ollama (local) + OpenRouter (free credits)
 * - Free Database: LowDB (JSON file)
 * - Extra features: Personality presets, quick replies, chat export
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SECURITY MIDDLEWARE ============

// Rate limiting - prevent abuse
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // requests per window

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    const client = requestCounts.get(ip);
    if (now > client.resetTime) {
        client.count = 1;
        client.resetTime = now + RATE_LIMIT_WINDOW;
        return next();
    }
    
    if (client.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    
    client.count++;
    next();
}

// Input sanitization - prevent XSS and injection
function sanitizeInput(req, res, next) {
    const sanitize = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potential script tags and dangerous patterns
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+=/gi, '')
                    .trim();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };
    
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    next();
}

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // More permissive CSP for dev, restrict in production
    const isProduction = process.env.VERCEL === '1';
    const csp = isProduction 
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; connect-src 'self' https:;";
    res.setHeader('Content-Security-Policy', csp);
    next();
});

// Middleware
app.use(cors());
app.use(rateLimiter); // Apply rate limiting
app.use(sanitizeInput); // Apply input sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ============ ADMIN AUTHENTICATION (set via ADMIN_PASSWORD env var) ============
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Simple session-based auth
const adminSessions = new Map();

function requireAdminAuth(req, res, next) {
    // Skip auth if no password configured
    if (!ADMIN_PASSWORD) {
        return next();
    }
    
    const sessionId = req.headers['x-admin-session'] || req.query.session;
    
    if (sessionId && adminSessions.has(sessionId) && adminSessions.get(sessionId) > Date.now()) {
        return next();
    }
    
    // Check basic auth header
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const [type, credentials] = authHeader.split(' ');
        if (type === 'Basic') {
            const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
            if (username === 'admin' && password === ADMIN_PASSWORD) {
                const sessionId = crypto.randomBytes(32).toString('hex');
                adminSessions.set(sessionId, Date.now() + 24*60*60*1000);
                res.setHeader('X-Admin-Session', sessionId);
                return next();
            }
        }
    }
    
    res.setHeader('WWW-Authenticate', 'Basic realm="BotForge Admin"');
    return res.status(401).json({ error: 'Authentication required' });
}

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({ error: 'Admin not configured' });
    }
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        adminSessions.set(sessionId, Date.now() + 24*60*60*1000);
        res.json({ success: true, session: sessionId });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    const sessionId = req.headers['x-admin-session'];
    if (sessionId) adminSessions.delete(sessionId);
    res.json({ success: true });
});

// Protected admin routes middleware
const adminAuth = [requireAdminAuth];

// ============ DATABASE SETUP (LowDB - Free, file-based) ============
const dbFile = path.join(__dirname, 'data', 'db.json');
const dataDir = path.join(__dirname, 'data');

// Create data directory if it doesn't exist (handle Vercel gracefully)
let dataDirCreated = false;
try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        dataDirCreated = true;
    }
} catch (e) {
    console.log('Note: Running in serverless environment, data storage limited');
}

// Default data structure
const defaultData = {
    bots: [
        {
            id: 'demo-001',
            name: 'Anastasia',
            description: 'AI Influencer Bot',
            avatar: null,
            config: {
                appearance: {
                    botBubbleColor: '#6366f1',
                    userBubbleColor: '#1e1e2e',
                    accentColor: '#f59e0b',
                    botTextColor: '#ffffff',
                    userTextColor: '#ffffff',
                    inputBgColor: '#ffffff',
                    bgType: 'gradient',
                    bgColor: '#f8fafc',
                    bgColor2: '#e2e8f0',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '14px',
                    bubbleStyle: 'rounded',
                    avatarShape: 'rounded',
                    avatarPosition: 'left',
                    bgImageUrl: ''
                },
                ai: {
                    provider: 'openrouter', // free options: 'ollama', 'openrouter'
                    model: 'microsoft/phi-3-mini-128k-instruct', // free on OpenRouter
                    systemPrompt: 'You are Anastasia, a friendly and engaging AI assistant.',
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    personality: 'friendly',
                    knowledgeBase: []
                },
                chat: {
                    showTyping: true,
                    soundNotifications: false,
                    showTimestamps: true,
                    welcomeMessage: 'Hi! I\'m Anastasia. How can I help you today?',
                    placeholderMessage: 'Type a message...',
                    widgetPosition: 'bottom-right',
                    autoOpen: false,
                    quickReplies: [],
                    voiceInput: false
                },
                features: {
                    multiLanguage: false,
                    chatExport: true,
                    publicPage: true
                }
            },
            stats: {
                totalConversations: 0,
                totalMessages: 0,
                avgResponseTime: '0s',
                satisfactionRate: 0,
                apiCost: 0
            },
            conversations: [],
            createdAt: new Date().toISOString()
        }
    ],
    settings: {
        defaultLanguage: 'en',
        analyticsEnabled: true
    }
};

// Initialize database
let db;
async function initDB() {
    const adapter = new JSONFile(dbFile);
    db = new Low(adapter, defaultData);
    await db.read();
    db.data = db.data || defaultData;
    await db.write();
    console.log('📁 Database initialized');
}

// ============ FREE AI PROVIDERS ============

// Option 1: Ollama (Completely free, self-hosted)
async function queryOllama(prompt, config) {
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model || 'llama3.2',
                prompt: config.systemPrompt + '\n\nUser: ' + prompt,
                stream: false,
                options: {
                    temperature: config.temperature || 0.7,
                    num_predict: config.maxTokens || 2048
                }
            })
        });
        const data = await response.json();
        return { response: data.response, provider: 'ollama' };
    } catch (err) {
        return { response: 'Ollama not available. Please configure a different provider.', error: err.message };
    }
}

// Option 2: OpenRouter (Free credits for new users)
async function queryOpenRouter(prompt, config) {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || 'free'}`,
                'HTTP-Referer': 'https://botforge.app',
                'X-Title': 'BotForge'
            },
            body: JSON.stringify({
                model: config.model || 'microsoft/phi-3-mini-128k-instruct',
                messages: [
                    { role: 'system', content: config.systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: config.temperature || 0.7,
                max_tokens: config.maxTokens || 2048
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            return { 
                response: data.choices[0].message.content, 
                provider: 'openrouter',
                model: data.model
            };
        }
        return { response: 'API error: ' + JSON.stringify(data), error: data };
    } catch (err) {
        return { response: 'OpenRouter error: ' + err.message, error: err.message };
    }
}

// Option 3: HuggingFace (Free inference)
async function queryHuggingFace(prompt, config) {
    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${config.model || 'microsoft/Phi-3-mini-128k-instruct'}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: config.systemPrompt + '\n\nUser: ' + prompt + '\n\nAssistant:',
                parameters: {
                    temperature: config.temperature || 0.7,
                    max_new_tokens: config.maxTokens || 512
                }
            })
        });
        const data = await response.json();
        if (Array.isArray(data) && data[0]) {
            return { response: data[0].generated_text, provider: 'huggingface' };
        }
        return { response: 'HuggingFace: ' + JSON.stringify(data), error: data };
    } catch (err) {
        return { response: 'HuggingFace error: ' + err.message, error: err.message };
    }
}

// Main AI query function
async function queryAI(prompt, botConfig) {
    const provider = botConfig.ai?.provider || 'openrouter';
    
    switch (provider) {
        case 'ollama':
            return queryOllama(prompt, botConfig.ai);
        case 'openrouter':
            return queryOpenRouter(prompt, botConfig.ai);
        case 'huggingface':
            return queryHuggingFace(prompt, botConfig.ai);
        default:
            return queryOpenRouter(prompt, botConfig.ai);
    }
}

// ============ PERSONALITY PRESETS ============
const personalityPresets = {
    friendly: {
        systemPrompt: 'You are a friendly, warm, and helpful assistant. Use emojis occasionally. Be conversational and personable.',
        temperature: 0.8
    },
    professional: {
        systemPrompt: 'You are a professional business assistant. Be concise, accurate, and formal. Use proper grammar at all times.',
        temperature: 0.5
    },
    casual: {
        systemPrompt: 'You are a chill friend who happens to be smart. Keep it casual, use slang naturally, but still be helpful.',
        temperature: 0.9
    },
    support: {
        systemPrompt: 'You are a customer support agent. Be patient, empathetic, and thorough. Always try to solve the user\'s problem.',
        temperature: 0.6
    },
    sales: {
        systemPrompt: 'You are a enthusiastic sales assistant. Highlight product benefits, be persuasive but not pushy. Drive conversions.',
        temperature: 0.85
    },
    creative: {
        systemPrompt: 'You are a creative writer. Be imaginative, use vivid language, and think outside the box. Surprise and delight users.',
        temperature: 1.0
    },
    technical: {
        systemPrompt: 'You are a technical expert. Be precise, use proper terminology, and provide detailed technical information when asked.',
        temperature: 0.4
    }
};

// ============ API ROUTES ============

// Get all bots
app.get('/api/bots', async (req, res) => {
    await db.read();
    res.json(db.data.bots.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        createdAt: b.createdAt,
        stats: b.stats
    })));
});

// Get single bot
app.get('/api/bots/:id', async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json(bot);
});

// Create bot
app.post('/api/bots', adminAuth, async (req, res) => {
    await db.read();
    const { name, description, personality } = req.body;
    
    const preset = personalityPresets[personality || 'friendly'];
    
    const newBot = {
        id: `bot-${Date.now()}`,
        name: name,
        description: description || '',
        avatar: null,
        config: {
            appearance: { ...defaultData.bots[0].config.appearance },
            ai: {
                ...defaultData.bots[0].config.ai,
                systemPrompt: preset.systemPrompt,
                temperature: preset.temperature,
                personality: personality || 'friendly'
            },
            chat: { ...defaultData.bots[0].config.chat },
            features: { ...defaultData.bots[0].config.features }
        },
        stats: {
            totalConversations: 0,
            totalMessages: 0,
            avgResponseTime: '0s',
            satisfactionRate: 0,
            apiCost: 0
        },
        conversations: [],
        createdAt: new Date().toISOString()
    };
    
    db.data.bots.push(newBot);
    await db.write();
    res.status(201).json(newBot);
});

// Update bot
app.put('/api/bots/:id', adminAuth, async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    
    Object.assign(bot, req.body);
    await db.write();
    res.json(bot);
});

// Delete bot
app.delete('/api/bots/:id', adminAuth, async (req, res) => {
    await db.read();
    const index = db.data.bots.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Bot not found' });
    
    db.data.bots.splice(index, 1);
    await db.write();
    res.status(204).send();
});

// Clone bot
app.post('/api/bots/:id/clone', adminAuth, async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    
    const clonedBot = JSON.parse(JSON.stringify(bot));
    clonedBot.id = `bot-${Date.now()}`;
    clonedBot.name = `${bot.name} (Copy)`;
    clonedBot.createdAt = new Date().toISOString();
    clonedBot.conversations = [];
    clonedBot.stats = {
        totalConversations: 0,
        totalMessages: 0,
        avgResponseTime: '0s',
        satisfactionRate: 0,
        apiCost: 0
    };
    
    db.data.bots.push(clonedBot);
    await db.write();
    res.status(201).json(clonedBot);
});

// Chat endpoint
app.post('/api/chat/:botId', async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.botId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    
    const { message, history } = req.body;
    const startTime = Date.now();
    
    // Get AI response
    const aiResult = await queryAI(message, bot.config);
    const responseTime = Date.now() - startTime;
    
    // Save conversation
    const conversation = {
        id: `conv-${Date.now()}`,
        messages: [
            ...(history || []),
            { role: 'user', content: message, timestamp: new Date().toISOString() },
            { role: 'bot', content: aiResult.response, timestamp: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString()
    };
    
    bot.conversations.push(conversation);
    bot.stats.totalMessages += 2;
    bot.stats.totalConversations = bot.conversations.length;
    bot.stats.avgResponseTime = responseTime + 'ms';
    
    await db.write();
    
    res.json({
        message: aiResult.response,
        bot: bot.name,
        provider: aiResult.provider,
        responseTime,
        timestamp: new Date().toISOString()
    });
});

// Get personality presets
app.get('/api/presets', (req, res) => {
    res.json(Object.keys(personalityPresets).map(key => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        ...personalityPresets[key]
    })));
});

// Apply personality preset
app.post('/api/bots/:id/preset/:presetId', adminAuth, async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.botId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    
    const preset = personalityPresets[req.params.presetId];
    if (!preset) return res.status(404).json({ error: 'Preset not found' });
    
    bot.config.ai.systemPrompt = preset.systemPrompt;
    bot.config.ai.temperature = preset.temperature;
    bot.config.ai.personality = req.params.presetId;
    
    await db.write();
    res.json(bot);
});

// Export chat history
app.get('/api/bots/:id/export', adminAuth, async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.botId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    
    const format = req.query.format || 'json';
    
    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${bot.name}-chat-export.json"`);
        res.json(bot.conversations);
    } else if (format === 'txt') {
        let text = `Chat Export - ${bot.name}\nExported: ${new Date().toISOString()}\n\n`;
        bot.conversations.forEach(conv => {
            conv.messages.forEach(msg => {
                text += `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}\n`;
            });
            text += '---\n';
        });
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${bot.name}-chat-export.txt"`);
        res.send(text);
    }
});

// Public chat page
app.get('/chat/:botId', async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.botId);
    if (!bot) return res.status(404).send('Bot not found');
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bot.name} - Chat</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Outfit', sans-serif; 
            background: ${bot.config.appearance.bgType === 'gradient' 
                ? `linear-gradient(135deg, ${bot.config.appearance.bgColor}, ${bot.config.appearance.bgColor2})` 
                : bot.config.appearance.bgColor};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .chat-container {
            width: 100%;
            max-width: 500px;
            height: 80vh;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .chat-header {
            padding: 20px;
            background: ${bot.config.appearance.accentColor};
            color: white;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .avatar {
            width: 44px;
            height: 44px;
            border-radius: ${bot.config.appearance.avatarShape === 'circle' ? '50%' : '10px'};
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            color: ${bot.config.appearance.accentColor};
        }
        .chat-title h2 { font-size: 1.1rem; }
        .chat-title span { font-size: 0.8rem; opacity: 0.9; }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .message {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .message.bot {
            align-self: flex-start;
            background: ${bot.config.appearance.botBubbleColor};
            color: ${bot.config.appearance.botTextColor};
            border-bottom-left-radius: 4px;
        }
        .message.user {
            align-self: flex-end;
            background: ${bot.config.appearance.userBubbleColor};
            color: ${bot.config.appearance.userTextColor};
            border-bottom-right-radius: 4px;
        }
        .input-area {
            padding: 16px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
        }
        .input-area input {
            flex: 1;
            padding: 14px 20px;
            border: 1px solid #ddd;
            border-radius: 25px;
            font-size: 0.95rem;
            outline: none;
            font-family: inherit;
        }
        .input-area input:focus {
            border-color: ${bot.config.appearance.accentColor};
        }
        .input-area button {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: ${bot.config.appearance.accentColor};
            color: white;
            font-size: 18px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .input-area button:hover { transform: scale(1.05); }
        .quick-replies {
            padding: 0 16px 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .quick-reply {
            padding: 8px 14px;
            background: ${bot.config.appearance.accentColor}20;
            border: 1px solid ${bot.config.appearance.accentColor};
            border-radius: 20px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        .quick-reply:hover {
            background: ${bot.config.appearance.accentColor};
            color: white;
        }
        .typing {
            display: none;
            padding: 12px 16px;
            background: ${bot.config.appearance.botBubbleColor}30;
            border-radius: 16px;
            width: fit-content;
            gap: 4px;
        }
        .typing.show { display: flex; }
        .typing span {
            width: 8px;
            height: 8px;
            background: ${bot.config.appearance.botBubbleColor};
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-6px); }
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <div class="avatar">${bot.name.charAt(0)}</div>
            <div class="chat-title">
                <h2>${bot.name}</h2>
                <span>AI Assistant</span>
            </div>
        </div>
        <div class="messages" id="messages">
            <div class="message bot">${bot.config.chat.welcomeMessage}</div>
            ${bot.config.chat.quickReplies?.length ? `
            <div class="quick-replies">
                ${bot.config.chat.quickReplies.map(r => `<button class="quick-reply" onclick="sendMessage('${r}')">${r}</button>`).join('')}
            </div>
            ` : ''}
        </div>
        <div class="typing" id="typing">
            <span></span><span></span><span></span>
        </div>
        <div class="input-area">
            <input type="text" id="input" placeholder="${bot.config.chat.placeholderMessage}" onkeypress="if(event.key==='Enter')sendMessage()">
            <button onclick="sendMessage()">➤</button>
        </div>
    </div>
    <script>
        const botId = '${bot.id}';
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const typing = document.getElementById('typing');
        
        async function sendMessage(text) {
            const msg = text || input.value.trim();
            if (!msg) return;
            
            addMessage(msg, 'user');
            input.value = '';
            typing.classList.add('show');
            
            try {
                const res = await fetch('/api/chat/' + botId, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
                const data = await res.json();
                typing.classList.remove('show');
                addMessage(data.message, 'bot');
            } catch (err) {
                typing.classList.remove('show');
                addMessage('Error: ' + err.message, 'bot');
            }
        }
        
        function addMessage(text, sender) {
            const div = document.createElement('div');
            div.className = 'message ' + sender;
            div.textContent = text;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
        }
    </script>
</body>
</html>`;
    
    res.send(html);
});

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ START SERVER ============
async function start() {
    await initDB();
    app.listen(PORT, () => {
        console.log(`🤖 BotForge server running on http://localhost:${PORT}`);
        console.log(`📁 Database: ${dbFile}`);
        console.log(`🌐 Public chat: http://localhost:${PORT}/chat/demo-001`);
    });
}

start().catch(console.error);
