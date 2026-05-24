# Chatbot Thư viện UIT

Chatbot hỗ trợ thư viện đại học — tích hợp ChatGPT, tra cứu sách OPAC, lưu hội thoại JSON.

**Tác giả:** Nguyễn Thế Quân · QLTT13 · ĐH Văn hóa Hà Nội

## Cấu trúc

```
chatbot_thuvienquan/
├── backend/          # Node.js + Express + OpenAI
├── frontend/         # HTML, CSS, JS
└── render.yaml       # Cấu hình deploy Render
```

## Chạy local

```bash
cd backend
cp .env.example .env   # điền OPENAI_API_KEY
npm install
npm start
```

Mở http://localhost:3000

## Deploy Render

1. Push code lên GitHub (repo này)
2. Vào [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**
3. Connect repo `nguyenquang092006-crypto/chatbotquan`
4. Cấu hình:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Thêm **Environment Variable:**
   - `OPENAI_API_KEY` = API key OpenAI của bạn
   - `OPENAI_MODEL` = `gpt-4o-mini` (tuỳ chọn)
6. Deploy → lấy link dạng `https://chatbot-thuvienquan.onrender.com`

> Render tự gán biến `PORT`. Không commit file `.env` hoặc `api.txt`.
