const User = require('../models/User');
const Chat = require('../models/Chat');

// Get all users (admin)
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        console.error('Admin getUsers error:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
};

// Edit user (admin)
exports.editUser = async (req, res) => {
    try {
        const { username, email, role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { username, email, role },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({ message: 'User updated successfully.', user });
    } catch (error) {
        console.error('Admin editUser error:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
};

// Delete user (admin)
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Also delete user's chats
        await Chat.deleteMany({ userId: req.params.id });

        res.json({ message: 'User and associated chats deleted successfully.' });
    } catch (error) {
        console.error('Admin deleteUser error:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
};

// Get all chats (admin)
exports.getChats = async (req, res) => {
    try {
        const chats = await Chat.find()
            .populate('userId', 'username email')
            .sort({ updatedAt: -1 })
            .select('userId title messages createdAt updatedAt');

        res.json({ chats });
    } catch (error) {
        console.error('Admin getChats error:', error);
        res.status(500).json({ error: 'Failed to fetch chats.' });
    }
};

// Get single chat (admin)
exports.getChatById = async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id)
            .populate('userId', 'username email');

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found.' });
        }

        res.json({ chat });
    } catch (error) {
        console.error('Admin getChatById error:', error);
        res.status(500).json({ error: 'Failed to fetch chat.' });
    }
};

// Get dashboard stats (admin)
exports.getDashboard = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalChats = await Chat.countDocuments();
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('-password');
        const recentChats = await Chat.find()
            .populate('userId', 'username')
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('userId title updatedAt');

        // Count crisis chats
        const crisisChats = await Chat.countDocuments({ 'messages.isCrisis': true });

        res.json({
            stats: { totalUsers, totalChats, crisisChats },
            recentUsers,
            recentChats
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
};
