const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    sentiment: {
        label: { type: String, default: null },
        confidence: { type: Number, default: null }
    },
    isCrisis: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'New Conversation'
    },
    moodState: {
        stage: {
            type: String,
            enum: ['greeting', 'q1_duration', 'q2_impact', 'q3_support', 'assessed'],
            default: 'greeting'
        },
        mood: { type: String, default: null },
        duration: { type: String, default: null },
        impact: { type: String, default: null },
        support: { type: String, default: null }
    },
    messages: [messageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

chatSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Chat', chatSchema);
