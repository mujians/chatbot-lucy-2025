# 🏗️ LUCINE CHATBOT - SYSTEM ARCHITECTURE

**Last Updated:** 2 Novembre 2025 (Security & Performance Enhancements)
**Version:** 2.3.0
**Status:** ✅ Production Ready

---

## 📊 SYSTEM OVERVIEW

Lucine Chatbot is a **hybrid AI + Human customer support system** for Shopify e-commerce stores.

### **3-Tier Architecture**

```
┌─────────────────┐
│  Widget (User)  │  ← Shopify Liquid embedded widget
│    Frontend     │  ← HTML/CSS/JS (vanilla)
└────────┬────────┘
         │ HTTP + WebSocket
         ↓
┌─────────────────┐
│  Backend API    │  ← Node.js + Express + Prisma
│   (chatbot-     │  ← WebSocket (Socket.io)
│   lucy-2025)    │  ← PostgreSQL + pgvector
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Dashboard     │  ← React + TypeScript
│   (Operators)   │  ← Shadcn UI + Tailwind
│  lucine-frontend│  ← WebSocket real-time
└─────────────────┘
```

### **Data Flow**

```
User Message (Widget)
  → POST /api/chat/session/:id/message
  → Backend creates Message in DB
  → If AI mode: OpenAI generates response
  → If operator mode: WebSocket emit to operator
  → Operator replies via Dashboard
  → WebSocket emit to widget
  → Widget displays message
```

---

## 🎯 STACK TECNOLOGICO

### **Backend** (`lucine-backend`)
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **ORM:** Prisma 6.18
- **Database:** PostgreSQL 16 + pgvector extension
- **WebSocket:** Socket.io 4.7.5
- **AI:** OpenAI GPT-4 + Embeddings (RAG)
- **Auth:** JWT (jsonwebtoken)
- **Security:** csrf-csrf (CSRF protection), helmet (security headers), express-rate-limit
- **File Upload:** Cloudinary (multer)
- **Email:** Nodemailer
- **WhatsApp:** Twilio
- **Deploy:** Render.com (auto-deploy da GitHub)

### **Frontend Dashboard** (`lucine-frontend`)
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Routing:** React Router 6
- **UI:** Shadcn UI + Radix UI
- **Styling:** Tailwind CSS
- **Icons:** Lucide React (NO emoji)
- **HTTP:** Axios
- **WebSocket:** Socket.io Client
- **Date:** date-fns (IT locale)
- **Deploy:** Render.com (static site)

### **Widget** (`lucine-minimal`)
- **Tech:** Vanilla JavaScript (no framework)
- **Template:** Shopify Liquid
- **WebSocket:** Socket.io Client (CDN)
- **Storage:** localStorage (7-day TTL)
- **Deploy:** Shopify Theme (snippets/chatbot-popup.liquid)

---

## 💾 DATABASE SCHEMA

### **Key Models (Prisma)**

#### **Operator**
```prisma
model Operator {
  id                      String   @id @default(uuid())
  email                   String   @unique
  passwordHash            String
  name                    String
  role                    OperatorRole @default(OPERATOR)

  // Availability
  isOnline                Boolean  @default(false)
  isAvailable             Boolean  @default(false)
  lastSeenAt              DateTime @default(now())

  // Stats
  totalChatsHandled       Int      @default(0)
  totalTicketsHandled     Int      @default(0)
  averageRating           Float?

  // Relations
  chatSessions            ChatSession[]
  tickets                 Ticket[]
  knowledgeItems          KnowledgeItem[]
}
```

#### **ChatSession**
```prisma
model ChatSession {
  id                      String   @id @default(uuid())
  userName                String?
  userEmail               String?

  // State
  status                  ChatStatus @default(ACTIVE)
  messages                Json     @default("[]")  // Legacy

  // Operator assignment
  operatorId              String?
  operator                Operator? @relation(fields: [operatorId], references: [id])
  operatorJoinedAt        DateTime?

  // Relations
  messagesNew             Message[]    // New Message table
  ticket                  Ticket?
  rating                  ChatRating?

  createdAt               DateTime @default(now())
  lastMessageAt           DateTime @default(now())
  closedAt                DateTime?
}
```

#### **Message**
```prisma
model Message {
  id                      String      @id @default(uuid())
  sessionId               String
  session                 ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  type                    MessageType  // USER | OPERATOR | AI | SYSTEM
  content                 String      @db.Text

  operatorId              String?
  operatorName            String?

  // Attachments
  attachmentUrl           String?
  attachmentName          String?

  createdAt               DateTime    @default(now())
}
```

#### **Ticket**
```prisma
model Ticket {
  id                      String   @id @default(uuid())

  // Contact
  userName                String
  contactMethod           ContactMethod  // WHATSAPP | EMAIL
  whatsappNumber          String?
  email                   String?

  // Content
  initialMessage          String

  // Status & Priority
  status                  TicketStatus @default(PENDING)
  priority                TicketPriority @default(NORMAL)

  // Assignment
  operatorId              String?
  operator                Operator? @relation(fields: [operatorId], references: [id])
  assignedAt              DateTime?

  // Resolution
  resolutionNotes         String?
  resolvedAt              DateTime?

  // Resume token
  resumeToken             String   @unique @default(uuid())
  resumeTokenExpiresAt    DateTime // 30 days

  // Linked session
  sessionId               String   @unique
  session                 ChatSession @relation(fields: [sessionId], references: [id])

  createdAt               DateTime @default(now())
}
```

### **Enums**

```prisma
enum ChatStatus {
  ACTIVE          // AI mode, active conversation
  WAITING         // User requested operator, waiting for accept
  WITH_OPERATOR   // Operator accepted, human mode
  CLOSED          // Session closed
  TICKET_CREATED  // Converted to ticket
}

enum TicketStatus {
  PENDING         // Created, not assigned
  ASSIGNED        // Assigned to operator
  OPEN            // User resumed via link
  IN_PROGRESS     // Operator working on it
  RESOLVED        // Completed by operator
  CLOSED          // Archived
}

enum TicketPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum MessageType {
  USER            // From customer
  OPERATOR        // From dashboard operator
  AI              // Generated by OpenAI
  SYSTEM          // System notifications
}
```

---

## 🔌 BACKEND API

**Base URL:** `https://chatbot-lucy-2025.onrender.com/api`

### **Authentication**

All operator endpoints require JWT token:
```
Authorization: Bearer <jwt_token>
```

### **Chat Endpoints**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/chat/session` | Public | Create new chat session |
| `POST` | `/chat/session/:id/message` | Public | Send user message |
| `GET` | `/chat/session/:id` | Public | Get session details |
| `POST` | `/chat/session/:id/close` | Public | Close session |
| `POST` | `/chat/session/:id/rate` | Public | Rate chat (CSAT) |
| `POST` | `/chat/session/:id/reopen` | Public | Reopen recent chat (<5 min) |
| `GET` | `/chat/sessions` | Operator | List all sessions |
| `GET` | `/chat/sessions/active` | Operator | List ACTIVE (AI) sessions |
| `POST` | `/chat/sessions/:id/accept` | Operator | Accept WAITING chat |
| `POST` | `/chat/sessions/:id/operator-intervene` | Operator | Intervene in AI chat |
| `POST` | `/chat/:sessionId/message` | Operator | Send operator message |

### **Ticket Endpoints**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/tickets` | Public | Create ticket |
| `GET` | `/tickets/resume/:token` | Public | Resume ticket by token |
| `GET` | `/tickets` | Operator | List tickets (filterable) |
| `GET` | `/tickets/:id` | Operator | Get ticket details |
| `POST` | `/tickets/:id/assign` | Operator | Assign to current operator |
| `POST` | `/tickets/:id/resolve` | Operator | Resolve ticket (legacy) |
| `PATCH` | `/tickets/:id/status` | Operator | Update status (v2.2 NEW) |

#### Ticket Status Update (NEW v2.2)
```typescript
PATCH /api/tickets/:id/status
Body: {
  status: "PENDING" | "ASSIGNED" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
  notes?: string
}
```

### **Auth Endpoints**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/login` | Public | Operator login → JWT |
| `POST` | `/auth/logout` | Operator | Invalidate session |
| `GET` | `/auth/me` | Operator | Get current operator |

### **Knowledge Endpoints**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/knowledge` | Operator | List knowledge items |
| `POST` | `/knowledge` | Operator | Create knowledge item |
| `PUT` | `/knowledge/:id` | Operator | Update knowledge item |
| `DELETE` | `/knowledge/:id` | Operator | Delete knowledge item |
| `POST` | `/knowledge/search` | Public | Semantic search (RAG) |

---

## 🌐 WEBSOCKET EVENTS

**Connection URL:** `wss://chatbot-lucy-2025.onrender.com`

### **Client → Server**

#### Widget Events
```typescript
socket.emit('join_session', { sessionId: string })
socket.emit('typing', { sessionId: string })
socket.emit('stop_typing', { sessionId: string })
```

#### Dashboard Events
```typescript
socket.emit('join_dashboard', { operatorId: string })
socket.emit('operator_typing', { sessionId: string, operatorName: string })
socket.emit('operator_stop_typing', { sessionId: string })
```

### **Server → Client**

#### Chat Events
```typescript
// To widget
socket.on('ai_message', { sessionId, message, aiConfidence })
socket.on('operator_message', { sessionId, message })
socket.on('chat_accepted', { sessionId, operatorName })
socket.on('chat_closed', { sessionId, reason })
socket.on('operator_typing', { sessionId, operatorName })
socket.on('operator_disconnected', { sessionId, operatorName })
socket.on('operator_wait_timeout', { sessionId, message })  // v2.1
socket.on('chat_reopened', { sessionId, message })  // v2.1

// To dashboard
socket.on('new_chat_request', { sessionId, userName, firstMessage })
socket.on('user_message', { sessionId, message })
socket.on('user_typing', { sessionId })
socket.on('user_disconnected', { sessionId })  // v2.1
socket.on('chat_timeout_cancelled', { sessionId, message })  // v2.1
socket.on('chat_auto_closed', { sessionId, reason })  // v2.1
socket.on('user_spam_detected', { sessionId, messageCount, userName })  // v2.1
socket.on('ai_chat_updated', { sessionId, userName, lastMessage, timestamp, messageCount })  // v2.3
```

#### Ticket Events
```typescript
socket.on('new_ticket_created', { ticketId, userName, contactMethod, priority })
socket.on('ticket_assigned', { ticketId, operatorId, operatorName })
socket.on('ticket_resolved', { ticketId })
socket.on('ticket_status_updated', { ticketId, status, operatorId })  // v2.2
```

---

## 🎨 FRONTEND ARCHITECTURE

### **Pages**

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `Login.tsx` | Operator authentication |
| `/` | `Index.tsx` | Main dashboard (chat) |
| `/tickets` | `Tickets.tsx` | Ticket list with filters |
| `/tickets/:id` | `TicketDetail.tsx` | Ticket detail page (NEW v2.2) |
| `/knowledge` | `Knowledge.tsx` | Knowledge base management |
| `/settings` | `Settings.tsx` | System settings |
| `/operators` | `Operators.tsx` | Operator management (admin) |
| `/analytics` | `Analytics.tsx` | Stats and metrics |

### **Key Components**

```
src/
├── components/
│   ├── dashboard/
│   │   ├── TopBar.tsx              # Header with notifications
│   │   ├── OperatorSidebar.tsx     # Left sidebar with nav
│   │   ├── ChatListPanel.tsx       # Middle panel (chat list)
│   │   └── ChatWindow.tsx          # Right panel (messages)
│   ├── tickets/
│   │   ├── TicketList.tsx          # Tickets table
│   │   ├── TicketFilters.tsx       # Filter controls
│   │   └── TicketDetail.tsx        # Detail modal
│   ├── layout/
│   │   └── DashboardLayout.tsx     # Main layout wrapper
│   └── ui/                         # Shadcn UI components
├── contexts/
│   ├── AuthContext.tsx             # JWT auth state
│   └── SocketContext.tsx           # WebSocket connection
├── hooks/
│   ├── useTickets.ts               # Tickets data fetching
│   └── useChats.ts                 # Chats data fetching
├── lib/
│   ├── api.ts                      # API service (axios)
│   └── utils.ts                    # Helpers
└── types/
    └── index.ts                    # TypeScript types
```

### **API Service (`lib/api.ts`)**

```typescript
// Chat API
export const chatApi = {
  getSessions: (params?) => api.get('/chat/sessions', { params }),
  getActiveSessions: () => api.get('/chat/sessions/active'),  // v2.1
  acceptChat: (sessionId) => api.post(`/chat/sessions/${sessionId}/accept`),
  intervene: (sessionId) => api.post(`/chat/sessions/${sessionId}/operator-intervene`),
  sendMessage: (sessionId, message) => api.post(`/chat/${sessionId}/message`, { message }),
  closeSession: (sessionId) => api.post(`/chat/session/${sessionId}/close`),
}

// Tickets API
export const ticketsApi = {
  getAll: (params?) => api.get('/tickets', { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  assign: (id) => api.post(`/tickets/${id}/assign`),
  resolve: (id, notes) => api.post(`/tickets/${id}/resolve`, { resolutionNotes: notes }),
  updateStatus: (id, data) => api.patch(`/tickets/${id}/status`, data),  // v2.2
  create: (data) => api.post('/tickets', data),
}
```

### **TypeScript Types (`types/index.ts`)**

```typescript
// Chat Types
export type ChatStatus = 'ACTIVE' | 'WAITING' | 'WITH_OPERATOR' | 'CLOSED' | 'TICKET_CREATED';
export type MessageType = 'USER' | 'OPERATOR' | 'AI' | 'SYSTEM';

export interface ChatSession {
  id: string;
  userName: string;
  status: ChatStatus;
  operatorId?: string;
  operator?: { id: string; name: string };
  messages: Message[];
  createdAt: string;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  operatorName?: string;
  createdAt: string;
}

// Ticket Types (ALIGNED WITH PRISMA v2.2)
export const TicketStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export const TicketPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export interface Ticket {
  id: string;
  userName: string;
  email?: string;
  whatsappNumber?: string;
  contactMethod: 'WHATSAPP' | 'EMAIL';
  status: TicketStatus;
  priority: TicketPriority;
  initialMessage: string;
  operatorId?: string;
  operator?: { id: string; name: string };
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
  session?: {
    id: string;
    messages: Message[];
  };
}
```

---

## 🔄 END-TO-END DATA FLOWS

### **Flow 1: User Sends Message (AI Mode)**

```
1. Widget: User types and clicks send
   → localStorage check: sessionId exists?
   → If not: POST /api/chat/session (create new session)

2. Widget: Send message
   → POST /api/chat/session/:id/message
   Body: { message: "Hello", type: "user" }

3. Backend: Receive message
   → Create Message in DB (type: USER)
   → Check session.status === ACTIVE (AI mode)
   → Call OpenAI API with context
   → Create Message in DB (type: AI)
   → Emit socket event 'ai_message' to widget

4. Widget: Receive AI response
   → socket.on('ai_message')
   → Display message in chat UI
   → Update localStorage lastMessageAt
```

### **Flow 2: User Requests Operator**

```
1. Widget: User clicks "Parla con operatore"
   → POST /api/chat/session/:id/request-operator

2. Backend: Update session
   → session.status = WAITING
   → Emit 'new_chat_request' to dashboard room

3. Dashboard: Receive notification
   → socket.on('new_chat_request')
   → Desktop notification + audio alert
   → Show chat in "In Attesa" tab
   → Badge counter increment

4. Operator: Accept chat
   → Click "Accetta" button
   → POST /api/chat/sessions/:id/accept

5. Backend: Assign operator
   → Atomic check: status === WAITING
   → session.status = WITH_OPERATOR
   → session.operatorId = currentOperator
   → Emit 'chat_accepted' to widget
   → Emit 'chat_assigned' to dashboard

6. Widget: Operator joined
   → socket.on('chat_accepted')
   → Display "Operatore [Name] si è unito"
   → Update header to show operator mode
```

### **Flow 3: Operator Sends Message**

```
1. Dashboard: Operator types and sends
   → POST /api/chat/:sessionId/message
   Body: { message: "How can I help?" }

2. Backend: Create message
   → Create Message (type: OPERATOR, operatorId)
   → Emit 'operator_message' to session room

3. Widget: Receive message
   → socket.on('operator_message')
   → Display message with operator name
   → Play notification sound
```

### **Flow 4: Create Ticket**

```
1. Widget: User fills ticket form
   → Input: name, email/whatsapp, message, category
   → Click "Invia Ticket"

2. Widget: Submit ticket
   → POST /api/tickets
   Body: {
     sessionId,
     userName,
     contactMethod: "EMAIL",
     email: "user@example.com",
     initialMessage,
     priority: "NORMAL"
   }

3. Backend: Create ticket
   → Generate resumeToken (UUID)
   → resumeTokenExpiresAt = now + 30 days
   → Create Ticket in DB (status: PENDING)
   → Update ChatSession (status: TICKET_CREATED)
   → Emit 'new_ticket_created' to dashboard
   → Send email with resume link

4. Dashboard: Receive notification
   → socket.on('new_ticket_created')
   → Desktop notification
   → Badge "Tickets" increment
   → Appear in /tickets list
```

### **Flow 5: Ticket Management (NEW v2.2)**

```
1. Dashboard: Operator clicks ticket in list
   → Navigate to /tickets/:id

2. Page loads ticket
   → GET /api/tickets/:id
   → Display all details + chat history

3. Operator assigns to self
   → Click "Assegna a me"
   → POST /api/tickets/:id/assign
   → Backend: status = ASSIGNED, operatorId = current

4. Operator marks in progress
   → Click "In Lavorazione"
   → PATCH /api/tickets/:id/status
   Body: { status: "IN_PROGRESS" }

5. Operator resolves
   → Click "Risolvi"
   → PATCH /api/tickets/:id/status
   Body: { status: "RESOLVED", notes: "Risolto via email" }
   → Backend: resolvedAt = now, increment operator stats

6. Operator closes
   → Click "Chiudi"
   → PATCH /api/tickets/:id/status
   Body: { status: "CLOSED" }
```

---

## ⚡ ADVANCED FEATURES (v2.1+)

### **AI Chat Monitoring**
- Dashboard sidebar shows all ACTIVE (AI) sessions
- Operator can "Intervene" to take over
- Auto-refresh every 30 seconds

### **Timeout Management**
- **WAITING Timeout:** 5 min → auto-cancel if no operator accepts
- **Operator Timeout:** 10 min → notify both sides if operator silent
- **User Disconnect:** 5 min grace period → auto-close if no return

### **Chat Reopen**
- User can reopen chat within 5 min of closure
- Button shown in recovery options
- Validates window on both client and server

### **Spam Detection**
- Rate limit: 10 msg/min (block with HTTP 429)
- Alert limit: 20 msg/min (notify operator once)
- WebSocket event `user_spam_detected`

### **Network Quality Detection**
- Visual indicators: 🔴 Offline, 🟡 Reconnecting, 🟢 Online
- Message queue in localStorage
- Auto-send when connection restored
- Max 5 reconnect attempts

### **Security** (v2.3)
- **CSRF Protection:** Double-submit cookie pattern (csrf-csrf) on all operator POST/PUT/DELETE endpoints (v2.2)
- **API Rate Limiting:** 100 req/min per IP (express-rate-limit) (v2.2)
- **Security Headers:** helmet.js (HSTS, X-Frame-Options, etc.) (v2.2)
- **Race Condition Fix:** Atomic accept operation (v2.2)
- **XSS Protection:** Verified secure (HTML escaping) (v2.2)
- **Encryption at Rest:** AES-256-GCM for sensitive settings (API keys, passwords, tokens) (v2.3)
  - Auto-detection of sensitive keys (password, secret, token, apikey)
  - PBKDF2 key derivation (100,000 iterations)
  - Format: `iv:authTag:encrypted` for authenticated encryption
  - Backward compatible with existing plain text values
  - Module: `src/utils/encryption.js`
- **Access Control:** Role-based access (ADMIN-only routes) (v2.3)
  - System Status page restricted to ADMIN role
  - Health endpoints protected with `requireAdmin` middleware
  - "Accesso Negato" UI for unauthorized access

---

## 🎯 BEST PRACTICES FOR FUTURE DEVELOPMENT

### **1. Adding New Features**

When adding a new feature, follow this checklist:

- [ ] **Database:** Update Prisma schema if needed
  - Add model/fields
  - Run `prisma migrate dev --name feature_name`
  - Generate client: `prisma generate`

- [ ] **Backend:**
  - Create/update controller in `src/controllers/`
  - Add routes in `src/routes/`
  - Add WebSocket events if real-time needed
  - Update API documentation in this file

- [ ] **Frontend:**
  - Add TypeScript types in `src/types/index.ts`
  - Create API service method in `src/lib/api.ts`
  - Create page/component
  - Add route in `src/App.tsx`

- [ ] **Testing:**
  - Test API with Postman/curl
  - Test WebSocket with multiple tabs
  - Test error cases (404, 500, validation)
  - Test on mobile (responsive)

- [ ] **Documentation:**
  - Update this ARCHITECTURE.md
  - Update README.md if user-facing
  - Update CHANGELOG.md

### **2. Type Safety & Alignment**

**CRITICAL: ALWAYS maintain type alignment across 4 layers:**

1. **Prisma schema** (source of truth)
2. **Backend validation** (matches Prisma enums)
3. **Frontend types** (`src/types/index.ts`)
4. **Component local types** (StatusBadge, PriorityBadge, etc.)

#### ⚠️ **Common Pitfall: Component Local Types**

Components may have **hardcoded types** that don't import from `@/types`:

```typescript
// ❌ BAD: Hardcoded in component
// src/components/shared/StatusBadge.tsx
type TicketStatus = 'PENDING' | 'OPEN' | 'RESOLVED';  // Missing IN_PROGRESS!

// ✅ GOOD: Import from types
import { TicketStatus } from '@/types';
```

**Files to check when adding enum values:**
- `prisma/schema.prisma` (database enum)
- `src/controllers/*.js` (backend validation arrays)
- `src/types/index.ts` (frontend types)
- `src/components/shared/StatusBadge.tsx` (local type + Record)
- `src/components/shared/PriorityBadge.tsx` (local type + Record)

#### 📝 **Type Alignment Checklist**

When adding a new enum value (e.g., `IN_PROGRESS` to `TicketStatus`):

1. [ ] Update Prisma schema:
   ```prisma
   enum TicketStatus {
     PENDING
     ASSIGNED
     OPEN
     IN_PROGRESS  // NEW
     RESOLVED
     CLOSED
   }
   ```

2. [ ] Update backend validation:
   ```javascript
   const validStatuses = ['PENDING', 'ASSIGNED', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
   ```

3. [ ] Update frontend global types:
   ```typescript
   // src/types/index.ts
   export const TicketStatus = {
     PENDING: 'PENDING',
     IN_PROGRESS: 'IN_PROGRESS',  // NEW
     // ...
   } as const;
   ```

4. [ ] Update component local types:
   ```typescript
   // src/components/shared/StatusBadge.tsx
   type TicketStatus = 'PENDING' | 'ASSIGNED' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

   const statusConfig: Record<Status, {...}> = {
     IN_PROGRESS: { label: 'In Lavorazione', variant: 'default' },  // NEW
   };
   ```

5. [ ] Run TypeScript check:
   ```bash
   npx tsc --noEmit
   ```

#### 🐛 **Real Example: Inconsistency Found & Fixed (31 Oct 2025)**

**Problem:** Added `IN_PROGRESS` to TicketStatus but forgot component local types.

**Impact:** Build failed on Render deployment with:
```
error TS2322: Type 'TicketStatus' is not assignable to type 'Status'.
  Type '"IN_PROGRESS"' is not assignable to type 'Status'.
```

**Root Cause:**
- Prisma schema: ✅ Has IN_PROGRESS
- Backend controller: ✅ Validates IN_PROGRESS
- Frontend types: ✅ Has IN_PROGRESS
- StatusBadge.tsx: ❌ Missing IN_PROGRESS (hardcoded type)

**Fix:** Updated all 4 layers, verified with `tsc --noEmit`.

**Commits:**
- `d735d2d`: Prisma schema fix
- `6621af4`: Frontend types fix
- `44b4b95`: StatusBadge component fix

**Lesson:** Always check component local types when modifying enums!

### **3. WebSocket Events**

**Event naming convention:**
- Use snake_case: `new_chat_request`, `ticket_status_updated`
- Use past tense for completed actions: `chat_closed`, `ticket_assigned`
- Use present for ongoing: `user_typing`, `operator_typing`

**Always emit to correct room:**
```javascript
// To specific session
io.to(`session:${sessionId}`).emit('event_name', data)

// To all dashboard operators
io.to('dashboard').emit('event_name', data)

// To specific operator
io.to(`operator:${operatorId}`).emit('event_name', data)
```

### **4. Error Handling**

**Backend responses:**
```javascript
// Success
res.json({ success: true, data: { ... } })

// Error
res.status(400).json({
  error: {
    message: "Human-readable error",
    code: "ERROR_CODE"  // Optional
  }
})
```

**HTTP Status Codes:**
- 200: Success
- 400: Bad request (validation error)
- 401: Unauthorized (no/invalid token)
- 403: Forbidden (valid token, insufficient permissions)
- 404: Not found
- 409: Conflict (race condition, already exists)
- 429: Rate limit exceeded
- 500: Internal server error

### **5. Database Queries**

**Use indexes for frequent queries:**
```prisma
model Ticket {
  // ... fields ...

  @@index([status])  // If filtering by status
  @@index([operatorId])  // If filtering by operator
  @@index([createdAt])  // If sorting by date
  @@index([status, createdAt])  // Composite for both
}
```

**Use select to limit fields:**
```javascript
// ❌ BAD: Fetches all fields
const tickets = await prisma.ticket.findMany()

// ✅ GOOD: Only needed fields
const tickets = await prisma.ticket.findMany({
  select: {
    id: true,
    userName: true,
    status: true,
    createdAt: true
  }
})
```

### **6. Security**

**Never trust user input:**
```javascript
// ❌ BAD: Direct user input in query
const status = req.body.status
await prisma.ticket.update({ data: { status } })

// ✅ GOOD: Validate first
const validStatuses = ['PENDING', 'ASSIGNED', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
if (!validStatuses.includes(req.body.status)) {
  return res.status(400).json({ error: { message: 'Invalid status' } })
}
```

**Protect operator endpoints:**
```javascript
// routes/tickets.routes.js
import { authenticateToken } from '../middleware/auth.middleware.js'
import { doubleCsrfProtection } from '../server.js'

// ✅ GOOD: Public widget routes (no auth needed)
router.post('/session', createSession)

// ✅ GOOD: Read-only operator endpoints (JWT only)
router.get('/tickets', authenticateToken, getTickets)

// ✅ GOOD: State-changing operator endpoints (JWT + CSRF)
router.post('/tickets/:id/assign', authenticateToken, doubleCsrfProtection, assignTicket)
router.post('/sessions/:id/close', authenticateToken, doubleCsrfProtection, closeSession)

// ❌ BAD: Missing authentication
router.get('/tickets', getTickets)

// ❌ BAD: Missing CSRF on state-changing endpoint
router.post('/tickets/:id/assign', authenticateToken, assignTicket)
```

**CSRF Protection Pattern:**
- **Frontend:** Fetch token from `/api/csrf-token` after login
- **Frontend:** Send token in `X-CSRF-Token` header on POST/PUT/DELETE
- **Backend:** Validate token matches HttpOnly cookie (`__Host-csrf-token`)
- **Public Routes:** No CSRF needed (widget endpoints remain unprotected)

### **7. Performance**

**Avoid N+1 queries with include:**
```javascript
// ❌ BAD: N+1 query
const tickets = await prisma.ticket.findMany()
for (let ticket of tickets) {
  ticket.operator = await prisma.operator.findUnique({ where: { id: ticket.operatorId } })
}

// ✅ GOOD: Single query with join
const tickets = await prisma.ticket.findMany({
  include: {
    operator: { select: { id: true, name: true } }
  }
})
```

---

## 📦 DEPLOYMENT

### **Backend (Render)**
- **Repo:** `mujians/chatbot-lucy-2025`
- **Branch:** `main`
- **Build:** `npm install && npm run build`
  - `npm run build` executes: `npx prisma generate && npx prisma migrate deploy`
- **Start:** `npm start`
- **Env Vars:** `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, etc.

### **Frontend (Render)**
- **Repo:** `mujians/lucine-chatbot`
- **Branch:** `main`
- **Build:** `npm install && npm run build`
- **Publish:** `dist/`
- **Type:** Static Site

### **Widget (Shopify)**
- **Repo:** `mujians/lucine25minimal`
- **File:** `snippets/chatbot-popup.liquid`
- **Deploy:** Manual copy to Shopify theme

---

## 🔧 LOCAL DEVELOPMENT

### **Backend**
```bash
cd lucine-backend
npm install
cp .env.example .env  # Configure DATABASE_URL, etc.
npx prisma generate
npx prisma migrate dev
npm run dev  # http://localhost:3000
```

### **Frontend**
```bash
cd lucine-frontend
npm install
npm run dev  # http://localhost:5173
```

**Environment:**
```env
# .env.local
VITE_API_URL=http://localhost:3000/api
```

---

## 📞 SUPPORT

**Issues:** https://github.com/mujians/chatbot-lucy-2025/issues
**Documentation:** `/docs` folder
**Status:** v2.2.0 Production Ready ✅

---

**Generated:** 31 Ottobre 2025
**Maintained by:** Claude Code + @mujians
