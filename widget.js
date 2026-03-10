/**
 * BotForge Chat Widget
 * With Human Handoff & Analytics
 */

const WIDGET_CONFIG = {
    position: 'bottom-right',
    primaryColor: '#8b5cf6',
    title: 'Chat with us',
    subtitle: 'We reply instantly',
    greeting: 'Hi! How can we help you today?',
    // Human handoff settings
    handoffTrigger: ['talk to human', 'speak to person', 'real person', 'help me talk to someone'],
    handoffMessage: 'Connecting you with a human agent...',
    // Analytics
    analyticsEnabled: true
};

// Chat state
let chatState = {
    messages: [],
    isOpen: false,
    isTyping: false,
    conversationStart: null,
    userId: null,
    messagesCount: 0
};

// Initialize
function initWidget() {
    createWidgetUI();
    loadChatHistory();
    initAnalytics();
    
    // Track widget open
    document.getElementById('chatWidget')?.addEventListener('click', () => {
        trackEvent('widget_opened');
    });
}

// Create widget HTML
function createWidgetUI() {
    const widget = document.createElement('div');
    widget.id = 'botforge-widget';
    widget.innerHTML = `
        <div class="widget-toggle" onclick="toggleChat()">
            <span class="widget-icon">💬</span>
            <span class="widget-badge" id="unreadBadge" style="display:none">0</span>
        </div>
        <div class="widget-chat" id="widgetChat" style="display:none">
            <div class="widget-header">
                <div>
                    <strong>${WIDGET_CONFIG.title}</strong>
                    <small>${WIDGET_CONFIG.subtitle}</small>
                </div>
                <button onclick="toggleChat()" class="close-btn">×</button>
            </div>
            <div class="widget-messages" id="chatMessages"></div>
            <div class="widget-typing" id="typingIndicator" style="display:none">
                <span></span><span></span><span></span>
            </div>
            <div class="widget-input">
                <input type="text" id="chatInput" placeholder="Type a message..." onkeypress="handleChatKey(event)">
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);
    addWidgetStyles();
    
    // Add initial greeting
    setTimeout(() => {
        if (chatState.messages.length === 0) {
            addBotMessage(WIDGET_CONFIG.greeting);
        }
    }, 1000);
}

// Toggle chat open/closed
function toggleChat() {
    const chat = document.getElementById('widgetChat');
    const widget = document.getElementById('chatWidget');
    
    if (chat.style.display === 'none') {
        chat.style.display = 'flex';
        widget.classList.add('active');
        document.getElementById('chatInput').focus();
        trackEvent('chat_started');
    } else {
        chat.style.display = 'none';
        widget.classList.remove('active');
    }
}

// Send message
function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    addUserMessage(message);
    input.value = '';
    
    // Track
    chatState.messagesCount++;
    trackEvent('message_sent', { message });
    
    // Check for human handoff
    const lowerMsg = message.toLowerCase();
    if (WIDGET_CONFIG.handoffTrigger.some(trigger => lowerMsg.includes(trigger))) {
        requestHumanHandoff();
        return;
    }
    
    // Simulate bot response
    setTimeout(() => {
        showTyping();
        setTimeout(() => {
            hideTyping();
            const response = getBotResponse(message);
            addBotMessage(response);
            trackEvent('bot_response', { response });
        }, 1500);
    }, 500);
}

// Human handoff
function requestHumanHandoff() {
    showTyping();
    trackEvent('human_handoff_requested');
    
    setTimeout(() => {
        hideTyping();
        addBotMessage(WIDGET_CONFIG.handoffMessage + '\n\n📞 A human agent will be with you shortly.\n\n💬 In the meantime, you can email us at support@botforge.ai');
        
        // Notify via webhook/Slack (would connect to backend)
        notifyHumanHandoff();
    }, 1000);
}

// Notify system of handoff (placeholder)
function notifyHumanHandoff() {
    const handoffData = {
        type: 'human_handoff',
        userId: chatState.userId,
        conversationId: generateConversationId(),
        timestamp: new Date().toISOString(),
        message: 'Customer requested human agent'
    };
    
    console.log('📞 Human Handoff:', handoffData);
    // In production: send to backend → notify agent
}

// Get bot response
function getBotResponse(message) {
    const responses = {
        'price': "We offer three plans:\n\n🌱 Starter - $29/mo\n⭐ Professional - $79/mo\n🏢 Enterprise - $199/mo\n\nWhich interests you?",
        'pricing': "We offer three plans:\n\n🌱 Starter - $29/mo\n⭐ Professional - $79/mo\n🏢 Enterprise - $199/mo\n\nWhich interests you?",
        'help': "I can help with:\n- Pricing questions\n- Setting up a bot\n- Technical issues\n- Billing\n\nWhat do you need?",
        'hello': "Hi! 👋 How can I help you today?",
        'hi': "Hello! 👋 How can I help you today?",
        'bye': "Goodbye! 👋 Thanks for chatting. Feel free to come back anytime!",
        'thanks': "You're welcome! 😊 Anything else I can help with?"
    };
    
    const lower = message.toLowerCase();
    for (const [key, value] of Object.entries(responses)) {
        if (lower.includes(key)) return value;
    }
    
    return "I understand. Let me connect you with the right information. Could you tell me more about what you're looking for?";
}

// Add user message
function addUserMessage(text) {
    chatState.messages.push({ role: 'user', text, timestamp: new Date().toISOString() });
    renderMessage(text, 'user');
}

// Add bot message
function addBotMessage(text) {
    chatState.messages.push({ role: 'bot', text, timestamp: new Date().toISOString() });
    renderMessage(text, 'bot');
}

// Render message
function renderMessage(text, role) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const msg = document.createElement('div');
    msg.className = `msg msg-${role}`;
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// Typing indicator
function showTyping() {
    chatState.isTyping = true;
    document.getElementById('typingIndicator').style.display = 'flex';
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
}

function hideTyping() {
    chatState.isTyping = false;
    document.getElementById('typingIndicator').style.display = 'none';
}

// Handle enter key
function handleChatKey(e) {
    if (e.key === 'Enter') sendMessage();
}

// ============================================
// ANALYTICS
// ============================================

function initAnalytics() {
    chatState.conversationStart = new Date();
    chatState.userId = generateUserId();
    
    // Track session start
    trackEvent('session_start', { userId: chatState.userId });
}

// Track event
function trackEvent(eventName, data = {}) {
    if (!WIDGET_CONFIG.analyticsEnabled) return;
    
    const event = {
        event: eventName,
        userId: chatState.userId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        ...data
    };
    
    console.log('📊 Analytics:', event);
    
    // Store locally
    const analytics = JSON.parse(localStorage.getItem('botforge_analytics') || '[]');
    analytics.push(event);
    localStorage.setItem('botforge_analytics', JSON.stringify(analytics));
}

// Get analytics summary (for dashboard)
function getAnalyticsSummary() {
    const analytics = JSON.parse(localStorage.getItem('botforge_analytics') || '[]');
    
    const summary = {
        totalSessions: 0,
        totalMessages: 0,
        humanHandoffs: 0,
        averageSessionLength: 0,
        topEvents: {}
    };
    
    // Group by session
    const sessions = {};
    analytics.forEach(event => {
        if (!sessions[event.userId]) sessions[event.userId] = [];
        sessions[event.userId].push(event);
    });
    
    summary.totalSessions = Object.keys(sessions).length;
    
    analytics.forEach(event => {
        if (event.event === 'message_sent') summary.totalMessages++;
        if (event.event === 'human_handoff_requested') summary.humanHandoffs++;
        
        summary.topEvents[event.event] = (summary.topEvents[event.event] || 0) + 1;
    });
    
    return summary;
}

// Generate IDs
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

function generateConversationId() {
    return 'conv_' + Date.now();
}

// Load chat history
function loadChatHistory() {
    const saved = localStorage.getItem('botforge_chat');
    if (saved) {
        const data = JSON.parse(saved);
        chatState = { ...chatState, ...data };
        
        // Re-render messages
        chatState.messages.forEach(msg => {
            renderMessage(msg.text, msg.role);
        });
    }
}

// Save chat
function saveChat() {
    localStorage.setItem('botforge_chat', JSON.stringify({
        messages: chatState.messages,
        userId: chatState.userId
    }));
}

// Styles
function addWidgetStyles() {
    const styles = `
        #botforge-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .widget-toggle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${WIDGET_CONFIG.primaryColor};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: transform 0.2s;
        }
        .widget-toggle:hover { transform: scale(1.1); }
        .widget-toggle.active { transform: rotate(90deg); }
        .widget-icon { font-size: 24px; }
        .widget-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #ef4444;
            color: white;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 10px;
        }
        .widget-chat {
            position: absolute;
            bottom: 70px;
            right: 0;
            width: 350px;
            height: 450px;
            background: #151528;
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            overflow: hidden;
        }
        .widget-header {
            background: ${WIDGET_CONFIG.primaryColor};
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: white;
        }
        .widget-header small { opacity: 0.8; font-size: 12px; }
        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
        }
        .widget-messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
        }
        .msg {
            max-width: 80%;
            padding: 0.75rem 1rem;
            border-radius: 12px;
            margin-bottom: 0.5rem;
            font-size: 14px;
            line-height: 1.4;
        }
        .msg-user {
            background: ${WIDGET_CONFIG.primaryColor};
            color: white;
            margin-left: auto;
            border-bottom-right-radius: 4px;
        }
        .msg-bot {
            background: #1e1e3a;
            color: #e2e8f0;
            border-bottom-left-radius: 4px;
        }
        .widget-typing {
            padding: 0.5rem 1rem;
            background: #1e1e3a;
            display: flex;
            gap: 4px;
        }
        .widget-typing span {
            width: 8px;
            height: 8px;
            background: #8b5cf6;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        .widget-typing span:nth-child(2) { animation-delay: 0.2s; }
        .widget-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
        }
        .widget-input {
            display: flex;
            padding: 0.75rem;
            border-top: 1px solid #334155;
            gap: 0.5rem;
        }
        .widget-input input {
            flex: 1;
            padding: 0.75rem;
            border-radius: 8px;
            border: 1px solid #334155;
            background: #0c0c1a;
            color: white;
        }
        .widget-input button {
            padding: 0.75rem 1rem;
            background: ${WIDGET_CONFIG.primaryColor};
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
} else {
    initWidget();
}
