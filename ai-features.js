/**
 * BotForge Advanced AI Features
 * Custom Instructions, Sentiment, Multi-language
 */

// ============================================
// CUSTOM INSTRUCTIONS
// ============================================

const CustomInstructions = {
    // Default personality templates
    personalities: {
        friendly: {
            name: 'Friendly',
            instructions: 'Be warm, casual, and helpful. Use emojis occasionally. Keep responses concise but friendly.',
            example: "Hey there! 👋 Happy to help! What do you need?"
        },
        professional: {
            name: 'Professional',
            instructions: 'Be formal, concise, and informative. Avoid emojis. Use proper grammar at all times.',
            example: "Good day. How may I assist you today?"
        },
        support: {
            name: 'Support Agent',
            instructions: 'Be empathetic and patient. Prioritize solving the customer issue. Ask clarifying questions when needed.',
            example: "I understand you're experiencing an issue. Let me help you resolve this."
        },
        sales: {
            name: 'Sales',
            instructions: 'Be enthusiastic but not pushy. Highlight benefits. Ask about their needs. Try to close the conversation.',
            example: "Great question! Let me tell you how we can help..."
        },
        expert: {
            name: 'Expert',
            instructions: 'Be knowledgeable and thorough. Provide detailed explanations. Assume some technical knowledge.',
            example: "Based on our analysis, the optimal solution would be..."
        }
    },
    
    // Get instructions for a bot
    getInstructions(botConfig) {
        if (botConfig.customInstructions) {
            return botConfig.customInstructions;
        }
        
        if (botConfig.personality && this.personalities[botConfig.personality]) {
            return this.personalities[botConfig.personality].instructions;
        }
        
        return this.personalities.friendly.instructions;
    }
};

// ============================================
// SENTIMENT ANALYSIS
// ============================================

const SentimentAnalyzer = {
    // Simple keyword-based sentiment (in production, use AI API)
    analyze(text) {
        const positive = ['great', 'awesome', 'love', 'perfect', 'thanks', 'thank', 'amazing', 'excellent', 'good', 'happy', 'wonderful'];
        const negative = ['bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'upset', 'worst', 'horrible', 'disappointed', 'annoyed'];
        
        const lower = text.toLowerCase();
        let score = 0;
        
        positive.forEach(word => {
            if (lower.includes(word)) score += 1;
        });
        
        negative.forEach(word => {
            if (lower.includes(word)) score -= 1;
        });
        
        // Return sentiment
        if (score > 0) return { sentiment: 'positive', score, label: 'Happy' };
        if (score < 0) return { sentiment: 'negative', score, label: 'Frustrated' };
        return { sentiment: 'neutral', score: 0, label: 'Neutral' };
    },
    
    // Detect urgent situations
    isUrgent(text) {
        const urgentKeywords = ['immediately', 'urgent', 'asap', 'now', 'emergency', 'critical', 'broken', 'down', 'not working'];
        const lower = text.toLowerCase();
        return urgentKeywords.some(keyword => lower.includes(keyword));
    },
    
    // Get appropriate response based on sentiment
    adjustResponse(response, sentiment) {
        if (sentiment.sentiment === 'negative') {
            // Add empathy for negative sentiment
            return "I understand your frustration. " + response;
        }
        return response;
    }
};

// ============================================
// MULTI-LANGUAGE SUPPORT
// ============================================

const MultiLanguage = {
    // Supported languages
    languages: {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        pt: 'Portuguese',
        it: 'Italian',
        nl: 'Dutch',
        pl: 'Polish',
        zh: 'Chinese',
        ja: 'Japanese',
        ko: 'Korean',
        ar: 'Arabic'
    },
    
    // Detect language (simple version - in production use AI)
    detect(text) {
        // Common words in each language
        const patterns = {
            es: ['el', 'la', 'de', 'que', 'es', 'en', 'con', 'por', 'para'],
            fr: ['le', 'la', 'de', 'et', 'est', 'en', 'que', 'vous', 'nous'],
            de: ['der', 'die', 'das', 'und', 'ist', 'in', 'den', 'von', 'mit'],
            pt: ['o', 'a', 'de', 'que', 'e', 'em', 'para', 'com', 'uma']
        };
        
        const words = text.toLowerCase().split(/\s+/);
        
        for (const [lang, keywords] of Object.entries(patterns)) {
            const matches = words.filter(w => keywords.includes(w));
            if (matches.length >= 2) return lang;
        }
        
        return 'en'; // Default to English
    },
    
    // Greetings in different languages
    greetings: {
        en: 'Hello! How can I help?',
        es: '¡Hola! ¿Cómo puedo ayudar?',
        fr: 'Bonjour! Comment puis-je aider?',
        de: 'Hallo! Wie kann ich helfen?',
        pt: 'Olá! Como posso ajudar?'
    },
    
    // Get greeting in detected language
    getGreeting(lang) {
        return this.greetings[lang] || this.greetings.en;
    }
};

// ============================================
// CONVERSATION CONTEXT
// ============================================

const ConversationContext = {
    maxHistory: 10,
    
    // Save context for a conversation
    save(conversationId, messages) {
        const key = `context_${conversationId}`;
        const data = {
            messages: messages.slice(-this.maxHistory),
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(data));
    },
    
    // Load context
    load(conversationId) {
        const key = `context_${conversationId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    
    // Extract context for AI
    getContextPrompt(conversationId) {
        const context = this.load(conversationId);
        if (!context) return '';
        
        let prompt = '\n\nPrevious conversation:\n';
        context.messages.forEach(msg => {
            prompt += `${msg.role}: ${msg.text}\n`;
        });
        
        return prompt;
    }
};

// ============================================
// LEAD SCORING
// ============================================

const LeadScoring = {
    // Score a lead based on their interaction
    score(leadData) {
        let score = 0;
        
        // Plan interest
        if (leadData.tier === 'enterprise') score += 30;
        else if (leadData.tier === 'professional') score += 20;
        else score += 10;
        
        // Has business name
        if (leadData.business && leadData.business.length > 2) score += 10;
        
        // Time on page (would be tracked)
        // Questions asked
        
        // Return score and rating
        if (score >= 40) return { score, rating: 'Hot', priority: 1 };
        if (score >= 25) return { score, rating: 'Warm', priority: 2 };
        return { score, rating: 'Cold', priority: 3 };
    },
    
    // Get follow-up action based on score
    getAction(scoreData) {
        if (scoreData.rating === 'Hot') {
            return 'Immediate follow-up within 1 hour';
        } else if (scoreData.rating === 'Warm') {
            return 'Follow-up within 24 hours';
        }
        return 'Add to nurture sequence';
    }
};

// ============================================
// EXPORT
// ============================================

window.BotForgeAI = {
    customInstructions: CustomInstructions,
    sentiment: SentimentAnalyzer,
    multiLanguage: MultiLanguage,
    context: ConversationContext,
    leadScoring: LeadScoring
};
