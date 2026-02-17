const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// POST /api/chat/start — Start new conversation with mood check-in
router.post('/start', auth, chatController.startConversation);

// POST /api/chat/message — Send message to chatbot
router.post('/message', auth, chatController.sendMessage);

// GET /api/chat/history — Get user's chat history
router.get('/history', auth, chatController.getHistory);

// GET /api/chat/:id — Get single chat
router.get('/:id', auth, chatController.getChat);

// DELETE /api/chat/:id — Delete a chat
router.delete('/:id', auth, chatController.deleteChat);

module.exports = router;
