const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const initGemini = () => {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.8,
            }
        });
    }
    return model;
};

// Build the therapeutic prompt with sentiment context
const buildPrompt = (userMessage, sentiment, chatHistory = []) => {
    const historyContext = chatHistory.slice(-6).map(msg =>
        `${msg.role === 'user' ? 'User' : 'Counselor'}: ${msg.content}`
    ).join('\n');

    return `You are MindfulChat, a compassionate and empathetic AI mental health support companion. 
You are NOT a replacement for professional therapy, but you provide a safe space for users to express their feelings.

GUIDELINES:
- Be warm, empathetic, and non-judgmental
- Use active listening techniques (reflect feelings, ask open-ended questions)
- Validate the user's emotions before offering suggestions
- Suggest evidence-based coping strategies when appropriate (breathing exercises, grounding techniques, journaling)
- If the user shows signs of crisis, gently encourage them to reach out to a professional or helpline
- Keep responses concise but caring (2-4 paragraphs max)
- Never diagnose conditions or prescribe medication
- Use a conversational, supportive tone
- VARY your responses — never repeat the same answer. Be specific to what the user said.
- Reference specific things the user mentioned to show you're listening

DETECTED EMOTIONAL STATE: ${sentiment.label} (confidence: ${(sentiment.confidence * 100).toFixed(1)}%)

${historyContext ? `RECENT CONVERSATION:\n${historyContext}\n` : ''}
USER MESSAGE: ${userMessage}

Respond as MindfulChat with empathy and emotional intelligence. Be SPECIFIC to the user's message, don't give generic responses:`;
};

// Helper: sleep for ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate response with retry logic for rate limits
const callGeminiWithRetry = async (prompt, maxRetries = 3) => {
    const geminiModel = initGemini();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await geminiModel.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            if (error.status === 429 && attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
                console.log(`⏳ Gemini rate limited. Retrying in ${waitTime / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(waitTime);
            } else {
                throw error;
            }
        }
    }
};

// Sentiment-aware fallback responses (used when Gemini is unavailable)
const FALLBACK_RESPONSES = {
    depressed: [
        "I can sense you're going through a really heavy time right now. Depression can make everything feel so much harder, and I want you to know that what you're feeling is real and valid. Have you been able to talk to anyone close to you about how you've been feeling? Sometimes even a small connection can make a difference. 💙",
        "It sounds like you're carrying a lot of weight right now. Please know that feeling this way doesn't define who you are — it's something you're experiencing, not something you are. Would it help to try a small grounding exercise together? Sometimes focusing on our senses can bring a moment of relief. 🌿",
        "Thank you for sharing that with me. It takes courage to express these feelings. I want you to remember that it's okay to not be okay, and reaching out — even here — is a sign of strength. What's one small thing that used to bring you comfort? 💜"
    ],
    anxious: [
        "I hear that anxiety is making things really difficult for you. That constant worry can be so exhausting. Let's try something together — take a slow, deep breath in for 4 counts, hold for 4, and breathe out for 6. Sometimes our body needs that signal to calm down before our mind can follow. 🌊",
        "Anxiety can feel so overwhelming, like your mind won't stop racing. You're not alone in this. One technique that many people find helpful is the 5-4-3-2-1 grounding exercise: name 5 things you can see, 4 you can touch, 3 you hear, 2 you smell, and 1 you taste. Would you like to try it? 🍃",
        "I understand how draining constant anxiety can be. It's like your brain is stuck in alert mode. What specifically is driving your anxiety right now? Sometimes naming our fears can take away some of their power. I'm here to listen. 💙"
    ],
    stressed: [
        "It sounds like you have a lot on your plate right now. Stress can really build up when we feel like we're being pulled in too many directions. What feels like the most pressing thing right now? Sometimes breaking it down into smaller pieces makes it more manageable. 🌟",
        "I can tell you're under a lot of pressure. Remember — you don't have to solve everything at once. What's one thing you could take off your plate today, even temporarily? You deserve a moment to breathe. 🌿",
        "Stress has a way of making us forget to take care of ourselves. When did you last do something just for you? Even 10 minutes of something you enjoy — music, a walk, a cup of tea — can help reset your stress levels. What sounds good to you? ☕"
    ],
    angry: [
        "I can understand why you'd feel frustrated. Anger is often a signal that something important to us isn't being met. What's at the heart of what's bothering you? Sometimes understanding the 'why' behind our anger can help us figure out what to do next. 🔥",
        "Those feelings of anger are completely valid. It's important to let yourself feel them rather than push them away. One thing that can help in the moment is to try tensing all your muscles for 5 seconds, then releasing completely. It gives the anger somewhere to go physically. Want to try that? 💪",
        "It sounds like something has really gotten under your skin. That's okay — anger is a natural emotion. What would feel most helpful right now: venting about it, figuring out a solution, or just being heard? I'm here for whatever you need. 💙"
    ],
    lonely: [
        "Feeling lonely can be one of the most painful experiences, and I want you to know that reaching out here shows real courage. You're not as alone as it might feel. What kind of connection are you missing most right now? 💙",
        "Loneliness has a way of convincing us that nobody cares, but that's the loneliness talking, not the truth. Is there someone — even someone you haven't spoken to in a while — you might feel comfortable reaching out to? Sometimes reconnection starts with a simple message. 🌟",
        "I hear you, and I want you to know that your need for connection is completely natural and human. Even though I'm an AI, I genuinely care about how you're feeling. What's one small social step you could take today? It doesn't have to be big. 💜"
    ],
    happy: [
        "That's wonderful to hear! 😊 It's so important to acknowledge and celebrate the good moments. What's contributing to this positive feeling? Focusing on what's going well can help build resilience for tougher days.",
        "I'm so glad you're feeling good! ✨ These moments matter — they remind us that joy is always possible. What's been making you feel this way? I'd love to hear about it!",
        "That makes me really happy to hear! 🌟 Positive moments are worth savoring. Try to really soak in this feeling — noticing and remembering good times can be a powerful tool for your mental wellbeing."
    ],
    neutral: [
        "Thank you for sharing. I'm here to listen and support you in whatever way helps most. How are you really doing today? Sometimes there's more beneath the surface that we don't always express right away. 💙",
        "I appreciate you reaching out. What's on your mind today? Whether it's something big or small, I'm here to chat about whatever feels important to you. 🌿",
        "It's good to hear from you. How has your day been going? I'm curious about what's been on your mind — sometimes even everyday worries deserve some attention. 💜"
    ]
};

const getFallbackResponse = (sentiment) => {
    const label = sentiment?.label || 'neutral';
    const responses = FALLBACK_RESPONSES[label] || FALLBACK_RESPONSES.neutral;
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
};

// Generate response using Gemini
exports.generateResponse = async (userMessage, sentiment, chatHistory = []) => {
    try {
        const prompt = buildPrompt(userMessage, sentiment, chatHistory);
        const text = await callGeminiWithRetry(prompt);
        return text;
    } catch (error) {
        console.error('Gemini API error:', error.message || error);

        // Return sentiment-aware varied fallback
        return getFallbackResponse(sentiment);
    }
};
