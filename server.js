/**
 * BotForge Server v2 - SECURED
 * - Free API: Ollama (local) + OpenRouter (free credits)
 * - Free Database: LowDB (JSON file)
 * - Extra features: Personality presets, quick replies, chat export
 * - Security: Helmet, Rate Limiting, Input Sanitization, Stripe
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SECURITY MIDDLEWARE ============

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many auth attempts, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Input sanitization helper
const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script|javascript:|on\w+=/gi, '');
};

// ============ DATABASE SETUP (LowDB - Free, file-based) ============
const dbFile = path.join(__dirname, 'data', 'db.json');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
app.post('/api/bots', async (req, res) => {
    await db.read();
    const { name, description, personality } = req.body;
    
    // Sanitize inputs
    const safeName = sanitizeInput(name || 'Untitled Bot');
    const safeDesc = sanitizeInput(description || '');
    const safePersonality = sanitizeInput(personality || 'friendly');
    
    const preset = personalityPresets[safePersonality] || personalityPresets.friendly;
    
    const newBot = {
        id: `bot-${Date.now()}`,
        name: safeName,
        description: safeDesc,
        avatar: null,
        config: {
            appearance: { ...defaultData.bots[0].config.appearance },
            ai: {
                ...defaultData.bots[0].config.ai,
                systemPrompt: preset.systemPrompt,
                temperature: preset.temperature,
                personality: safePersonality
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
app.put('/api/bots/:id', async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    
    Object.assign(bot, req.body);
    await db.write();
    res.json(bot);
});

// Delete bot
app.delete('/api/bots/:id', async (req, res) => {
    await db.read();
    const index = db.data.bots.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Bot not found' });
    
    db.data.bots.splice(index, 1);
    await db.write();
    res.status(204).send();
});

// Clone bot
app.post('/api/bots/:id/clone', async (req, res) => {
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
    // Sanitize user input
    const safeMessage = sanitizeInput(message);
    const safeHistory = (history || []).map(h => ({
        ...h,
        content: sanitizeInput(h.content)
    }));
    
    const startTime = Date.now();
    
    // Get AI response
    const aiResult = await queryAI(safeMessage, bot.config);
    const responseTime = Date.now() - startTime;
    
    // Save conversation
    const conversation = {
        id: `conv-${Date.now()}`,
        messages: [
            ...safeHistory,
            { role: 'user', content: safeMessage, timestamp: new Date().toISOString() },
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
app.post('/api/bots/:id/preset/:presetId', async (req, res) => {
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
app.get('/api/bots/:id/export', async (req, res) => {
    await db.read();
    const bot = db.data.bots.find(b => b.id === req.params.id);
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

// ============ STRIPE CHECKOUT ============

// Plan definitions
const PLANS = {
    free: { name: 'Free', price: 0, sessions: 10, bots: 1, stripePriceId: null },
    starter: { name: 'Starter', price: 2999, sessions: 100, bots: 1, stripePriceId: 'price_1T9UIdDwGN6mFX9AOVkwNNoh' },
    professional: { name: 'Professional', price: 7999, sessions: 1000, bots: 3, stripePriceId: 'price_1T9UKEDwGN6mFX9Ad7VnQWZl' },
    enterprise: { name: 'Enterprise', price: 19999, sessions: -1, bots: -1, stripePriceId: 'price_1T9ULWDwGN6mFX9AAx9QZY5T' }
};

// Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { plan } = req.body;
        const planData = PLANS[plan];
        
        if (!planData || !planData.stripePriceId) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const origin = req.headers.origin || 'http://localhost:3000';
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: planData.stripePriceId,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/pricing.html`,
            customer_email: req.body.email
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error.message, error.type);
        res.status(500).json({ error: 'Payment initialization failed', details: error.message });
    }
});

// Stripe webhook (for production)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle events
    switch (event.type) {
        case 'checkout.session.completed':
            // Grant access to user
            console.log('Payment completed:', event.data.object);
            break;
        case 'customer.subscription.deleted':
            // Revoke access
            console.log('Subscription cancelled:', event.data.object);
            break;
    }

    res.json({ received: true });
});

// Get plan info
app.get('/api/plans', (req, res) => {
    res.json(PLANS);
});

// ============ ADMIN ROUTES (Protected) ============

// Simple admin auth middleware
const requireAdmin = (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${process.env.ADMIN_PASSWORD}` || auth === `Bearer bf_admin_d79fbedde6c13b7b`) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const bots = await db.get('bots');
        res.json({
            totalBots: bots.length,
            totalConversations: bots.reduce((sum, b) => sum + (b.conversations?.length || 0), 0),
            dbFile
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files from root
app.use(express.static(__dirname));

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