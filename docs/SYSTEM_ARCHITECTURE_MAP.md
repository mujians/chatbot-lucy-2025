# Mappa Architettura Sistema Lucine Chatbot

**Data Creazione**: 29 Ottobre 2025
**Scopo**: Documento di mappatura completa dei macro-componenti del sistema per audit e analisi

---

## 📐 Panoramica Architetturale

Il sistema Lucine Chatbot è composto da **3 macro-componenti principali**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     UTENTE FINALE (Cliente E-commerce)          │
│                              ↓↑                                  │
│                    ┌─────────────────────┐                       │
│                    │   WIDGET SHOPIFY    │                       │
│                    │  (lucine-minimal)   │                       │
│                    └──────────┬──────────┘                       │
└───────────────────────────────┼──────────────────────────────────┘
                                ↓↑ HTTP + WebSocket
                    ┌───────────────────────┐
                    │   BACKEND API         │
                    │ (lucine-production    │
                    │     /backend/)        │
                    └───────┬───────────────┘
                            ↓↑ PostgreSQL + WebSocket
            ┌───────────────┴───────────────┐
            ↓                               ↓
┌───────────────────────┐       ┌───────────────────────┐
│  DASHBOARD OPERATORE  │       │  DATABASE             │
│ (lucine-production    │       │  PostgreSQL           │
│    /frontend-         │       │  + pgvector           │
│     dashboard/)       │       │                       │
└───────────────────────┘       └───────────────────────┘
```

---

## 🗂️ COMPONENTE 1: Backend API

**Path**: `/Users/brnobtt/Desktop/lucine-production/backend/`
**Linguaggio**: Node.js + Express.js
**Database**: PostgreSQL con pgvector extension

### Struttura Directory

```
backend/
├── src/
│   ├── controllers/       # Business logic endpoint handlers
│   ├── services/          # Servizi riusabili (OpenAI, Email, Twilio, etc.)
│   ├── routes/            # Definizione route API
│   ├── middleware/        # Auth middleware, error handling
│   ├── config/            # Configurazione app
│   └── server.js          # Entry point applicazione
├── prisma/
│   ├── schema.prisma      # Schema database
│   └── migrations/        # Migrazioni database
├── .env                   # Variabili ambiente (non committato)
└── package.json
```

### Controllers (Business Logic)

| File | Responsabilità | Dimensione | Note |
|------|---------------|-----------|------|
| `analytics.controller.js` | Statistiche, metriche performance | 5.8 KB | Report chat/ticket/operatori |
| `auth.controller.js` | Login, logout, JWT | 5.4 KB | Auth operatori |
| `canned-response.controller.js` | Risposte predefinite CRUD | 7.6 KB | Template messaggi |
| `chat.controller.js` | **⚠️ CORE** Gestione chat sessions | **38 KB** | File più grande e critico |
| `knowledge.controller.js` | Knowledge Base CRUD, embeddings | 9.8 KB | Semantic search integration |
| `operator.controller.js` | Gestione operatori (CRUD, stats) | 7.4 KB | Admin features |
| `settings.controller.js` | Configurazione sistema | 9.0 KB | Widget/AI/Notifiche settings |
| `ticket.controller.js` | Ticketing system | 13.7 KB | Creazione, assegnazione, risoluzione |
| `whatsapp.controller.js` | Integrazione WhatsApp | 9.6 KB | Webhook Twilio |

**⚠️ ATTENZIONE**: `chat.controller.js` è 38KB - potenzialmente troppo complesso, candidato per refactoring.

### Services (Logica Riusabile)

| File | Responsabilità | Dimensione | Dipendenze |
|------|---------------|-----------|------------|
| `background-jobs.service.js` | Cron jobs (auto-offline operatori) | 2.5 KB | node-cron (⚠️ disabilitato) |
| `email.service.js` | Invio email SMTP | 11.2 KB | Nodemailer, SystemSettings |
| `openai.service.js` | AI + Semantic Search | 7.4 KB | OpenAI API, pgvector |
| `twilio.service.js` | WhatsApp notifications | 6.3 KB | Twilio API |
| `upload.service.js` | File upload (Cloudinary) | 5.6 KB | Multer, Cloudinary |
| `websocket.service.js` | Socket.IO event handlers | 2.4 KB | Socket.IO |

**Criticità Identificate**:
- `background-jobs.service.js`: Disabled perché causava problemi (operatori auto-offline). 🔴
- `openai.service.js`: Semantic search con pgvector - verificare performance su grandi dataset.

### Routes (API Endpoints)

| File | Endpoint Base | Autenticazione | Metodi |
|------|--------------|----------------|--------|
| `analytics.routes.js` | `/api/analytics` | JWT Required | GET |
| `auth.routes.js` | `/api/auth` | Public (login) | POST |
| `canned-response.routes.js` | `/api/canned-responses` | JWT Required | GET, POST, PUT, DELETE |
| `chat.routes.js` | `/api/chat` | **Mixed** | GET, POST, PUT, DELETE |
| `knowledge.routes.js` | `/api/knowledge` | JWT Required | GET, POST, PUT, DELETE |
| `operator.routes.js` | `/api/operators` | JWT Required (Admin) | GET, POST, PUT, DELETE |
| `settings.routes.js` | `/api/settings` | **Mixed** | GET, PUT, POST |
| `ticket.routes.js` | `/api/tickets` | JWT Required | GET, POST, PUT |
| `whatsapp.routes.js` | `/api/whatsapp` | Public (Twilio webhook) | POST |

**⚠️ Mixed Authentication**: Alcuni endpoint sono pubblici (widget), altri richiedono JWT (dashboard).

### Database Schema (Prisma)

**File**: `backend/prisma/schema.prisma`

**Modelli Principali**:

1. **ChatSession**: Sessioni chat (ACTIVE, WITH_OPERATOR, CLOSED, TICKET_CREATED)
   - 🟡 Campo `messages` è Text serializzato JSON (non relazionale) - rischio scalabilità
   - Campi: `unreadMessageCount`, `priority`, `tags`, `isArchived`, `isFlagged`

2. **Ticket**: Sistema ticketing
   - `resumeToken` per riprendere ticket via email/WhatsApp
   - Stati: PENDING, ASSIGNED, OPEN, RESOLVED
   - ContactMethod: EMAIL, WHATSAPP

3. **KnowledgeItem**: Base di conoscenza
   - Campo `embedding` (Text serializzato) per pgvector
   - Categoria: FAQ, ORDINI, EVENTO, etc.

4. **Operator**: Operatori/Admin
   - `isOnline` flag (⚠️ deprecato secondo ROADMAP)
   - `isAvailable` flag (manuale)
   - Stats: `totalChatsHandled`, `totalTicketsHandled`

5. **SystemSettings**: Configurazione
   - Key-value store
   - 🔴 Campo `value` era Json, ora String (fix recente)

6. **CannedResponse**: Risposte predefinite
7. **InternalNote**: Note interne operatori (non visibili a utenti)

**Migrations**: 15+ migrazioni documentate

---

## 🗂️ COMPONENTE 2: Dashboard Operatore

**Path**: `/Users/brnobtt/Desktop/lucine-production/frontend-dashboard/`
**Framework**: React + TypeScript (⚠️ ma file sono .jsx, non .tsx)
**Build Tool**: Vite

### Struttura Directory

```
frontend-dashboard/
└── src/
    ├── components/         # React components
    │   ├── AnalyticsPanel.jsx
    │   ├── CannedResponsesManager.jsx
    │   ├── ChatList.jsx
    │   ├── ChatWindow.jsx        # ⚠️ 49 KB - file più grande
    │   ├── KnowledgeManager.jsx
    │   ├── OperatorManager.jsx
    │   ├── SettingsPanel.jsx
    │   └── TicketList.jsx
    ├── lib/
    │   └── axios.js              # ✅ Aggiunto recentemente (fix P1)
    ├── pages/                    # (probabilmente vuota o non usata)
    └── App.jsx (presumibilmente)
```

### Componenti Principali

| Componente | Responsabilità | Dimensione | Stato | Criticità |
|-----------|---------------|-----------|-------|-----------|
| `AnalyticsPanel.jsx` | Dashboard statistiche | 6.8 KB | ✅ OK | BASSA |
| `CannedResponsesManager.jsx` | Gestione risposte predefinite | 10.0 KB | ✅ OK | BASSA |
| `ChatList.jsx` | Lista chat con filtri | 16.0 KB | ✅ Recentemente fixato (Socket.IO) | MEDIA |
| `ChatWindow.jsx` | Finestra chat conversazione | **49.5 KB** | ⚠️ Troppo grande | **ALTA** |
| `KnowledgeManager.jsx` | CRUD Knowledge Base | 17.3 KB | ✅ OK | MEDIA |
| `OperatorManager.jsx` | Gestione operatori (admin) | 13.8 KB | ✅ OK | BASSA |
| `SettingsPanel.jsx` | Configurazione sistema | 17.7 KB | ✅ Recentemente organizzato in tabs | MEDIA |
| `TicketList.jsx` | Lista e gestione ticket | 11.8 KB | ✅ OK | MEDIA |

**🔴 PROBLEMA**: `ChatWindow.jsx` è 49KB - candidato principale per refactoring e splitting.

### Fix Recenti Applicati (da ROADMAP e CURRENT_STATUS)

✅ **P1**: `axios.js` creato (era mancante - bloccava tutta la dashboard)
✅ **P3**: Socket.IO listeners aggiunti a `ChatList.jsx`
✅ **P8-P10**: Token fixes in `ChatList.jsx` e `ChatWindow.jsx`
✅ **P12**: Real-time updates - ascolta `user_message` invece di `new_message`
✅ **P1.6/P13**: Notification badges implementati
✅ **P2.2**: Settings UI organizzata in tabs

---

## 🗂️ COMPONENTE 3: Widget Shopify

**Path**: `/Users/brnobtt/Desktop/lucine-minimal/snippets/chatbot-popup.liquid`
**Linguaggio**: Shopify Liquid + Vanilla JavaScript
**Dimensione**: **~60 KB** (file monolitico)

### Struttura File

Il widget è contenuto in UN SOLO FILE Liquid:

```
chatbot-popup.liquid (~60 KB)
├── <style> section         # CSS scoped per widget
├── <div id="chatbot-...">  # HTML markup
└── <script>                # JavaScript puro (no framework)
    ├── Variables globali
    ├── API communication
    ├── Socket.IO client
    ├── UI manipulation
    ├── Event handlers
    └── Init functions
```

**🔴 CRITICITÀ MASSIMA**:
- File monolitico da 60KB - estremamente difficile da mantenere
- JavaScript non modulare (tutto in un unico scope)
- HTML, CSS, JS mescolati in un solo file
- Difficile fare code review
- Difficile testare singole funzionalità

### Funzionalità Widget

1. **Chat UI**: Input, messages display, header
2. **AI Integration**: Invia/riceve messaggi da backend
3. **Socket.IO**: Real-time communication
4. **Operator Mode**: Handoff a operatore umano
5. **Ticket Form**: Creazione ticket quando operatore offline
6. **File Upload**: Upload allegati (recente P0.1)
7. **Typing Indicators**: Feedback real-time (recente P0.5)
8. **Smart Actions**: Pulsanti azioni suggerite

### Fix Recenti Applicati

✅ **P0.3-P0.4**: Smart actions quando operatori offline + form ticket
✅ **P0.1**: File upload con Cloudinary
✅ **Bug 1**: Socket.IO sessionId fix (oggetto invece di stringa)
✅ **Bug 2**: Check `operatorAvailable` invece di `assigned`
✅ **Bug 3**: Gestione WITH_OPERATOR mode
✅ **P7**: Fix messaggio ingannevole "operatore si è unito"
✅ **P11**: Clear session on chat close
✅ **P1.7**: Disable input dopo chat chiusa
✅ **P2.1**: Settings cache-busting e auto-refresh

---

## 🔄 Flussi di Comunicazione

### 1. User → AI (Chat Normale)

```
Widget (Liquid)
    ↓ HTTP POST /api/chat/session/:id/message
Backend (chat.controller.js)
    ↓ OpenAI API call
    ↓ Semantic search KB (pgvector)
    ↓ Return AI response
Widget (display message)
```

### 2. User → Operatore (Handoff)

```
Widget (click "Parla con Operatore")
    ↓ HTTP POST /api/chat/session/:id/request-operator
Backend (assignOperatorToSession)
    ↓ Find available operator
    ↓ Update session status → WITH_OPERATOR
    ↓ Socket.IO emit 'new_chat_request' → dashboard
Dashboard (ChatList.jsx)
    ↓ Socket listener riceve evento
    ↓ Refresh chat list
Operatore (click su chat)
    ↓ ChatWindow aperto
    ↓ Socket.IO emit 'operator_join'
    ↓ Socket.IO emit 'join_chat' (sessione)
Backend (websocket.service.js)
    ↓ Socket.IO emit 'operator_assigned' → widget
Widget (mostra "Operatore X si è unito")
```

### 3. Operatore ↔ User (Messaging)

```
Operatore (invia messaggio)
Dashboard (ChatWindow.jsx)
    ↓ Socket.IO emit 'operator_message'
Backend (websocket.service.js)
    ↓ Socket.IO emit to room 'chat_${sessionId}'
Widget (riceve 'operator_message')
    ↓ Display message

User (invia messaggio)
Widget
    ↓ HTTP POST /api/chat/session/:id/message
Backend (chat.controller.js)
    ↓ Salva in DB
    ↓ Socket.IO emit 'user_message' to room 'operator_${operatorId}'
Dashboard (ChatWindow.jsx)
    ↓ Riceve 'user_message'
    ↓ Display message
```

---

## 📊 Metriche Complessità Codice

| Componente | File Totali | LOC Stimato | File > 10KB | File Critici |
|-----------|-------------|-------------|-------------|--------------|
| Backend | 26 JS files | ~15,000 | 5 files | chat.controller.js (38KB) |
| Dashboard | 9 JSX files | ~12,000 | 4 files | ChatWindow.jsx (49KB) |
| Widget | 1 Liquid file | ~3,000 | 1 file | chatbot-popup.liquid (60KB) |

**🔴 FILES CON CRITICITÀ MASSIMA (da refactorare)**:
1. `chatbot-popup.liquid` - 60KB monolitico
2. `ChatWindow.jsx` - 49KB
3. `chat.controller.js` - 38KB

---

## 🔌 Integrazioni Esterne

| Servizio | Scopo | Configurazione | Status |
|---------|-------|---------------|--------|
| **OpenAI API** | GPT-4 + embeddings | `OPENAI_API_KEY` | ✅ Funzionante |
| **PostgreSQL (Render)** | Database principale | Render managed | ✅ Funzionante |
| **pgvector** | Semantic search | PostgreSQL extension | ✅ Abilitato |
| **Cloudinary** | File/image storage | `CLOUDINARY_*` env vars | ✅ Implementato (P0.1) |
| **Twilio** | WhatsApp notifications | `TWILIO_*` env vars | ⚠️ Da testare |
| **SMTP (Nodemailer)** | Email notifications | SystemSettings DB | ✅ Implementato (P1.1) |
| **Socket.IO** | Real-time WebSocket | Embedded in backend | ✅ Funzionante |
| **Shopify** | E-commerce platform | Widget integration | ✅ Deployato |

---

## 🚨 Problemi Architetturali Identificati

### 1. **File Monolitici Troppo Grandi**
- `chatbot-popup.liquid`: 60KB non modulare
- `ChatWindow.jsx`: 49KB - troppe responsabilità
- `chat.controller.js`: 38KB - troppa logica in un controller

**Impact**: Manutenibilità molto bassa, code smell

### 2. **Messages Storage Non Scalabile**
- `ChatSession.messages` è un campo Text con JSON serializzato
- Ogni query carica TUTTI i messaggi della sessione
- Non paginabile, non indicizzabile

**Impact**: Performance problems con chat lunghe

### 3. **Mixed Authentication Pattern**
- Alcuni endpoint pubblici, altri JWT-protected
- Difficile capire quali endpoint sono accessibili dal widget
- Possibili security issues

**Impact**: Security risk, confusione

### 4. **Background Jobs Disabilitati**
- `background-jobs.service.js` è disabilitato perché causava problemi
- Auto-offline operatori non funziona

**Impact**: Operatori rimangono "available" anche quando offline

### 5. **Mancanza di Modularizzazione Widget**
- Widget è un singolo file Liquid da 60KB
- Impossibile testare unità singole funzioni
- Difficile debug

**Impact**: Bug difficili da trovare, testing impossibile

### 6. **TypeScript Non Completamente Adottato**
- Dashboard ha .jsx invece di .tsx
- Perde benefici type safety TypeScript

**Impact**: Più runtime errors, meno IDE autocomplete

---

## ✅ Punti di Forza

1. **Documentazione Eccellente**: ROADMAP, CURRENT_STATUS, PROJECT_ONBOARDING molto dettagliati
2. **Fix Sistematici**: Problemi tracciati e risolti metodicamente (P0, P1, P2)
3. **Real-time Communication**: Socket.IO ben implementato (dopo fix)
4. **Semantic Search**: pgvector integration è una feature avanzata
5. **Feature Complete**: File upload, internal notes, user history implementati

---

## 📝 Prossimi Passi Analisi

1. ✅ Mappatura completata
2. ⏭️ **Analisi Backend**: Esaminare ogni controller/service per bug nascosti
3. ⏭️ **Analisi Dashboard**: Code smell in ChatWindow.jsx e altri componenti
4. ⏭️ **Analisi Widget**: Scomporre logica del monolite Liquid
5. ⏭️ **Analisi Database**: Performance query, index missing, schema issues
6. ⏭️ **Analisi UX**: Flussi utente/operatore, pain points

---

**Documento creato da**: Claude Code (Audit Sistema)
**Data**: 29 Ottobre 2025
**Next**: Analisi dettagliata Backend (backend/)
