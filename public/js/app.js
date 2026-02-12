// ─── MindfulChat Frontend Logic ──────────────────────
const API_BASE = '';
let currentChatId = null;
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

// ─── Auth Check ─────────────────────────────────────
if (!token || !user) {
    window.location.href = '/login.html';
}

// ─── Initialize ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupUser();
    loadChatHistory();
    setupInput();
    setupResponsive();
});

function setupUser() {
    if (user) {
        document.getElementById('userName').textContent = user.username || 'User';
        document.getElementById('userEmail').textContent = user.email || '';
        document.getElementById('userAvatar').textContent = (user.username || 'U')[0].toUpperCase();
    }
}

// ─── Input Handling ─────────────────────────────────
function setupInput() {
    const input = document.getElementById('messageInput');

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Enter to send (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ─── Responsive Sidebar ─────────────────────────────
function setupResponsive() {
    const menuBtn = document.getElementById('menuBtn');
    if (window.innerWidth <= 768) {
        menuBtn.style.display = 'block';
    }
    window.addEventListener('resize', () => {
        menuBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ─── Send Message ───────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    // Show chat area, hide welcome
    showChatArea();

    // Add user message to UI
    addMessage('user', message);

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Show typing indicator
    showTyping(true);

    // Disable send button
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message,
                chatId: currentChatId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send message');
        }

        // Update chat ID
        currentChatId = data.chatId;

        // Show sentiment badge
        if (data.sentiment) {
            updateSentimentBadge(data.sentiment);
        }

        // Show crisis alert if detected
        if (data.isCrisis) {
            showCrisisAlert();
        }

        // Add bot response
        addMessage('assistant', data.response, data.sentiment);

        // Refresh chat list
        loadChatHistory();

    } catch (error) {
        console.error('Send error:', error);
        addMessage('assistant', '⚠️ I apologize, but I\'m having trouble responding right now. Please try again in a moment. I\'m here for you. 💙');
    } finally {
        showTyping(false);
        sendBtn.disabled = false;
    }
}

// ─── Quick Prompts ──────────────────────────────────
function sendQuickPrompt(message) {
    document.getElementById('messageInput').value = message;
    sendMessage();
}

// ─── UI Helpers ─────────────────────────────────────
function showChatArea() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('messagesContainer').style.display = 'flex';
}

function showWelcome() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('messagesContainer').style.display = 'none';
    document.getElementById('messagesContainer').innerHTML = '';
    document.getElementById('currentSentiment').innerHTML = '';
}

function addMessage(role, content, sentiment = null) {
    const container = document.getElementById('messagesContainer');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarContent = role === 'user'
        ? (user?.username || 'U')[0].toUpperCase()
        : '🧠';

    // Format content - convert markdown-like bold
    const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    let sentimentHtml = '';
    if (sentiment && role === 'user') {
        sentimentHtml = `
      <div class="message-meta">
        <span class="sentiment-tag ${sentiment.sentiment}">${getSentimentEmoji(sentiment.sentiment)} ${sentiment.sentiment}</span>
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
    } else {
        sentimentHtml = `
      <div class="message-meta">
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
    }

    messageDiv.innerHTML = `
    <div class="message-avatar">${avatarContent}</div>
    <div>
      <div class="message-content">${formattedContent}</div>
      ${sentimentHtml}
    </div>
  `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function getSentimentEmoji(sentiment) {
    const emojiMap = {
        happy: '😊',
        depressed: '😢',
        anxious: '😰',
        stressed: '😤',
        angry: '😡',
        lonely: '😔',
        neutral: '😐'
    };
    return emojiMap[sentiment] || '😐';
}

function updateSentimentBadge(sentiment) {
    const container = document.getElementById('currentSentiment');
    container.innerHTML = `
    <span class="sentiment-badge sentiment-tag ${sentiment.sentiment}">
      ${getSentimentEmoji(sentiment.sentiment)} ${sentiment.sentiment} · ${(sentiment.confidence * 100).toFixed(0)}%
    </span>`;
}

function showTyping(visible) {
    document.getElementById('typingIndicator').classList.toggle('visible', visible);
    if (visible) {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }
}

function showCrisisAlert() {
    // Remove existing alert if any
    const existing = document.querySelector('.crisis-alert');
    if (existing) existing.remove();

    const alert = document.createElement('div');
    alert.className = 'crisis-alert';
    alert.innerHTML = `
    <h4>🆘 Crisis Resources Available</h4>
    <p style="color: var(--text-secondary); font-size: 0.88rem;">
      If you're in immediate danger, please contact:
      <strong style="color: var(--text-primary);">988 Suicide & Crisis Lifeline (call/text 988)</strong> or
      <strong style="color: var(--text-primary);">Crisis Text Line (text HOME to 741741)</strong>
    </p>`;

    const container = document.getElementById('messagesContainer');
    container.parentElement.insertBefore(alert, container.nextSibling);
}

// ─── Chat History ───────────────────────────────────
async function loadChatHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/chat/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) return logout();
            return;
        }

        const data = await response.json();
        renderChatList(data.chats);
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

function renderChatList(chats) {
    const list = document.getElementById('chatList');
    list.innerHTML = '';

    if (!chats || chats.length === 0) {
        list.innerHTML = '<p style="padding: 16px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No conversations yet</p>';
        return;
    }

    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-list-item ${chat._id === currentChatId ? 'active' : ''}`;
        item.onclick = () => loadChat(chat._id);
        item.innerHTML = `💬 ${chat.title || 'Untitled'}`;
        list.appendChild(item);
    });
}

async function loadChat(chatId) {
    try {
        const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load chat');

        const data = await response.json();
        currentChatId = chatId;

        // Show chat area
        showChatArea();

        // Clear and render messages
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        data.chat.messages.forEach(msg => {
            addMessage(msg.role, msg.content, msg.sentiment?.label ? msg.sentiment : null);
        });

        // Update active state
        document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
        event.target.closest('.chat-list-item')?.classList.add('active');

        // Update title
        document.getElementById('chatTitle').textContent = data.chat.title || 'MindfulChat';

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    } catch (error) {
        console.error('Load chat error:', error);
    }
}

function startNewChat() {
    currentChatId = null;
    showWelcome();
    document.getElementById('chatTitle').textContent = 'MindfulChat';
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
}

// ─── Auth ───────────────────────────────────────────
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// ─── Toast ──────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
