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

// ─── Begin New Conversation (with mood check-in) ────
async function beginNewConversation() {
    showChatArea();
    showTyping(true);

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/chat/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to start conversation');
        }

        currentChatId = data.chatId;

        // Show bot greeting
        addMessage('assistant', data.response);

        // Show quick reply chips if available
        if (data.quickReplies) {
            renderQuickReplies(data.quickReplies);
        }

        loadChatHistory();

    } catch (error) {
        console.error('Start conversation error:', error);
        addMessage('assistant', '⚠️ I had trouble starting up. Please try again in a moment. 💙');
    } finally {
        showTyping(false);
        sendBtn.disabled = false;
    }
}

// ─── Send Message ───────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    // Show chat area, hide welcome
    showChatArea();

    // Hide any existing quick replies
    hideQuickReplies();

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
        // If no chat started yet, the first message goes via /start then /message
        if (!currentChatId) {
            // Start a new conversation first
            const startResponse = await fetch(`${API_BASE}/api/chat/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const startData = await startResponse.json();
            if (startResponse.ok) {
                currentChatId = startData.chatId;
                // Don't show the greeting since user already typed something
                // The greeting is saved in DB, now send user's actual message
            }
        }

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
            showCrisisBanner();
        }

        // Add bot response
        addMessage('assistant', data.response, data.sentiment);

        // Show quick reply chips if available (mood flow)
        if (data.quickReplies && data.quickReplies.length > 0) {
            renderQuickReplies(data.quickReplies);
        }

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

// ─── Quick Prompts (from welcome screen) ────────────
function sendQuickPrompt(message) {
    document.getElementById('messageInput').value = message;
    sendMessage();
}

// ─── Quick Reply Chips (mood flow) ──────────────────
function renderQuickReplies(replies) {
    const container = document.getElementById('quickRepliesContainer');
    container.innerHTML = '';
    container.style.display = 'flex';

    replies.forEach(reply => {
        const chip = document.createElement('button');
        chip.className = 'quick-reply-chip';
        chip.textContent = reply.label;
        chip.onclick = () => {
            document.getElementById('messageInput').value = reply.value;
            hideQuickReplies();
            sendMessage();
        };
        container.appendChild(chip);
    });

    // Scroll into view
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideQuickReplies() {
    const container = document.getElementById('quickRepliesContainer');
    container.style.display = 'none';
    container.innerHTML = '';
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
    hideQuickReplies();
    closeCrisisBanner();
}

function addMessage(role, content, sentiment = null) {
    const container = document.getElementById('messagesContainer');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarContent = role === 'user'
        ? (user?.username || 'U')[0].toUpperCase()
        : '🧠';

    // Format content - convert markdown-like bold and line breaks
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

// ─── Crisis Banner ──────────────────────────────────
function showCrisisBanner() {
    const banner = document.getElementById('crisisBanner');
    banner.style.display = 'block';
    banner.classList.add('animate-in');
}

function closeCrisisBanner() {
    const banner = document.getElementById('crisisBanner');
    banner.style.display = 'none';
    banner.classList.remove('animate-in');
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

        // Show mood emoji based on mood state
        const moodEmoji = getMoodEmoji(chat.moodState?.mood);
        item.innerHTML = `${moodEmoji} ${chat.title || 'Untitled'}`;
        list.appendChild(item);
    });
}

function getMoodEmoji(mood) {
    if (!mood) return '💬';
    const lower = mood.toLowerCase();
    if (lower.includes('sad') || lower.includes('down') || lower.includes('depress')) return '😔';
    if (lower.includes('anxious') || lower.includes('worr')) return '😰';
    if (lower.includes('stress') || lower.includes('overwhelm')) return '😤';
    if (lower.includes('angry') || lower.includes('frustrat')) return '😡';
    if (lower.includes('lonely') || lower.includes('isolat')) return '😢';
    if (lower.includes('good') || lower.includes('okay') || lower.includes('happy')) return '😊';
    return '💬';
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
        hideQuickReplies();

        // Check if crisis was detected in any message
        const hasCrisis = data.chat.messages.some(msg => msg.isCrisis);
        if (hasCrisis) {
            showCrisisBanner();
        } else {
            closeCrisisBanner();
        }

        // Clear and render messages
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        data.chat.messages.forEach(msg => {
            addMessage(msg.role, msg.content, msg.sentiment?.label ? msg.sentiment : null);
        });

        // Update active state
        document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
        const clickedItem = document.querySelector(`.chat-list-item.active`) || event?.target?.closest('.chat-list-item');
        if (clickedItem) clickedItem.classList.add('active');

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
