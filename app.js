require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ─── Security Middleware ──────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for frontend
}));
app.use(cors());

// ─── Rate Limiting ────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ─── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────
app.use(morgan('dev'));

// ─── Static Files ─────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// ─── Health Check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve Frontend ───────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});

// ─── Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server ─────────────────────────────────────
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    // Start HTTP server first (so frontend is always accessible)
    app.listen(PORT, () => {
        console.log(`\n🧠 MindfulChat Server running on http://localhost:${PORT}`);
        console.log(`📊 Admin Panel: http://localhost:${PORT}/admin.html`);
        console.log(`💬 Chat UI: http://localhost:${PORT}\n`);
    });

    // Connect to MongoDB (non-blocking — retries if unavailable)
    try {
        await connectDB();
    } catch (error) {
        console.warn('⚠️ MongoDB not available yet. API routes will fail until connected.');
        console.warn('   Make sure MongoDB is running and MONGO_URI is correct in .env');
    }
};

startServer();
