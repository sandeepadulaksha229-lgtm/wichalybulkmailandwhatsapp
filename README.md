# 🎓 Wycherley International School — Bulk Invoicing & Dispatch Portal

Automated Grade-based Bulk Invoicing, Parent Email Dispatch, and WhatsApp Invoice PDF delivery system integrated with **Zoho Books API** and **WhatsApp Web (Baileys)**.

---

## 🌟 Key Features

- **📊 Student & Grade Management:** Fetches active student contacts from Zoho Books, categorizes by grade, and parses admission numbers and contact info.
- **⚡ Bulk Invoicing Engine:** Generates official Zoho Books invoices for entire grades or selected students with a single click.
- **🛡️ Rate-Limit Protection:** Built-in 700ms request pacing to safeguard against Zoho API rate limits.
- **✉️ Automated Zoho Email Dispatch:** Sends official invoice emails directly through Zoho Books to parents.
- **📱 WhatsApp PDF Dispatch:** Connects via QR code (Baileys Multi-Device) and sends the downloaded official Invoice PDF with customized message to parents' WhatsApp.
- **📈 Real-Time Progress & History:** Live logs, success/fail counters, and persistent batch history modal.
- **🎨 Modern Responsive UI:** Elegant dashboard with Dark & Light theme toggle, interactive metrics, and search/filter tools.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- Active Zoho Books Organization with API / OAuth credentials
- WhatsApp account for scanning QR code

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root based on `.env.example`:
```env
PORT=3000
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_REFRESH_TOKEN=your_zoho_refresh_token
ZOHO_ORG_ID=your_organization_id
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_BOOKS_API_URL=https://www.zohoapis.com/books/v3
```

### 4. Running the Server
```bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Overview

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/status` | `GET` | Zoho connection status and organization info |
| `/api/grades` | `GET` | Distinct grades and student counts |
| `/api/students` | `GET` | Students filtered by grade or search query |
| `/api/items` | `GET` | Zoho fee items and grade fee templates |
| `/api/invoices/preview` | `POST` | Calculate subtotal, discount, and batch total |
| `/api/invoices/bulk-send` | `POST` | Initiate background batch invoice generation |
| `/api/invoices/progress/:id` | `GET` | Fetch real-time progress for a batch |
| `/api/invoices/history` | `GET` | List all processed batches |
| `/api/whatsapp/status` | `GET` | Current WhatsApp connection status & QR code |
| `/api/whatsapp/connect` | `POST` | Initialize WhatsApp socket and generate QR |
| `/api/whatsapp/disconnect` | `POST` | Log out and clear session |
| `/api/whatsapp/test` | `POST` | Send a test WhatsApp message |

---

## 🔒 Security Notice
Ensure that `.env` and `.whatsapp_session/` are never committed to version control. They are included in `.gitignore` by default.

