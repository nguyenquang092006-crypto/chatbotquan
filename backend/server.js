require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const OpenAI = require('openai');
const library = require('./data/library.json');
const booksList = require('./data/books.json');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ACTION_PROMPTS = {
  intro: 'Hãy giới thiệu về Thư viện UIT: tên đầy đủ, địa chỉ, chức năng, nhiệm vụ và các dịch vụ cơ bản.',
  search_books: 'Hướng dẫn tôi cách tra cứu sách trên OPAC và sử dụng công cụ tìm kiếm sách trong thư viện.',
  guide_card: 'Hướng dẫn chi tiết quy trình làm thẻ thư viện cho sinh viên UIT.',
  guide_borrow: 'Hướng dẫn chi tiết quy trình mượn và trả tài liệu tại thư viện UIT.',
  guide_search: 'Hướng dẫn chi tiết cách tra cứu tài liệu trong thư viện UIT.',
  faq: 'Liệt kê và trả lời ngắn gọn các câu hỏi thường gặp nhất về thư viện UIT.',
  hours: 'Thư viện UIT mở cửa lúc mấy giờ? Cho biết chi tiết lịch làm việc trong tuần.',
  contact: 'Cho tôi thông tin liên hệ đầy đủ của thư viện UIT.'
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const SESSIONS_DIR = path.join(__dirname, 'data', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

function getSessionPath(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function readSession(sessionId) {
  const filePath = getSessionPath(sessionId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeSession(sessionId, data) {
  const payload = {
    sessionId,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: data.history || [],
    messages: data.messages || []
  };
  fs.writeFileSync(getSessionPath(sessionId), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function deleteSession(sessionId) {
  const filePath = getSessionPath(sessionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function searchBooks(query, limit = 8) {
  const normQuery = normalize(query);
  const terms = normQuery.split(/\s+/).filter((t) => t.length >= 2);

  const scored = booksList.map((book) => {
    let score = 0;
    const fields = {
      title: normalize(book.title),
      author: normalize(book.author),
      isbn: normalize(book.isbn),
      category: normalize(book.category),
      keywords: book.keywords.map(normalize).join(' ')
    };

    if (fields.title.includes(normQuery)) score += 10;
    if (fields.author.includes(normQuery)) score += 8;
    if (fields.isbn.includes(normQuery)) score += 10;
    if (fields.category.includes(normQuery)) score += 5;

    for (const term of terms) {
      if (fields.title.includes(term)) score += 4;
      if (fields.author.includes(term)) score += 3;
      if (fields.keywords.includes(term)) score += 3;
      if (fields.category.includes(term)) score += 2;
      if (fields.isbn.includes(term)) score += 5;
    }

    return { book, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.book);
}

function buildSystemPrompt() {
  const bookSample = booksList.slice(0, 8).map((b) => `- ${b.title} (${b.author})`).join('\n');

  return `Bạn là trợ lý ảo chính thức của ${library.name} (${library.shortName}).
Thời điểm hiện tại: tháng 5/2026. Mọi thông tin bạn đưa ra phải chính xác, cập nhật và phù hợp năm 2026.

=== DỮ LIỆU THAM CHIẾU CHÍNH THỨC (ưu tiên cao nhất) ===
- Địa chỉ: ${library.address}
- Điện thoại: ${library.phone} | Email: ${library.email}
- Website: ${library.website} | Facebook: ${library.facebook}
- Giờ mở cửa: ${library.openingHours.weekdays}; ${library.openingHours.saturday}; ${library.openingHours.sunday}
- Chức năng: ${library.functions.join('; ')}
- Dịch vụ: ${library.services.join('; ')}
- Làm thẻ: ${library.guides.lamThe.steps.join(' → ')} (${library.guides.lamThe.note})
- Mượn/trả: ${library.guides.muonTra.steps.join(' → ')} (${library.guides.muonTra.note})
- Tra cứu: ${library.guides.traCuu.steps.join(' → ')} (${library.guides.traCuu.note})
- Một số đầu sách trong kho: 
${bookSample}

=== QUY TẮC BẮT BUỘC ===
1. CHỈ trả lời các câu hỏi liên quan đến thư viện, tra cứu tài liệu, học tập/nghiên cứu tại UIT.
2. Nếu câu hỏi KHÔNG liên quan thư viện → từ chối lịch sự, gợi ý hỏi lại đúng chủ đề. KHÔNG bịa câu trả lời.
3. Ưu tiên dữ liệu tham chiếu ở trên. Khi cần xác minh (giờ mở cửa, quy định, dịch vụ mới), hãy dùng công cụ tìm kiếm web để tra cứu ${library.website} và nguồn chính thống UIT.
4. KHÔNG bịa số liệu, phí phạt, quy định, tên sách, giờ mở cửa. Nếu không chắc → nói rõ và gợi ý liên hệ ${library.phone} hoặc ${library.email}.
5. Trả lời tiếng Việt, thân thiện, ngắn gọn, dùng bullet khi liệt kê.
6. Không trích dẫn FAQ cứng nhắc — trả lời tự nhiên dựa trên ngữ cảnh câu hỏi.`;
}

function buildChatInput(history, userMessage) {
  return [
    ...history.slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    })),
    { role: 'user', content: userMessage }
  ];
}

function extractResponseText(response) {
  if (response.output_text) return response.output_text;

  for (const item of response.output || []) {
    if (item.type === 'message') {
      for (const part of item.content || []) {
        if (part.type === 'output_text' && part.text) return part.text;
        if (part.text) return part.text;
      }
    }
  }

  return null;
}

async function callChatGPT(userMessage, history = []) {
  const instructions = buildSystemPrompt();
  const input = buildChatInput(history, userMessage);

  try {
    const response = await openai.responses.create({
      model: MODEL,
      instructions,
      tools: [{ type: 'web_search_preview' }],
      input,
      temperature: 0.3
    });

    const reply = extractResponseText(response);
    if (reply) {
      return { reply, webSearch: true };
    }
  } catch (err) {
    console.warn('Web search API unavailable, fallback:', err.message);
  }

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: instructions }, ...input],
    max_tokens: 600,
    temperature: 0.3
  });

  const reply =
    completion.choices[0]?.message?.content ||
    'Xin lỗi, tôi chưa trả lời được. Vui lòng thử lại hoặc liên hệ quầy thư viện.';

  return { reply, webSearch: false };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL, library: library.shortName, mode: 'ai-only' });
});

app.get('/api/library', (_req, res) => {
  res.json(library);
});

app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);

  if (!query) {
    return res.status(400).json({ error: 'Tham số q (từ khóa tìm kiếm) là bắt buộc' });
  }

  const results = searchBooks(query, limit);
  res.json({ query, total: results.length, results });
});

app.get('/api/menu', (_req, res) => {
  res.json({
    welcome: `Xin chào! Tôi là trợ lý AI của ${library.shortName}. Mọi câu hỏi sẽ được trả lời bằng ChatGPT — hãy hỏi bất cứ điều gì về thư viện nhé!`,
    links: {
      website: library.website,
      facebook: library.facebook
    },
    options: [
      { id: 'intro', label: '📚 Giới thiệu thư viện', action: 'intro' },
      { id: 'search_books', label: '🔎 Tìm sách OPAC', action: 'search_books' },
      { id: 'guide_card', label: '🪪 Làm thẻ thư viện', action: 'guide_card' },
      { id: 'guide_borrow', label: '📖 Mượn/Trả tài liệu', action: 'guide_borrow' },
      { id: 'guide_search', label: '🔍 Hướng dẫn tra cứu', action: 'guide_search' },
      { id: 'faq', label: '❓ Hỏi đáp thư viện', action: 'faq' },
      { id: 'hours', label: '🕐 Giờ mở cửa', action: 'hours' },
      { id: 'contact', label: '📞 Liên hệ', action: 'contact' },
      { id: 'website', label: '🌐 Website', action: 'open_website', url: library.website, type: 'link' },
      { id: 'facebook', label: '📘 Facebook', action: 'open_facebook', url: library.facebook, type: 'link' }
    ]
  });
});

app.post('/api/session', (_req, res) => {
  const sessionId = crypto.randomUUID();
  const session = writeSession(sessionId, { history: [], messages: [] });
  res.status(201).json(session);
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Session ID không hợp lệ' });
  }

  const session = readSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
  }

  res.json(session);
});

app.put('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Session ID không hợp lệ' });
  }

  const { history = [], messages = [] } = req.body;
  const existing = readSession(sessionId);
  const session = writeSession(sessionId, {
    createdAt: existing?.createdAt,
    history,
    messages
  });

  res.json(session);
});

app.delete('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Session ID không hợp lệ' });
  }

  deleteSession(sessionId);
  res.json({ success: true, message: 'Đã xóa hội thoại' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, action, history = [] } = req.body;

    let userMessage = message?.trim() || '';

    if (action && ACTION_PROMPTS[action]) {
      userMessage = ACTION_PROMPTS[action];
    }

    if (!userMessage) {
      return res.status(400).json({ error: 'Tin nhắn không được để trống' });
    }

    const { reply, webSearch } = await callChatGPT(userMessage, history);

    res.json({
      reply,
      source: 'ai',
      model: MODEL,
      webSearch
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({
      error: 'Không thể xử lý tin nhắn. Kiểm tra API key hoặc thử lại sau.',
      detail: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot thư viện chạy tại http://localhost:${PORT}`);
  console.log(`Model AI: ${MODEL} (100% ChatGPT, web search enabled)`);
});
