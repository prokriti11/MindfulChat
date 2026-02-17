const axios = require('axios');
const Chat = require('../models/Chat');
const geminiController = require('./geminiController');

// ═══ Crisis Detection ═══════════════════════════════════════
const CRISIS_KEYWORDS = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self-harm', 'self harm', 'hurt myself', 'cutting myself',
    'no reason to live', 'better off dead', 'ending it all',
    'overdose', 'jump off', 'hang myself', 'don\'t want to live',
    'wish i was dead', 'i want to die', 'not worth living'
];

const CRISIS_RESPONSE = `🆘 **I'm really concerned about what you've shared, and I want you to know — you are not alone in this.**

What you're feeling right now is temporary, even though it doesn't feel that way. Please reach out to one of these trained professionals who are available **24/7**:

📞 **988 Suicide & Crisis Lifeline (US)**: Call or text **988**
📞 **Crisis Text Line**: Text **HOME** to **741741**
📞 **iCall (India)**: **9152987821**
📞 **Vandrevala Foundation (India)**: **1860-2662-345**
📞 **AASRA (India)**: **9820466726**
🌐 **International Resources**: [IASP Crisis Centres](https://www.iasp.info/resources/Crisis_Centres/)

These counselors are trained, confidential, and free. **You matter**, and reaching out is a sign of incredible strength.

I'm still here for you too — would you like to talk more about what you're going through? 💙`;

const detectCrisis = (message) => {
    const lowerMessage = message.toLowerCase();
    return CRISIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
};

// ═══ Mood Assessment Flow ═══════════════════════════════════

const MOOD_QUESTIONS = {
    greeting: {
        message: `Hey there 💙 Before we begin, I'd love to understand how you're feeling so I can support you better.\n\n**How would you describe your mood right now?**`,
        quickReplies: [
            { label: '😔 Sad / Down', value: 'sad and down' },
            { label: '😰 Anxious / Worried', value: 'anxious and worried' },
            { label: '😤 Stressed / Overwhelmed', value: 'stressed and overwhelmed' },
            { label: '😡 Angry / Frustrated', value: 'angry and frustrated' },
            { label: '😢 Lonely / Isolated', value: 'lonely and isolated' },
            { label: '😊 Good / Okay', value: 'good and okay' },
            { label: '🤷 Not sure', value: 'not sure how I feel' }
        ]
    },
    q1_duration: {
        message: `I appreciate you sharing that. Understanding the bigger picture helps me support you better.\n\n**How long have you been feeling this way?**`,
        quickReplies: [
            { label: '📅 Just today', value: 'just today' },
            { label: '📅 A few days', value: 'a few days' },
            { label: '📅 A few weeks', value: 'a few weeks' },
            { label: '📅 Months or longer', value: 'months or longer' },
            { label: '🔄 It comes and goes', value: 'it comes and goes' }
        ]
    },
    q2_impact: {
        message: `That context really helps. One more important one:\n\n**How is this affecting your daily life?** (sleep, appetite, work, relationships — anything that's changed)`,
        quickReplies: [
            { label: '😴 Trouble sleeping', value: 'having trouble sleeping' },
            { label: '🍽️ Appetite changes', value: 'appetite has changed' },
            { label: '💼 Hard to focus at work', value: 'hard to focus at work or study' },
            { label: '👥 Withdrawing from people', value: 'withdrawing from people' },
            { label: '✅ Managing okay', value: 'managing okay for now' },
            { label: '😓 Everything feels harder', value: 'everything feels harder than usual' }
        ]
    },
    q3_support: {
        message: `Last question, and then we'll dive in:\n\n**Do you have anyone you can talk to about this?** (friends, family, therapist, anyone)`,
        quickReplies: [
            { label: '👥 Yes, I have support', value: 'yes I have people I can talk to' },
            { label: '🤔 Sort of, but it\'s complicated', value: 'sort of but it is complicated' },
            { label: '😔 Not really', value: 'not really, I don\'t have support' },
            { label: '🧑‍⚕️ I see a therapist', value: 'I am seeing a therapist' },
            { label: '🆕 This is my first time talking about it', value: 'this is my first time talking about it' }
        ]
    }
};

// Generate the assessment summary after all questions are answered
const buildAssessmentResponse = (moodState) => {
    const { mood, duration, impact, support } = moodState;

    let response = `Thank you for walking through that with me — it helps me understand where you're coming from. 💙\n\nHere's what I'm hearing:\n`;
    response += `• You're feeling **${mood || 'uncertain about your emotions'}**\n`;
    response += `• This has been going on for **${duration || 'some time'}**\n`;
    response += `• It's affecting you by **${impact || 'impacting your daily life'}**\n`;

    if (support && support.toLowerCase().includes('not really')) {
        response += `• You don't have much support right now — and that makes reaching out here even more meaningful\n`;
    } else if (support && support.toLowerCase().includes('therapist')) {
        response += `• You're working with a therapist, which is great — I'm here as an additional support\n`;
    } else if (support) {
        response += `• On the support side: **${support}**\n`;
    }

    response += `\nI'm here for you. You can vent, ask for a coping technique, or just chat. **What would be most helpful right now?** 🌿`;

    return response;
};

// ═══ Sentiment Service ══════════════════════════════════════

const getSentiment = async (text) => {
    try {
        const sentimentUrl = process.env.SENTIMENT_SERVICE_URL || 'http://localhost:5001';
        const response = await axios.post(`${sentimentUrl}/predict`, { text }, { timeout: 3000 });
        return response.data;
    } catch (error) {
        console.warn('⚠️ Sentiment service unavailable, using default:', error.message);
        return { sentiment: 'neutral', confidence: 0.5 };
    }
};

// ═══ Main Message Handler ═══════════════════════════════════

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

        // ─── Crisis detection (always runs first, regardless of mood stage) ───
        const isCrisis = detectCrisis(message);

        // ─── Get sentiment analysis ───
        const sentimentResult = await getSentiment(message);

        // ─── Find or create chat ───
        let chat;
        if (chatId) {
            chat = await Chat.findOne({ _id: chatId, userId });
        }

        const isNewChat = !chat;
        if (isNewChat) {
            chat = new Chat({
                userId,
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                messages: [],
                moodState: { stage: 'greeting' }
            });
        }

        // ─── Save user message ───
        chat.messages.push({
            role: 'user',
            content: message,
            sentiment: {
                label: sentimentResult.sentiment,
                confidence: sentimentResult.confidence
            },
            isCrisis
        });

        let aiResponse;
        let moodStage = chat.moodState?.stage || 'assessed';
        let quickReplies = null;
        let followUpQuestion = null;

        if (isCrisis) {
            // ─── Crisis always takes priority ───
            aiResponse = CRISIS_RESPONSE;
            // Don't change mood stage during crisis
        } else if (moodStage !== 'assessed') {
            // ─── Mood assessment flow ───
            switch (moodStage) {
                case 'greeting':
                    // User just sent first message — store as mood and advance
                    chat.moodState.mood = message;
                    chat.moodState.stage = 'q1_duration';
                    aiResponse = MOOD_QUESTIONS.q1_duration.message;
                    quickReplies = MOOD_QUESTIONS.q1_duration.quickReplies;
                    followUpQuestion = true;
                    break;

                case 'q1_duration':
                    chat.moodState.duration = message;
                    chat.moodState.stage = 'q2_impact';
                    aiResponse = MOOD_QUESTIONS.q2_impact.message;
                    quickReplies = MOOD_QUESTIONS.q2_impact.quickReplies;
                    followUpQuestion = true;
                    break;

                case 'q2_impact':
                    chat.moodState.impact = message;
                    chat.moodState.stage = 'q3_support';
                    aiResponse = MOOD_QUESTIONS.q3_support.message;
                    quickReplies = MOOD_QUESTIONS.q3_support.quickReplies;
                    followUpQuestion = true;
                    break;

                case 'q3_support':
                    chat.moodState.support = message;
                    chat.moodState.stage = 'assessed';
                    aiResponse = buildAssessmentResponse(chat.moodState);
                    break;
            }
        } else {
            // ─── Normal conversation with Gemini (mood context included) ───
            const chatHistory = chat.messages.slice(-10);
            const moodContext = chat.moodState?.mood ? chat.moodState : null;

            aiResponse = await geminiController.generateResponse(
                message,
                { label: sentimentResult.sentiment, confidence: sentimentResult.confidence },
                chatHistory,
                moodContext
            );
        }

        // ─── Save AI response ───
        chat.messages.push({
            role: 'assistant',
            content: aiResponse,
            isCrisis
        });

        chat.markModified('moodState');
        await chat.save();

        // ─── Build response payload ───
        const responsePayload = {
            response: aiResponse,
            sentiment: sentimentResult,
            isCrisis,
            chatId: chat._id,
            moodStage: chat.moodState?.stage || 'assessed'
        };

        if (quickReplies) {
            responsePayload.quickReplies = quickReplies;
        }
        if (followUpQuestion) {
            responsePayload.followUpQuestion = followUpQuestion;
        }

        res.json(responsePayload);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process message. Please try again.' });
    }
};

// ═══ New Conversation (returns greeting question) ═══════════

exports.startConversation = async (req, res) => {
    try {
        const userId = req.user._id;
        const chat = new Chat({
            userId,
            title: 'New Conversation',
            messages: [],
            moodState: { stage: 'greeting' }
        });

        const greetingMessage = MOOD_QUESTIONS.greeting.message;

        chat.messages.push({
            role: 'assistant',
            content: greetingMessage,
            isCrisis: false
        });

        await chat.save();

        res.json({
            chatId: chat._id,
            response: greetingMessage,
            quickReplies: MOOD_QUESTIONS.greeting.quickReplies,
            moodStage: 'greeting',
            followUpQuestion: true
        });
    } catch (error) {
        console.error('Start conversation error:', error);
        res.status(500).json({ error: 'Failed to start conversation.' });
    }
};

// ═══ Chat History & CRUD ════════════════════════════════════

exports.getHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const chats = await Chat.find({ userId })
            .sort({ updatedAt: -1 })
            .select('title messages createdAt updatedAt moodState');

        res.json({ chats });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
};

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
