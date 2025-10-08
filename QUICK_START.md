# ⚡ Quick Start Guide

Avvia rapidamente il progetto Lucine Chatbot in 5 minuti!

## 🎯 Setup Rapido (Per Sviluppatori)

### 1️⃣ Clona e Installa (2 minuti)
```bash
# Se non l'hai già fatto, naviga alla cartella del progetto
cd lucine-chatbot-app

# Installa dipendenze (tutti i progetti)
cd backend && npm install && cd ..
cd frontend-widget && npm install && cd ..
cd frontend-dashboard && npm install && cd ..
```

### 2️⃣ Database (1 minuto)
```bash
# Crea database PostgreSQL
createdb lucine_chatbot

# Installa estensione pgvector
psql lucine_chatbot -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Configura .env
cd backend
cp .env.example .env
# Modifica DATABASE_URL nel file .env

# Migrations + Seed
npx prisma migrate dev --name init
npm run seed
```

### 3️⃣ Avvia Tutto (30 secondi)

Apri **3 terminali separati**:

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# ✅ Server: http://localhost:3001

# Terminal 2 - Widget
cd frontend-widget
npm run dev
# ✅ Widget: http://localhost:5173

# Terminal 3 - Dashboard
cd frontend-dashboard
npm run dev
# ✅ Dashboard: http://localhost:5174
```

## ✅ Test Veloce (30 secondi)

1. **Backend Health**: http://localhost:3001/health
2. **Widget**: http://localhost:5173 (click bubble chat)
3. **Dashboard Login**: http://localhost:5174
   - Email: `admin@lucine.it`
   - Password: `admin123`

## 🎨 Cosa Hai Ora

✅ **Backend API** funzionante (Express + Socket.io + Prisma)
✅ **Database PostgreSQL** con schema completo
✅ **Widget Chat** con UI base
✅ **Dashboard Operatori** con login e layout
✅ **2 utenti di test** (admin + operator)
✅ **5 items knowledge base**

## 🚧 Cosa Manca (Da Implementare)

Le seguenti funzionalità sono **preparate ma non completamente implementate**:

### Backend
- [ ] Auth routes complete (login/logout/refresh)
- [ ] Chat WebSocket handlers (join/message/leave)
- [ ] OpenAI service (GPT-4 + embeddings)
- [ ] Twilio WhatsApp notifications
- [ ] Ticket management routes
- [ ] Knowledge Base search API

### Frontend Widget
- [ ] WebSocket connection
- [ ] Messaggi real-time
- [ ] Smart Actions (operatore/ticket)
- [ ] Ticket form completo
- [ ] Session persistence

### Frontend Dashboard
- [ ] Autenticazione JWT
- [ ] WebSocket real-time
- [ ] Chat list component
- [ ] Ticket management
- [ ] Knowledge Base CRUD
- [ ] Notification system
- [ ] shadcn/ui components

## 🔗 URLs Importanti

| Servizio | URL | Credenziali |
|----------|-----|-------------|
| Backend API | http://localhost:3001 | - |
| Widget | http://localhost:5173 | - |
| Dashboard | http://localhost:5174 | admin@lucine.it / admin123 |
| Prisma Studio | http://localhost:5555 | `npx prisma studio` |

## 📂 Struttura File

```
lucine-chatbot-app/
├── backend/                 # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── server.js       # ✅ Server principale
│   │   ├── config/         # ✅ Configurazione
│   │   ├── middleware/     # ✅ Auth middleware
│   │   ├── routes/         # 🚧 Da implementare
│   │   ├── controllers/    # 🚧 Da implementare
│   │   └── services/       # 🚧 Da implementare
│   ├── prisma/
│   │   ├── schema.prisma   # ✅ Database schema
│   │   └── seed.js         # ✅ Seed data
│   └── package.json
│
├── frontend-widget/         # React + Vite
│   ├── src/
│   │   ├── main.jsx        # ✅ Entry point
│   │   ├── components/     # ✅ ChatWidget base
│   │   ├── hooks/          # 🚧 Da implementare
│   │   └── services/       # 🚧 Da implementare
│   └── package.json
│
├── frontend-dashboard/      # React + Vite + shadcn/ui
│   ├── src/
│   │   ├── main.jsx        # ✅ Entry point
│   │   ├── App.jsx         # ✅ Router
│   │   ├── pages/          # ✅ Login + Dashboard
│   │   └── components/ui/  # 🚧 shadcn/ui components
│   └── package.json
│
├── docs/                    # Documentazione tecnica
├── README.md               # ✅ Overview generale
├── SETUP.md                # ✅ Setup dettagliato
└── QUICK_START.md          # ✅ Questa guida
```

## 🛠️ Comandi Utili

```bash
# Backend
npm run dev          # Avvia dev server
npm run seed         # Popola DB con dati test
npx prisma studio    # UI per database
npx prisma generate  # Rigenera Prisma client

# Frontend (widget o dashboard)
npm run dev          # Dev server
npm run build        # Build produzione
npm run preview      # Preview build

# Database
npx prisma migrate dev --name <name>  # Crea migration
npx prisma migrate reset               # Reset completo
npx prisma db push                     # Push schema senza migration
```

## 🐛 Debug

```bash
# Check porte in uso
lsof -i :3001  # Backend
lsof -i :5173  # Widget
lsof -i :5174  # Dashboard

# Logs database
psql lucine_chatbot -c "SELECT * FROM \"Operator\";"
psql lucine_chatbot -c "SELECT * FROM \"KnowledgeItem\";"

# Reset completo
cd backend
npx prisma migrate reset
npm run seed
```

## 📝 Note Sviluppo

- **Hot reload** attivo su tutti i progetti
- **CORS** configurato per localhost
- **WebSocket** proxy configurato in Vite
- **Database seed** con admin/operator di test
- **Tailwind CSS** configurato su entrambi i frontend
- **shadcn/ui** preparato per dashboard

## 🎯 Prossimo Obiettivo

Ti suggerisco di iniziare implementando:
1. **Auth routes** nel backend (login/logout)
2. **WebSocket handlers** per chat real-time
3. **OpenAI service** per risposte AI

Controlla i documenti in `docs/` per le specifiche complete!

---

**Pronto per sviluppare! 🚀**
