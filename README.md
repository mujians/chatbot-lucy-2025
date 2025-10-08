# Lucine Chatbot - Sistema Completo

Sistema di chat AI con supporto operatori umani per il sito Lucine di Natale.

**Status:** ✅ **Backend WORKING** | ⚠️ **Setup Required** (database + external services)

## 🎯 Quick Links

- **[⚡ QUICK REFERENCE](QUICK_REFERENCE.md)** - Start here! 3-step setup guide
- **[📊 FINAL STATUS](FINAL_STATUS.md)** - Complete project status (100% backend)
- **[🔌 EXTERNAL SERVICES](EXTERNAL_SERVICES.md)** - OpenAI + Twilio setup with costs
- **[✅ SESSION SUMMARY](SESSION_COMPLETION_SUMMARY.md)** - Latest fixes and tests

## 📁 Struttura Progetto

```
lucine-chatbot-app/
├── backend/              # Express + Socket.io + Prisma + PostgreSQL
├── frontend-widget/      # Widget chatbot per sito Shopify
├── frontend-dashboard/   # Dashboard operatori
└── docs/                 # Documentazione tecnica
```

## 🚀 Stack Tecnologico

### Backend
- Node.js 20 + Express.js
- Socket.io (WebSocket real-time)
- Prisma ORM + PostgreSQL
- OpenAI API (GPT-4 + Embeddings)
- Twilio (WhatsApp notifications)
- JWT Authentication

### Frontend Widget
- React 18 + Vite
- Tailwind CSS
- Socket.io Client

### Frontend Dashboard
- React 18 + Vite
- Tailwind CSS + shadcn/ui
- React Router v6
- Socket.io Client

## 📦 Setup Veloce

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Configura .env con DB_URL, OPENAI_KEY, TWILIO credentials
npx prisma migrate dev
npm run dev
```

### 2. Frontend Widget
```bash
cd frontend-widget
npm install
npm run dev
```

### 3. Frontend Dashboard
```bash
cd frontend-dashboard
npm install
npm run dev
```

## 🌐 URLs

- **Backend API:** http://localhost:3001
- **Widget Dev:** http://localhost:5173
- **Dashboard Dev:** http://localhost:5174

## 📚 Documentazione

Vedi cartella `docs/` per specifiche complete:
- 01_PROJECT_OVERVIEW.md
- 02_DATABASE_SCHEMA.md
- 03_API_ENDPOINTS.md
- 04_FRONTEND_WIDGET_SPEC.md
- 05_FRONTEND_DASHBOARD_SPEC.md
- 06_UX_FLOWS_SCENARIOS.md

## 🔑 Environment Variables

### Backend `.env`
```
DATABASE_URL="postgresql://user:password@localhost:5432/lucine_chatbot"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="sk-..."
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_NUMBER="+14155238886"
SHOPIFY_SITE_URL="https://lucine.it"
NODE_ENV="development"
PORT=3001
```

## 📝 Effort Totale

- **104.5 ore totali** (circa 5 settimane)
- Budget: €7.315 - €10.450

## 🎯 Features Principali

- ✅ Chat AI con GPT-4 + RAG (knowledge base)
- ✅ Fallback operatore umano real-time
- ✅ Sistema ticket asincrono (WhatsApp/Email)
- ✅ Notifiche multi-canale (audio, push, toast, WhatsApp)
- ✅ Dashboard operatori con shadcn/ui
- ✅ Autenticazione JWT
- ✅ Session persistence (24h)
- ✅ WebSocket + REST fallback

## 📄 License

Proprietario - Lucine di Natale
