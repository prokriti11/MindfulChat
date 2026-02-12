// ─── MindfulChat Admin Panel Logic ──────────────────
const API_BASE = '';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

// Auth check
if (!token || !user) {
    window.location.href = '/login.html';
}

// Admin check
if (user && user.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    window.location.href = '/';
}

// ─── Initialize ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadUsers();
    loadChats();
});

// ─── API Helper ─────────────────────────────────────
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        if (response.status === 401) return logout();
        throw new Error(data.error || 'API error');
    }

    return data;
}

// ─── Dashboard ──────────────────────────────────────
async function loadDashboard() {
    try {
        const data = await apiCall('/api/admin/dashboard');
        document.getElementById('totalUsers').textContent = data.stats.totalUsers;
        document.getElementById('totalChats').textContent = data.stats.totalChats;
        document.getElementById('crisisChats').textContent = data.stats.crisisChats;
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// ─── Users ──────────────────────────────────────────
async function loadUsers() {
    try {
        const data = await apiCall('/api/admin/users');
        renderUsers(data.users);
    } catch (error) {
        console.error('Users error:', error);
        document.getElementById('usersTableBody').innerHTML =
            '<tr><td colspan="5" style="color: var(--danger);">Failed to load users</td></tr>';
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="color: var(--text-muted);">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${escapeHtml(u.username)}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="role-badge ${u.role}">${u.role}</span></td>
      <td>${new Date(u.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="action-btn edit" onclick="editUser('${u._id}', '${escapeHtml(u.username)}', '${escapeHtml(u.email)}', '${u.role}')">Edit</button>
        <button class="action-btn delete" onclick="deleteUser('${u._id}', '${escapeHtml(u.username)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

// ─── Edit User ──────────────────────────────────────
function editUser(id, username, email, role) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUsername').value = username;
    document.getElementById('editEmail').value = email;
    document.getElementById('editRole').value = role;
    document.getElementById('editModal').classList.add('visible');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('visible');
}

async function saveUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('editUsername').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const role = document.getElementById('editRole').value;

    try {
        await apiCall(`/api/admin/user/${id}`, 'PATCH', { username, email, role });
        closeModal();
        loadUsers();
        loadDashboard();
        showToast('User updated successfully!');
    } catch (error) {
        alert('Failed to update user: ' + error.message);
    }
}

// ─── Delete User ────────────────────────────────────
async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}" and all their chats? This cannot be undone.`)) return;

    try {
        await apiCall(`/api/admin/user/${id}`, 'DELETE');
        loadUsers();
        loadChats();
        loadDashboard();
        showToast('User deleted successfully!');
    } catch (error) {
        alert('Failed to delete user: ' + error.message);
    }
}

// ─── Chats ──────────────────────────────────────────
async function loadChats() {
    try {
        const data = await apiCall('/api/admin/chats');
        renderChats(data.chats);
    } catch (error) {
        console.error('Chats error:', error);
        document.getElementById('chatsTableBody').innerHTML =
            '<tr><td colspan="5" style="color: var(--danger);">Failed to load chats</td></tr>';
    }
}

function renderChats(chats) {
    const tbody = document.getElementById('chatsTableBody');

    if (!chats || chats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="color: var(--text-muted);">No conversations found</td></tr>';
        return;
    }

    tbody.innerHTML = chats.map(c => `
    <tr>
      <td>${c.userId ? escapeHtml(c.userId.username) : 'Deleted User'}</td>
      <td>${escapeHtml(c.title || 'Untitled')}</td>
      <td>${c.messages ? c.messages.length : 0}</td>
      <td>${new Date(c.updatedAt).toLocaleDateString()}</td>
      <td>
        <button class="action-btn edit" onclick="viewChat('${c._id}')">View</button>
      </td>
    </tr>
  `).join('');
}

// ─── View Chat ──────────────────────────────────────
async function viewChat(chatId) {
    try {
        const data = await apiCall(`/api/admin/chat/${chatId}`);
        const chat = data.chat;

        document.getElementById('chatModalTitle').textContent = chat.title || 'Chat Details';

        const content = chat.messages.map(msg => `
      <div style="margin-bottom: 12px; padding: 10px 14px; background: ${msg.role === 'user' ? 'rgba(124, 92, 252, 0.1)' : 'var(--bg-glass)'}; border-radius: 10px;">
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 4px;">
          <strong>${msg.role === 'user' ? '👤 User' : '🧠 MindfulChat'}</strong>
          ${msg.sentiment?.label ? `<span class="sentiment-tag ${msg.sentiment.label}" style="margin-left: 8px;">${msg.sentiment.label}</span>` : ''}
          ${msg.isCrisis ? '<span style="color: var(--danger); margin-left: 8px;">🆘 CRISIS</span>' : ''}
        </div>
        <div style="font-size: 0.9rem;">${escapeHtml(msg.content).substring(0, 500)}</div>
      </div>
    `).join('');

        document.getElementById('chatModalContent').innerHTML = content;
        document.getElementById('chatModal').classList.add('visible');
    } catch (error) {
        alert('Failed to load chat: ' + error.message);
    }
}

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('visible');
}

// ─── Helpers ────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
