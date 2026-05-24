const API_BASE = window.location.origin;
const SESSION_KEY = 'chatbot_session_id';

const chatMessages = document.getElementById('chatMessages');
const quickActions = document.getElementById('quickActions');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const statusBadge = document.getElementById('statusBadge');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const sessionHint = document.getElementById('sessionHint');
const linkWebsite = document.getElementById('linkWebsite');
const linkFacebook = document.getElementById('linkFacebook');
const footerWebsite = document.getElementById('footerWebsite');
const footerFacebook = document.getElementById('footerFacebook');
const infoPhone = document.getElementById('infoPhone');
const infoEmail = document.getElementById('infoEmail');
const infoAddress = document.getElementById('infoAddress');
const footerPhone = document.getElementById('footerPhone');
const footerEmail = document.getElementById('footerEmail');
const footerAddress = document.getElementById('footerAddress');

let history = [];
let displayMessages = [];
let sessionId = null;
let menuData = null;
let isLoading = false;
let saveTimer = null;

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/Trạng thái: Còn sách/g, 'Trạng thái: <span class="status-available">Còn sách</span>')
    .replace(/Trạng thái: Đang mượn/g, 'Trạng thái: <span class="status-borrowed">Đang mượn</span>')
    .replace(/\n/g, '<br>');
}

function renderMessageToDOM(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.role}${msg.extraClass ? ` ${msg.extraClass}` : ''}`;
  div.innerHTML = formatText(msg.content) + (msg.meta ? `<span class="meta">${msg.meta}</span>` : '');
  chatMessages.appendChild(div);
}

function addMessage(content, role, meta = '', extraClass = '') {
  const msg = { role, content, meta, extraClass };
  displayMessages.push(msg);
  renderMessageToDOM(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  scheduleSaveSession();
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'typing';
  div.id = 'typingIndicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
}

function setLoading(loading) {
  isLoading = loading;
  sendBtn.disabled = loading;
  sendBtn.classList.toggle('loading', loading);
  messageInput.disabled = loading;
  searchBtn.disabled = loading;
  searchInput.disabled = loading;
  if (clearChatBtn) clearChatBtn.disabled = loading;
  quickActions.querySelectorAll('button').forEach((btn) => {
    btn.disabled = loading;
  });
}

function sourceLabel(source, model, webSearch) {
  if (source === 'ai') {
    const tag = webSearch ? 'AI + Web' : 'AI';
    return `${tag} (${model || 'gpt-4o-mini'})`;
  }
  if (source === 'search') return 'Tra cứu OPAC';
  return '';
}

function setSessionHint(text, saved = false) {
  if (!sessionHint) return;
  sessionHint.textContent = text;
  sessionHint.classList.toggle('saved', saved);
}

async function ensureSession() {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const res = await fetch(`${API_BASE}/api/session/${stored}`);
      if (res.ok) {
        sessionId = stored;
        return stored;
      }
    } catch {
      /* tạo session mới */
    }
  }

  const res = await fetch(`${API_BASE}/api/session`, { method: 'POST' });
  const data = await res.json();
  sessionId = data.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function scheduleSaveSession() {
  clearTimeout(saveTimer);
  setSessionHint('Đang lưu...');
  saveTimer = setTimeout(saveSession, 400);
}

async function saveSession() {
  if (!sessionId) return;

  try {
    const res = await fetch(`${API_BASE}/api/session/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, messages: displayMessages })
    });

    if (res.ok) {
      setSessionHint(`Đã lưu · ${displayMessages.length} tin nhắn`, true);
    } else {
      setSessionHint('Lưu thất bại');
    }
  } catch {
    setSessionHint('Không lưu được hội thoại');
  }
}

async function loadSession() {
  if (!sessionId) return false;

  try {
    const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
    if (!res.ok) return false;

    const data = await res.json();
    if (!data.messages?.length) return false;

    history = data.history || [];
    displayMessages = data.messages || [];
    chatMessages.innerHTML = '';
    displayMessages.forEach(renderMessageToDOM);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    setSessionHint(`Đã khôi phục · ${displayMessages.length} tin nhắn`, true);
    return true;
  } catch {
    return false;
  }
}

function showWelcome() {
  if (menuData?.welcome) {
    addMessage(menuData.welcome, 'bot');
  }
}

async function clearConversation() {
  if (isLoading) return;

  const confirmed = confirm('Xóa toàn bộ hội thoại hiện tại? Hành động này không thể hoàn tác.');
  if (!confirmed) return;

  setLoading(true);

  try {
    if (sessionId) {
      await fetch(`${API_BASE}/api/session/${sessionId}`, { method: 'DELETE' });
    }

    localStorage.removeItem(SESSION_KEY);
    sessionId = null;
    history = [];
    displayMessages = [];
    chatMessages.innerHTML = '';

    await ensureSession();
    showWelcome();
    setSessionHint('Đã xóa hội thoại · bắt đầu mới', true);
  } catch {
    addMessage('Không thể xóa hội thoại. Vui lòng thử lại.', 'bot');
  } finally {
    setLoading(false);
  }
}

function openExternalLink(url, label) {
  window.open(url, '_blank', 'noopener');
  addMessage(`Đang mở **${label}** trong tab mới...`, 'bot', 'Liên kết ngoài');
}

async function performSearch(query) {
  if (!query || isLoading) return;
  setLoading(true);

  addMessage(`Tìm sách: ${query}`, 'user');
  history.push({ role: 'user', content: `Tìm sách: ${query}` });
  showTyping();

  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    hideTyping();

    if (!res.ok) {
      addMessage(data.error || 'Không thể tra cứu.', 'bot');
      return;
    }

    const reply = formatSearchResults(data.query, data.results);
    addMessage(reply, 'bot', sourceLabel('search'), 'search-result');
    history.push({ role: 'assistant', content: reply });
  } catch {
    hideTyping();
    addMessage('Không kết nối được server. Hãy chạy backend trước (npm start).', 'bot');
  } finally {
    setLoading(false);
    searchInput.focus();
  }
}

function formatSearchResults(query, results) {
  if (!results.length) {
    return `Không tìm thấy sách nào với từ khóa **"${query}"**.\n\nGợi ý:\n• Kiểm tra chính tả\n• Thử tìm theo tác giả hoặc ISBN\n• Liên hệ quầy Reference (tầng 1)`;
  }

  const lines = results.map((book, i) => {
    const status = book.status === 'available' ? 'Còn sách' : 'Đang mượn';
    return `${i + 1}. **${book.title}** — ${book.author}\n   Mã kho: ${book.callNumber} | Trạng thái: ${status} | ${book.location}`;
  });

  return `**Kết quả tra cứu "${query}"** (${results.length} sách):\n\n${lines.join('\n\n')}`;
}

async function sendChat({ message, action }) {
  if (isLoading) return;
  setLoading(true);

  if (message) {
    addMessage(message, 'user');
    history.push({ role: 'user', content: message });
  }

  showTyping();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, action, history })
    });

    const data = await res.json();
    hideTyping();

    if (!res.ok) {
      addMessage(data.error || 'Có lỗi xảy ra.', 'bot');
      return;
    }

    const extraClass = data.source === 'search' ? 'search-result' : '';
    addMessage(data.reply, 'bot', sourceLabel(data.source, data.model, data.webSearch), extraClass);
    history.push({ role: 'assistant', content: data.reply });
  } catch {
    hideTyping();
    addMessage('Không kết nối được server. Hãy chạy backend trước (npm start).', 'bot');
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

function renderQuickActions(options) {
  quickActions.innerHTML = '';
  options.forEach((opt, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-btn';
    btn.textContent = opt.label;
    btn.style.animationDelay = `${0.05 + index * 0.06}s`;

    if (opt.type === 'link') {
      btn.addEventListener('click', () => {
        openExternalLink(opt.url, opt.label.replace(/^[^\s]+\s/, ''));
      });
    } else {
      const label = opt.label.replace(/^[^\s]+\s/, '');
      btn.addEventListener('click', () => sendChat({ action: opt.action, message: label }));
    }

    quickActions.appendChild(btn);
  });
}

function setExternalLinks(links) {
  const pairs = [
    [linkWebsite, links.website],
    [linkFacebook, links.facebook],
    [footerWebsite, links.website],
    [footerFacebook, links.facebook]
  ];
  pairs.forEach(([el, url]) => {
    if (el && url) el.href = url;
  });
}

function setLibraryInfo(lib) {
  if (infoAddress) infoAddress.textContent = lib.address;
  if (footerAddress) footerAddress.textContent = lib.address;
  if (infoPhone) {
    infoPhone.textContent = lib.phone;
    infoPhone.href = `tel:${lib.phone.replace(/\D/g, '')}`;
  }
  if (footerPhone) footerPhone.textContent = lib.phone;
  if (infoEmail) {
    infoEmail.textContent = lib.email;
    infoEmail.href = `mailto:${lib.email}`;
  }
  if (footerEmail) footerEmail.textContent = lib.email;
}

async function init() {
  try {
    const [healthRes, menuRes, libraryRes] = await Promise.all([
      fetch(`${API_BASE}/api/health`),
      fetch(`${API_BASE}/api/menu`),
      fetch(`${API_BASE}/api/library`)
    ]);

    if (healthRes.ok) {
      const health = await healthRes.json();
      statusBadge.textContent = `Online · ${health.model}`;
      statusBadge.classList.add('online');
    }

    if (libraryRes.ok) {
      const lib = await libraryRes.json();
      setLibraryInfo(lib);
      setExternalLinks({ website: lib.website, facebook: lib.facebook });
    }

    if (menuRes.ok) {
      menuData = await menuRes.json();
      if (menuData.links) setExternalLinks(menuData.links);
      renderQuickActions(menuData.options);
    }

    await ensureSession();
    const restored = await loadSession();
    if (!restored) {
      showWelcome();
      setSessionHint('Hội thoại mới · tự động lưu JSON', true);
    }
  } catch {
    statusBadge.textContent = 'Offline';
    addMessage('Không kết nối được backend. Chạy: cd backend && npm install && npm start', 'bot');
  }
}

clearChatBtn?.addEventListener('click', clearConversation);

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;
  searchInput.value = '';
  performSearch(query);
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = '';
  sendChat({ message: text });
});

init();
