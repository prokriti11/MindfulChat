const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// All admin routes require auth + admin middleware
router.use(auth, admin);

// GET /api/admin/dashboard — Dashboard stats
router.get('/dashboard', adminController.getDashboard);

// GET /api/admin/users — List all users
router.get('/users', adminController.getUsers);

// PATCH /api/admin/user/:id — Edit user
router.patch('/user/:id', adminController.editUser);

// DELETE /api/admin/user/:id — Delete user
router.delete('/user/:id', adminController.deleteUser);

// GET /api/admin/chats — List all chats
router.get('/chats', adminController.getChats);

// GET /api/admin/chat/:id — Get chat by ID
router.get('/chat/:id', adminController.getChatById);

module.exports = router;
