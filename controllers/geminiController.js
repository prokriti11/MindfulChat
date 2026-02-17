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
                temperature: 0.7,
            }
        });
    }
    return model;
};

// Build the therapeutic prompt with sentiment context and mood data
const buildPrompt = (userMessage, sentiment, chatHistory = [], moodContext = null) => {
    const historyContext = chatHistory.slice(-6).map(msg =>
        `${msg.role === 'user' ? 'User' : 'Counselor'}: ${msg.content}`
    ).join('\n');

    let moodSection = '';
    if (moodContext && moodContext.mood) {
        moodSection = `
USER'S MOOD ASSESSMENT (collected at start of conversation):
- Current mood: ${moodContext.mood}
- Duration: ${moodContext.duration || 'Not shared'}
- Impact on daily life: ${moodContext.impact || 'Not shared'}
- Support system: ${moodContext.support || 'Not shared'}

Use this mood context to provide TAILORED, SPECIFIC support. Reference their specific situation.
`;
    }

    return `You are MindfulChat, a compassionate AI mental health support companion.
You are NOT a therapist or medical professional. You provide a safe space for emotional support.

═══ SCOPE & BOUNDARIES ═══
✅ YOU CAN:
- Provide emotional support, active listening, and empathy
- Guide users through evidence-based coping techniques (breathing exercises, grounding, journaling, progressive muscle relaxation)
- Help users identify and label their emotions
- Suggest healthy coping strategies
- Encourage professional help when appropriate
- Share psychoeducation about common mental health topics

❌ YOU CANNOT (politely redirect if asked):
- Diagnose mental health conditions
- Prescribe or recommend medication
- Provide medical advice
- Answer non-mental-health questions (geography, math, trivia, coding, etc.)
- Replace professional therapy or counseling

If the user asks something outside your scope (e.g., "where is Taj Mahal", "solve this math problem", "write code for me"), respond ONLY with:
"I'm here specifically for mental health and emotional support. 💙 I'm not the right place for that question, but I'd love to help if there's anything on your mind emotionally. How are you feeling today?"

═══ RESPONSE RULES ═══
1. NEVER start with or use these phrases:
   - "Thank you for sharing"
   - "I appreciate you reaching out"
   - "Thank you for opening up"
   - "I hear you, and I want you to know that your feelings are valid"
   - Any variation of generic gratitude openers
   
2. BE ACTIONABLE: When a user asks for an exercise or technique:
   - Walk them through it STEP BY STEP
   - Use numbered steps
   - Include timing (e.g., "breathe in for 4 seconds")
   - Ask them to try it right now and share how it felt
   
   Example: If they say "help me with grounding", actually guide them:
   "Let's try the 5-4-3-2-1 grounding technique right now:
   1. 👀 Name **5 things** you can see around you
   2. ✋ Name **4 things** you can touch
   3. 👂 Name **3 things** you can hear
   4. 👃 Name **2 things** you can smell
   5. 👅 Name **1 thing** you can taste
   
   Take your time with each one. What are the 5 things you can see?"

3. BE SPECIFIC: Reference what the user actually said. Don't give cookie-cutter responses.

4. VARY your responses: Never repeat the same structure or phrases across messages.

5. Keep responses SHORT and focused (1-2 paragraphs max). Get to the point fast.

6. Use a conversational, natural tone — like a caring friend, not a textbook.

7. DIRECTLY address what the user said. If they mention an exam, talk about exam stress. If they mention work, talk about work pressure. Be SPECIFIC.

8. If the user shows signs of crisis, ALWAYS include these helpline numbers:
   📞 **988 Suicide & Crisis Lifeline** (US): Call or text 988
   📞 **Crisis Text Line**: Text HOME to 741741
   📞 **iCall (India)**: 9152987821
   📞 **Vandrevala Foundation (India)**: 1860-2662-345

═══ CONTEXT ═══
DETECTED EMOTIONAL STATE: ${sentiment.label} (confidence: ${(sentiment.confidence * 100).toFixed(1)}%)

${moodSection}
${historyContext ? `RECENT CONVERSATION:\n${historyContext}\n` : ''}
USER MESSAGE: ${userMessage}

Respond as MindfulChat. Be specific, actionable, and warm. DO NOT use banned phrases:`;
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
                const waitTime = Math.pow(2, attempt + 1) * 1000;
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
        "It sounds like you're going through a heavy time right now. Depression can make everything feel so much harder — what you're feeling is real and valid. Have you been able to talk to anyone close to you about this? Even a small connection can help. 💙",
        "I can sense the weight you're carrying. Let's try something small right now — can you name one thing, no matter how tiny, that brought you even a flicker of comfort recently? Sometimes anchoring to small moments helps. 🌿",
        "What you're experiencing sounds really tough. You don't have to face it alone. Would you like me to guide you through a gentle breathing exercise? It won't fix everything, but it can bring a moment of calm. 💜"
    ],
    anxious: [
        "Anxiety can feel like your mind is stuck on overdrive. Let's try to slow it down together — breathe in slowly for 4 counts, hold for 4, breathe out for 6. Try it right now with me. Ready? In... 2... 3... 4... Hold... 2... 3... 4... Out... 2... 3... 4... 5... 6. How did that feel? 🌊",
        "When anxiety takes over, grounding yourself in the present moment can help. Let's try the 5-4-3-2-1 technique: name 5 things you can see right now. I'll guide you through the rest after. 🍃",
        "Racing thoughts are exhausting. What's the biggest worry on your mind right now? Sometimes naming it specifically takes away some of its power. I'm here to work through it with you. 💙"
    ],
    stressed: [
        "Sounds like you have a lot on your plate. Let's break it down — what feels like the MOST pressing thing right now? Just one thing. We'll start there. 🌟",
        "When stress piles up, we forget to breathe. Literally. Try this: put one hand on your chest and one on your belly. Take 3 slow breaths, feeling your belly rise. This activates your body's calm-down system. Let me know when you've done it. 🌿",
        "Stress makes everything feel urgent and overwhelming. But here's the thing — you don't have to solve everything at once. What's ONE thing you could take off your plate today, even temporarily? ☕"
    ],
    angry: [
        "That frustration sounds really valid. Anger is usually a signal that something important to you isn't being met. What's at the core of what's bothering you? Let's dig into that. 🔥",
        "When anger is running hot, your body needs a release. Try this: clench your fists as tight as you can for 5 seconds... then release completely. Feel the difference? Do it 3 times. It gives the tension somewhere to go. 💪",
        "Something has clearly gotten under your skin, and that's okay. What would help most right now — venting about it, working toward a solution, or just being heard? I'm here for whatever you need. 💙"
    ],
    lonely: [
        "Loneliness has a way of convincing you that nobody cares — but that's the loneliness talking, not reality. Is there someone, even someone you haven't spoken to in a while, you could send a simple message to? Reconnection often starts smaller than we expect. 🌟",
        "Feeling disconnected can be incredibly painful. Let's try something — close your eyes and think of one person who has made you feel seen or valued, even once. Hold that memory for a moment. Connection lives in moments like those. 💙",
        "Your need for connection is deeply human. Even reaching out here shows courage. What kind of connection are you missing most — someone to talk to, physical presence, or feeling understood? 💜"
    ],
    happy: [
        "That's great to hear! 😊 What's been going well? Savoring positive moments actually builds resilience for tougher days — so let's soak this one in. Tell me more!",
        "I love that energy! ✨ What's contributing to this good feeling? The more specific you can name it, the easier it is to recreate it when you need a boost.",
        "That genuinely makes me happy to hear! 🌟 Try to really notice how this feels in your body right now — warmth, lightness, energy? Anchoring good feelings physically helps you access them later."
    ],
    neutral: [
        "Hey! How are you really doing today? Sometimes we say \"fine\" out of habit, but there might be more going on below the surface. What's actually on your mind? 💙",
        "Good to have you here. What's been occupying your thoughts lately? Whether it's something big or small, I'm here to chat about it. 🌿",
        "How has your day been going? I'm curious about what's on your mind — even everyday worries deserve some attention. 💜"
    ]
};

const getFallbackResponse = (sentiment) => {
    const label = sentiment?.label || 'neutral';
    const responses = FALLBACK_RESPONSES[label] || FALLBACK_RESPONSES.neutral;
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
};

// Generate response using Gemini
exports.generateResponse = async (userMessage, sentiment, chatHistory = [], moodContext = null) => {
    try {
        const prompt = buildPrompt(userMessage, sentiment, chatHistory, moodContext);
        const text = await callGeminiWithRetry(prompt);
        return text;
    } catch (error) {
        console.error('Gemini API error:', error.message || error);
        return getFallbackResponse(sentiment);
    }
};
