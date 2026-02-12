const axios = require('axios');
const Chat = require('../models/Chat');
const geminiController = require('./geminiController');

// Crisis keywords for immediate detection
const CRISIS_KEYWORDS = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self-harm', 'self harm', 'hurt myself', 'cutting myself',
    'no reason to live', 'better off dead', 'ending it all',
    'overdose', 'jump off', 'hang myself'
];

// Crisis response message
const CRISIS_RESPONSE = `🆘 **I'm really concerned about what you're sharing, and I want you to know you're not alone.**

If you're in immediate danger, please reach out to one of these resources right now:

📞 **National Suicide Prevention Lifeline**: 988 (call or text)
📞 **Crisis Text Line**: Text HOME to 741741
📞 **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/
📞 **iCall (India)**: 9152987821
📞 **Vandrevala Foundation (India)**: 1860 2662 345

You matter, and there are people who want to help. Please reach out to a trained counselor — they're available 24/7 and everything is confidential. 💙

Would you like to talk more about what you're going through? I'm here to listen.`;

// Check for crisis keywords
const detectCrisis = (message) => {
    const lowerMessage = message.toLowerCase();
    return CRISIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
};

// Get sentiment from Python service
const getSentiment = async (text) => {
    try {
        const sentimentUrl = process.env.SENTIMENT_SERVICE_URL || 'http://localhost:5001';
        const response = await axios.post(`${sentimentUrl}/predict`, { text }, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.warn('⚠️ Sentiment service unavailable, using default:', error.message);
        return { sentiment: 'neutral', confidence: 0.5 };
    }
};

// Send message and get AI response
exports.sendMessage = async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const userId = req.user._id;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }

        if (message.length > 2000) {
            return res.status(400).json({ error: 'Message too long. Maximum 2000 characters.' });
        }

        // Detect crisis
        const isCrisis = detectCrisis(message);

        // Get sentiment analysis
        const sentimentResult = await getSentiment(message);

        let aiResponse;
        if (isCrisis) {
            aiResponse = CRISIS_RESPONSE;
        } else {
            // Find or create chat
            let chat;
            if (chatId) {
                chat = await Chat.findOne({ _id: chatId, userId });
            }

            // Get chat history for context
            const chatHistory = chat ? chat.messages.slice(-10) : [];

            // Generate AI response with sentiment context
            aiResponse = await geminiController.generateResponse(
                message,
                { label: sentimentResult.sentiment, confidence: sentimentResult.confidence },
                chatHistory
            );
        }

        // Save to database
        let chat;
        if (chatId) {
            chat = await Chat.findOne({ _id: chatId, userId });
        }

        if (!chat) {
            chat = new Chat({
                userId,
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                messages: []
            });
        }

        // Add user message
        chat.messages.push({
            role: 'user',
            content: message,
            sentiment: {
                label: sentimentResult.sentiment,
                confidence: sentimentResult.confidence
            },
            isCrisis
        });

        // Add AI response
        chat.messages.push({
            role: 'assistant',
            content: aiResponse,
            isCrisis
        });

        await chat.save();

        res.json({
            response: aiResponse,
            sentiment: sentimentResult,
            isCrisis,
            chatId: chat._id
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process message. Please try again.' });
    }
};

// Get chat history
exports.getHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const chats = await Chat.find({ userId })
            .sort({ updatedAt: -1 })
            .select('title messages createdAt updatedAt');

        res.json({ chats });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
};

// Get single chat
exports.getChat = async (req, res) => {
    try {
        const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found.' });
        }
        res.json({ chat });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Failed to fetch chat.' });
    }
};

// Delete chat
exports.deleteChat = async (req, res) => {
    try {
        const chat = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found.' });
        }
        res.json({ message: 'Chat deleted successfully.' });
    } catch (error) {
        console.error('Delete chat error:', error);
        res.status(500).json({ error: 'Failed to delete chat.' });
    }
};
