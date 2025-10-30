# Lucine Chatbot - Struttura Progetto (Audit Map)

**Data Audit**: 30 Ottobre 2025
**Obiettivo**: Mappatura completa per audit critico

---

## 📁 Struttura Root

```
lucine-production/
├── backend/                    # Backend Node.js + Express + Prisma
│   ├── src/
│   │   ├── controllers/       # Chat, Ticket, Settings, Analytics, etc.
│   │   ├── routes/            # Express routes
│   │   ├── services/          # OpenAI, Email, Twilio, Upload, WebSocket
│   │   ├── middleware/        # Auth middleware
│   │   ├── config/            # Configuration
│   │   └── server.js          # Main server entry point
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Database migrations
│   └── scripts/               # Utility scripts (data migration, etc.)
│
├── src/                        # Frontend Dashboard (React + TypeScript)
│   ├── components/
│   │   ├── ui/                # Shadcn UI components
│   │   └── dashboard/         # Dashboard-specific components
│   ├── contexts/              # React contexts (Auth, Socket)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities and API clients
│   ├── pages/                 # Page components (Index, Login, Settings, etc.)
│   ├── services/              # Frontend services (notification.service.ts)
│   └── types/                 # TypeScript types
│
├── frontend-dashboard/         # ⚠️ TO INVESTIGATE - What is this?
│   └── src/
│       ├── components/        # Duplicate components?
│       └── lib/               # Duplicate libs?
│
├── docs/                       # Documentation
│   ├── CRITICAL_BUGS_ANALYSIS.md
│   ├── CURRENT_STATUS.md
│   ├── ROADMAP.md
│   ├── NOTIFICATION_SYSTEM_ANALYSIS.md
│   ├── AUDIT_BACKEND_REPORT.md
│   ├── FINAL_AUDIT_REPORT.md
│   ├── SYSTEM_ARCHITECTURE_MAP.md
│   └── archive/               # Archived obsolete docs
│
├── public/                     # Public assets
├── dist/                       # Build output
├── package.json                # Root package.json (frontend)
├── vite.config.ts              # Vite config
├── tsconfig.json               # TypeScript config
└── deploy.sh                   # Deployment script

```

---

## 🚨 IMMEDIATE CONCERNS (Prima Osservazione)

### 1. ⚠️ **Doppia Cartella Frontend**
- **Problema**: Esistono sia `src/` che `frontend-dashboard/src/`
- **Criticità**: Potenziale duplicazione codice, confusione
- **Da Verificare**:
  - Quale viene usata realmente?
  - Perché esistono entrambe?
  - Ci sono componenti duplicati?

### 2. 🤔 **Backend Inside Frontend Repo**
- **Problema**: Backend è una sottocartella del frontend
- **Criticità**:
  - Deployment separati (Render) ma codice accoppiato
  - package.json separati
  - Due node_modules separati
- **Best Practice Violation**: Backend e frontend dovrebbero essere repo separati

### 3. 📦 **Build Artifacts in Repo**
- **Problema**: `dist/` presente in root
- **Criticità**: Build artifacts NON dovrebbero essere in Git
- **Check**: Verificare se è in .gitignore

---

## 📊 Macro-Componenti Identificati

### A. **Backend System** (`backend/`)
- **Tipo**: Node.js + Express + PostgreSQL + Prisma
- **Funzioni**:
  - Chat management (sessions, messages)
  - Ticket system
  - Knowledge base + Semantic search
  - Operator management
  - Settings + System configuration
  - File uploads (Cloudinary)
  - Email (SMTP)
  - WhatsApp (Twilio)
  - AI integration (OpenAI)
  - WebSocket (Socket.io) per real-time

### B. **Frontend Dashboard** (`src/`)
- **Tipo**: React + TypeScript + Vite + Shadcn UI
- **Funzioni**:
  - Operator login/auth
  - Chat interface real-time
  - Ticket management
  - Knowledge base editor
  - Settings panel
  - Analytics dashboard
  - Operator management
  - Canned responses

### C. **Frontend Dashboard Duplicate?** (`frontend-dashboard/`)
- **Stato**: DA INVESTIGARE
- **Potenziale Problema**: Codice duplicato o vecchia versione?

### D. **Documentation** (`docs/`)
- **Stato**: Aggiornata recentemente (29/10/2025)
- **Qualità**: Buona (abbiamo appena pulito tutto)

---

## 🎯 Moduli da Analizzare (Priorità)

### Priority P0 (Critici)
1. **WebSocket System** - Real-time communication
   - File: `backend/src/services/websocket.service.js`
   - Criticità: Evento centrale del sistema

2. **Chat Controller** - Core business logic
   - File: `backend/src/controllers/chat.controller.js`
   - Criticità: 1476 righe - troppo grande!

3. **Auth System** - Security
   - File: `backend/src/middleware/auth.middleware.js`
   - Criticità: Login, tokens, permissions

### Priority P1 (Importanti)
4. **Database Schema** - Data model
   - File: `backend/prisma/schema.prisma`
   - Criticità: Relazioni, indexes, integrità

5. **Frontend State Management**
   - File: `src/contexts/SocketContext.tsx`, `AuthContext.tsx`
   - Criticità: State globale dell'app

6. **Message Table System** - BUG #6 appena deployato
   - File: `backend/src/controllers/chat.controller.js` (createMessage)
   - Criticità: Nuovo sistema da verificare

### Priority P2 (Importanti ma non bloccanti)
7. **AI Integration** - OpenAI
8. **Upload Service** - Cloudinary
9. **Email/WhatsApp** - Notifications
10. **Analytics System**

---

## 🔍 Aree Sospette da Investigare

### 1. Frontend Duplication
- **Domanda**: Perché 2 cartelle frontend?
- **Action**: Comparare `src/` vs `frontend-dashboard/src/`

### 2. Chat Controller Size
- **Problema**: 1476 righe in un file
- **Code Smell**: Violazione Single Responsibility Principle
- **Action**: Verificare se può essere splittato

### 3. Migration State
- **Domanda**: Tutte le migration sono applicate in prod?
- **Action**: Verificare stato DB vs migration files

### 4. WebSocket Room Names
- **History**: Abbiamo fixato `chat:` vs `chat_`, `operator:` vs `operator_`
- **Domanda**: Ci sono altri room name mismatch?
- **Action**: Grep completo per room names

### 5. Error Handling
- **Sospetto**: Try/catch senza log proper
- **Action**: Cercare pattern `catch (error) {}` vuoti

### 6. Frontend-Backend Contract
- **Domanda**: API responses sono consistenti?
- **Action**: Verificare `{ success, data }` vs `{ data }` vs errori

---

## 📝 Prossimi Step Audit

1. ✅ Mappattura struttura - DONE
2. ⏭️ Analizzare `frontend-dashboard/` mystery
3. ⏭️ Audit WebSocket system (room names, events)
4. ⏭️ Audit Chat Controller (size, responsibility)
5. ⏭️ Audit Database schema (relazioni, CASCADE, indexes)
6. ⏭️ Audit Error handling patterns
7. ⏭️ Audit Frontend state management
8. ⏭️ Audit UX flows (utente → operatore → admin)

---

**Map Created**: 30 Ottobre 2025, 00:05
**Next**: Investigare frontend-dashboard/ duplica
