# Audit Backend - Report Critico

**Data**: 29 Ottobre 2025
**Analista**: Claude Code (Audit Sistematico)
**Scope**: Backend API (`/backend/src/`)
**Metodologia**: Code review, pattern analysis, architectural analysis

---

## 🎯 Executive Summary

Il backend presenta un'architettura funzionante ma con **criticità significative** legate principalmente a:
1. **File monolitici troppo grandi** (`chat.controller.js` - 1476 righe)
2. **Storage non scalabile** (messages e notes in JSON serializzati)
3. **Inconsistenze Socket.IO** nei nomi delle room
4. **Mancanza validation robusta** in diversi endpoint
5. **Error handling non uniforme**
6. **Possibili race conditions** in operazioni concorrenti

**Severity Distribution**:
- 🔴 CRITICAL: 4 issues
- 🟠 HIGH: 8 issues
- 🟡 MEDIUM: 12 issues
- 🟢 LOW: 6 issues

---

## 🔴 CRITICAL ISSUES

### C1: Messages Storage Non Scalabile

**File**: `chat.controller.js`
**Lines**: 53, 152, 161, 207, 286-297, 433, 781

**Problema**:
```javascript
// Chat messages stored as JSON string
messages: JSON.stringify([...])  // Line 53

// Every operation:
const messages = JSON.parse(session.messages || '[]');  // Line 152
messages.push(userMessage);
await prisma.chatSession.update({
  data: { messages: JSON.stringify(messages) }
});
```

**Criticità**:
1. **Performance degradation**: Query caricano TUTTE le chat messages ad ogni operazione
2. **Non paginabile**: Impossibile paginare messaggi senza caricare tutto
3. **Non searchable**: Ricerca fulltext inefficiente (line 528: `string_contains`)
4. **Race conditions**: Due update simultanei possono sovrascriversi
5. **Memory issues**: Chat con 1000+ messaggi occupano megabyte in RAM
6. **Database bloat**: Campo Text cresce indefinitamente

**Impact**:
- Chat lunghe (>100 messaggi) diventano lente
- Dashboard crash se apre chat con 1000+ messaggi
- Race condition perde messaggi se operatore e user inviano simultaneamente

**Soluzione Raccomandata**:
```prisma
// NEW Model
model Message {
  id          String      @id @default(uuid())
  sessionId   String
  session     ChatSession @relation(...)
  type        MessageType // USER, AI, OPERATOR, SYSTEM
  content     String      @db.Text
  operatorId  String?
  metadata    Json?       // confidence, suggestOperator, etc.
  createdAt   DateTime    @default(now())

  @@index([sessionId, createdAt])
  @@index([type])
}

// Controller
const messages = await prisma.message.findMany({
  where: { sessionId },
  orderBy: { createdAt: 'desc' },
  take: 50,    // Paginated!
  skip: page * 50
});
```

**Effort**: 2-3 giorni (migration + refactor controllers + update frontend)
**Priority**: 🔴 P0 - Blocker per scalabilità

---

### C2: Internal Notes Storage Identico Problema

**File**: `chat.controller.js`
**Lines**: 1000, 1010-1014, 1057, 1077-1078

**Problema**:
```javascript
const notes = JSON.parse(session.internalNotes || '[]');  // Line 1000
notes.push(newNote);
await prisma.chatSession.update({
  data: { internalNotes: JSON.stringify(notes) }
});
```

**Criticità**: Identico a C1 - race conditions, non scalabile

**Soluzione Raccomandata**:
```prisma
model InternalNote {
  id          String      @id @default(uuid())
  sessionId   String
  session     ChatSession @relation(...)
  content     String      @db.Text
  operatorId  String
  operator    Operator    @relation(...)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime?

  @@index([sessionId])
}
```

**Effort**: 1 giorno
**Priority**: 🟠 P1

---

### C3: Socket.IO Room Name Inconsistency

**File**: `chat.controller.js`
**Lines**: 476, 482 vs 394, 314, 177, 301

**Problema**:
```javascript
// Line 476-482 (closeSession):
io.to(`chat:${sessionId}`).emit('chat_closed', {...});  // ❌ COLON
io.to(`chat:${sessionId}`).emit('new_message', {...});  // ❌ COLON

// Line 394 (sendOperatorMessage):
io.to(`chat_${sessionId}`).emit('operator_message', {...});  // ✅ UNDERSCORE

// Line 314 (requestOperator):
io.to(`chat_${sessionId}`).emit('operator_assigned', {...});  // ✅ UNDERSCORE

// Line 177 (sendUserMessage):
io.to(`operator_${session.operatorId}`).emit('user_message', {...});  // ✅ UNDERSCORE

// Line 805, 811 (transferSession):
io.to(`operator:${session.operatorId}`).emit(...);  // ❌ COLON - WRONG!
io.to(`operator:${toOperatorId}`).emit(...);  // ❌ COLON - WRONG!
```

**Criticità**:
- **Inconsistenza critica**: Alcuni emit usano `:`, altri `_`
- **Eventi persi**: Widget/Dashboard non ricevono notifiche se room name sbagliata
- **Già fixato parzialmente** (secondo ROADMAP P2), MA ancora presente in `transferSession` e `closeSession`

**Impact**:
- `chat_closed` event MAI ricevuto dal widget (line 476 usa `chat:` invece di `chat_`)
- Transfer chat notifiche perse (line 805, 811 usano `operator:`)

**Fix Immediato**:
```javascript
// Line 476-482: CHANGE
io.to(`chat_${sessionId}`).emit('chat_closed', {...});  // ✅ FIX
io.to(`chat_${sessionId}`).emit('new_message', {...});  // ✅ FIX

// Line 805, 811: CHANGE
io.to(`operator_${session.operatorId}`).emit(...);  // ✅ FIX
io.to(`operator_${toOperatorId}`).emit(...);  // ✅ FIX
```

**Effort**: 10 minuti
**Priority**: 🔴 P0 - Bug critico

---

### C4: Race Condition in `requestOperator`

**File**: `chat.controller.js`
**Lines**: 254-283

**Problema**:
```javascript
// Find available operators
const availableOperators = await prisma.operator.findMany({
  where: { isAvailable: true },
  orderBy: { totalChatsHandled: 'asc' }, // Least busy first
});

if (availableOperators.length === 0) { /* ... */ }

// Assign to least busy operator
const assignedOperator = availableOperators[0];

// Update session - NO TRANSACTION!
await prisma.chatSession.update({
  where: { id: sessionId },
  data: {
    status: 'WITH_OPERATOR',
    operatorId: assignedOperator.id,
  },
});
```

**Criticità**:
1. **Race condition**: Due user richiedono operatore simultaneamente
2. Entrambi leggono `availableOperators[0]` (stesso operatore)
3. Entrambi assegnati allo stesso operatore
4. Operatore riceve 2 chat invece di bilanciamento

**Impact**:
- Load balancing non funziona
- Operatore sovraccarico mentre altri idle
- Statistiche `totalChatsHandled` inaccurate

**Soluzione Raccomandata**:
```javascript
// Use Prisma transaction + atomic increment
const assignedOperator = await prisma.$transaction(async (tx) => {
  // Find with FOR UPDATE lock
  const operator = await tx.operator.findFirst({
    where: { isAvailable: true },
    orderBy: { totalChatsHandled: 'asc' },
  });

  if (!operator) return null;

  // Atomic update session
  await tx.chatSession.update({
    where: { id: sessionId },
    data: {
      status: 'WITH_OPERATOR',
      operatorId: operator.id,
    },
  });

  // Increment count atomically
  await tx.operator.update({
    where: { id: operator.id },
    data: { totalChatsHandled: { increment: 1 } },
  });

  return operator;
});
```

**Effort**: 30 minuti
**Priority**: 🟠 P1

---

## 🟠 HIGH PRIORITY ISSUES

### H1: `transferSession` Check `isOnline` Deprecato

**File**: `chat.controller.js`
**Line**: 774

**Problema**:
```javascript
if (!targetOperator.isOnline || !targetOperator.isAvailable) {
  return res.status(400).json({
    error: { message: 'Target operator is not available' },
  });
}
```

**Criticità**:
- Secondo ROADMAP, `isOnline` è **deprecato** (removed in fix P0)
- Background job auto-offline disabilitato
- Field `isOnline` non aggiornato → check sempre fallisce

**Fix**:
```javascript
if (!targetOperator.isAvailable) {  // Remove isOnline check
  return res.status(400).json({
    error: { message: 'Target operator is not available' },
  });
}
```

**Effort**: 2 minuti
**Priority**: 🟠 P1

---

### H2: Missing Validation in `sendOperatorMessage`

**File**: `chat.controller.js`
**Lines**: 342-410

**Problema**:
```javascript
export const sendOperatorMessage = async (req, res) => {
  const { message, operatorId } = req.body;

  if (!message) {  // ✅ Good
    return res.status(400).json({ error: { message: 'Message is required' } });
  }

  // ❌ MISSING: No validation that operatorId matches session.operatorId
  // ❌ MISSING: No validation that session.status === 'WITH_OPERATOR'
  // ❌ MISSING: No validation that operator owns this chat
```

**Criticità**:
1. **Security issue**: Operatore A può inviare messaggi a chat di Operatore B
2. **Logic error**: Messaggio operatore inviato a chat ACTIVE (senza operatore)
3. **Data inconsistency**: operatorId nel messaggio può essere diverso da session.operatorId

**Impact**:
- Operatore malintenzionato può impersonare altri operatori
- Chat state inconsistente

**Fix**:
```javascript
// Validate session is WITH_OPERATOR
if (session.status !== 'WITH_OPERATOR') {
  return res.status(400).json({
    error: { message: 'Session is not assigned to an operator' },
  });
}

// Validate operator owns this chat (if operatorId provided)
if (operatorId && operatorId !== session.operatorId) {
  return res.status(403).json({
    error: { message: 'You cannot send messages to chats assigned to other operators' },
  });
}

// Use session.operatorId, not request body
const operatorMessage = {
  operatorId: session.operatorId,  // ✅ Always use session's operator
  operatorName: session.operator?.name,
  // ...
};
```

**Effort**: 15 minuti
**Priority**: 🟠 P1 - Security issue

---

### H3: `closeSession` Increments Stats BEFORE Chat Actually Closed

**File**: `chat.controller.js`
**Lines**: 466-472

**Problema**:
```javascript
// Update session to CLOSED
const updatedSession = await prisma.chatSession.update({
  where: { id: sessionId },
  data: {
    status: 'CLOSED',
    closedAt: new Date(),
    messages: JSON.stringify(messages),
  },
});

// ❌ AFTER closing, increment stats
// Problem: If email fails, transaction not rolled back
if (session.operatorId) {
  await prisma.operator.update({
    where: { id: session.operatorId },
    data: { totalChatsHandled: { increment: 1 } },
  });
}
```

**Criticità**:
- Se `closeSession` chiamato 2 volte per errore → stats incrementati 2 volte
- Nessuna protezione idempotenza
- Stats possono essere inaccurate

**Fix**:
```javascript
// Only increment if chat was not already closed
if (session.status !== 'CLOSED' && session.operatorId) {
  await prisma.operator.update({
    where: { id: session.operatorId },
    data: { totalChatsHandled: { increment: 1 } },
  });
}
```

**Effort**: 5 minuti
**Priority**: 🟡 P2

---

### H4: Missing Transaction in Multi-Step Operations

**File**: Multiple functions
**Lines**: Various

**Problema**: Molte operazioni fanno **multiple DB updates** senza transazioni:

**Example 1 - `createSession`** (lines 18-55):
```javascript
// Step 1: Find or create user
let user = await prisma.user.findUnique({...});
if (!user) {
  user = await prisma.user.create({...});
} else {
  await prisma.user.update({...});  // Increment totalChats
}

// Step 2: Create session
const session = await prisma.chatSession.create({...});

// ❌ If session create fails, user.totalChats already incremented!
```

**Example 2 - `addInternalNote`** (lines 1000-1029):
```javascript
const notes = JSON.parse(session.internalNotes || '[]');
notes.push(newNote);
const updated = await prisma.chatSession.update({...});

// ❌ If update fails, note ID already generated, lost in void
```

**Impact**:
- Data inconsistency su failure
- Stats incorrect
- Lost notes/messages

**Fix Pattern**:
```javascript
const result = await prisma.$transaction(async (tx) => {
  // All operations here
  const user = await tx.user.upsert({...});
  const session = await tx.chatSession.create({...});
  return session;
});
```

**Effort**: 1-2 ore (refactor multiple functions)
**Priority**: 🟠 P1

---

### H5: Search Functionality Inefficient

**File**: `chat.controller.js`
**Lines**: 525-529

**Problema**:
```javascript
if (search) {
  where.OR = [
    { userName: { contains: search, mode: 'insensitive' } },
    { messages: { string_contains: search } }, // ❌ FULL SCAN su JSON Text field!
  ];
}
```

**Criticità**:
1. **Performance disaster**: `string_contains` su campo Text JSON = FULL TABLE SCAN
2. **No index**: Impossibile indicizzare JSON serializzato
3. **Scale failure**: Con 10,000+ chat, query impiega secondi/minuti

**Impact**:
- Dashboard search lentissima
- Database overload
- Timeout su production

**Soluzione**:
- Separare Messages in tabella dedicata (vedi C1)
- Creare fulltext index su `Message.content`
- Oppure: usare ElasticSearch/PostgreSQL fulltext

**Effort**: Parte di fix C1
**Priority**: 🟡 P2 (ma diventa 🔴 P0 con >1000 chat)

---

### H6: Error Handling Non Uniforme

**File**: Tutti i controllers
**Pattern**:

**Good Pattern** (alcune funzioni):
```javascript
try {
  // ...
} catch (error) {
  console.error('Specific error:', error);
  res.status(500).json({
    error: { message: 'Internal server error' },
  });
}
```

**Bad Pattern** (altre funzioni):
```javascript
try {
  // ...
} catch (error) {
  console.error(error);  // ❌ Generic, no context
  res.status(500).json({ error: 'Server error' });  // ❌ Inconsistent format
}
```

**Criticità**:
- Frontend non sa quale formato aspettarsi
- Logs non utili per debug (missing context)
- Nessun error tracking (Sentry, LogRocket, etc.)

**Fix**:
1. Creare error handler middleware unificato
2. Errori custom con codes
3. Logging strutturato

**Effort**: 1 giorno
**Priority**: 🟡 P2

---

### H7: File Upload Manca Virus Scan

**File**: `upload.service.js`
**Lines**: N/A (feature mancante)

**Problema**: File upload implementato (P0.1) ma:
- ❌ Nessun virus/malware scan
- ❌ Solo validazione MIME type (facilmente spoofabile)
- ❌ Nessun sanitization filename

**Criticità**:
1. **Security risk**: User upload malware, operator download, infection
2. **Legal liability**: Storing malware files
3. **Cloudinary cost**: Malware files occupano storage

**Soluzione**:
```javascript
import ClamScan from 'clamscan';

// In uploadFile function:
const clamScan = await new ClamScan().init({...});
const { isInfected } = await clamScan.isInfected(file.path);

if (isInfected) {
  fs.unlinkSync(file.path);
  throw new Error('File contains malware');
}
```

**Effort**: 4 ore
**Priority**: 🟠 P1 - Security

---

### H8: JWT Secret Hardcoded?

**File**: `auth.controller.js`, `server.js`, `config/index.js`
**Lines**: Da verificare

**Problema**: Da verificare se JWT_SECRET è:
- ✅ In environment variable (good)
- ❌ Hardcoded in config (bad)
- ❌ Default value se missing (very bad)

**Criticità**:
- Se hardcoded o default → **CRITICAL security issue**
- Chiunque può generare token JWT validi
- Full system compromise

**Action**: URGENT verification needed
**Priority**: 🔴 P0 IF hardcoded, 🟢 OK if properly env var

---

## 🟡 MEDIUM PRIORITY ISSUES

### M1: Missing Input Sanitization

**File**: Multiple controllers
**Lines**: Various

**Problema**: User input non sanitizzato:
```javascript
const { userName, userEmail } = req.body;  // ❌ No sanitization
const session = await prisma.chatSession.create({
  data: {
    userName: userName || null,  // ❌ Can contain XSS payload
  },
});
```

**Impact**:
- **XSS risk**: Operator dashboard mostra userName non sanitized
- **SQL injection risk**: (mitigato da Prisma, ma best practice mancante)

**Fix**:
```javascript
import validator from 'validator';
import xss from 'xss';

const userName = xss(validator.trim(req.body.userName || ''));
const userEmail = validator.isEmail(req.body.userEmail)
  ? validator.normalizeEmail(req.body.userEmail)
  : null;
```

**Effort**: 2 ore
**Priority**: 🟡 P2

---

### M2: Missing Rate Limiting

**File**: Nessun middleware rate limiting visibile
**Lines**: N/A

**Problema**:
- Nessun rate limit su endpoint pubblici (widget)
- User può spammare `/api/chat/session` → creare 1000 sessioni
- User può spammare `/api/chat/session/:id/message` → DoS backend

**Impact**:
- **DoS vulnerability**
- **Database spam**
- **Costs spike** (OpenAI API calls)

**Fix**:
```javascript
import rateLimit from 'express-rate-limit';

const createSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 sessions per 15min per IP
  message: 'Too many sessions created. Please try again later.',
});

app.post('/api/chat/session', createSessionLimiter, createSession);
```

**Effort**: 3 ore
**Priority**: 🟠 P1

---

### M3: No Pagination in `getSessions`

**File**: `chat.controller.js`
**Lines**: 500-562

**Problema**:
```javascript
const sessions = await prisma.chatSession.findMany({
  where,
  take: parseInt(limit),  // ✅ Has limit (default 50)
  // ❌ BUT no skip/cursor for pagination!
});
```

**Criticità**:
- Dashboard può caricare solo prime 50 chat
- Impossibile navigare a chat più vecchie
- Nessun cursor-based pagination

**Fix**:
```javascript
const { limit = 50, cursor } = req.query;

const sessions = await prisma.chatSession.findMany({
  where,
  take: parseInt(limit),
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  orderBy: { lastMessageAt: 'desc' },
});

res.json({
  success: true,
  data: sessions,
  nextCursor: sessions.length === parseInt(limit)
    ? sessions[sessions.length - 1].id
    : null,
});
```

**Effort**: 1 ora
**Priority**: 🟡 P2

---

### M4: `deletedAt` Soft Delete Non Uniforme

**File**: Vari modelli
**Lines**: 505, 576

**Problema**: Soft delete implementato MA:
- `ChatSession` ha `deletedAt` (line 505, 576)
- Altri modelli (`Ticket`, `KnowledgeItem`) probabilmente NO
- Inconsistente tra modelli

**Fix**: Aggiungere `deletedAt` a tutti i modelli o rimuovere feature

**Effort**: 2 ore
**Priority**: 🟢 P3

---

### M5-M12: Varie Ottimizzazioni Minori

**M5**: `archiveSession` (line 609) non verifica se operator è owner
**M6**: `flagSession` (line 676) non valida `reason` length (possibile spam)
**M7**: Missing `updatedAt` auto-update in molti modelli
**M8**: Console.log everywhere (prod logs cluttered)
**M9**: No request ID tracking (hard to trace errors)
**M10**: Hardcoded strings non i18n-ready
**M11**: No OpenAPI/Swagger documentation
**M12**: Missing health check granularity (DB, OpenAI, etc.)

**Effort**: 1-3 giorni totali
**Priority**: 🟢 P3

---

## 🟢 LOW PRIORITY / CODE SMELL

### L1: Controller Too Large

**File**: `chat.controller.js`
**Size**: 1476 lines

**Problem**: God object anti-pattern

**Recommendation**: Split into:
- `chat-session.controller.js` (CRUD)
- `chat-message.controller.js` (messaging)
- `chat-operator.controller.js` (transfer, assign)
- `chat-admin.controller.js` (archive, flag, delete)

**Effort**: 3 ore
**Priority**: 🟢 P3

---

### L2: Inconsistent Naming

- `closeSession` vs `archiveSession` vs `deleteSession` (mix verb+noun)
- `getSessions` (plural) vs `getSession` (singular)
- Some functions return `data: session`, others `data: { session }`

**Fix**: Adottare naming convention uniforme
**Priority**: 🟢 P3

---

### L3: Duplicate Code

Pattern ripetuto 20+ volte:
```javascript
const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
if (!session) {
  return res.status(404).json({ error: { message: 'Session not found' } });
}
```

**Fix**: Helper function `getSessionOrThrow(sessionId)`
**Effort**: 1 ora
**Priority**: 🟢 P3

---

### L4: Magic Numbers

- `take: parseInt(limit)` default 50 (line 550) - why 50?
- Timeouts, retry logic non configurabili

**Fix**: Constants file
**Priority**: 🟢 P3

---

### L5-L6: Minor Issues

**L5**: Alcuni endpoint non hanno description comment
**L6**: No TypeScript types (usando JSDoc potrebbe aiutare)

**Priority**: 🟢 P3

---

## 📊 Summary Statistics

**Total Issues Found**: 30
**Critical**: 4
**High**: 8
**Medium**: 12
**Low**: 6

**Estimated Fix Time**:
- Critical (P0): 3-4 giorni
- High (P1): 2-3 giorni
- Medium (P2): 3-4 giorni
- Low (P3): 2 giorni

**Total Effort**: 10-13 giorni (2 settimane) per risolvere tutti

---

## 🎯 Raccomandazioni Prioritarie

### IMMEDIATE (Questa Settimana)

1. **Fix C3**: Socket.IO room names (10 min) ← Bug che blocca funzionalità
2. **Verify H8**: JWT secret not hardcoded (5 min) ← Security critical
3. **Fix H1**: Remove `isOnline` check from `transferSession` (2 min)
4. **Fix H2**: Add validation to `sendOperatorMessage` (15 min)

**Total**: 32 minuti ← FACILE WIN

### SHORT TERM (Prossime 2 Settimane)

5. **Fix C1**: Refactor messages to separate table (3 giorni) ← Scalability blocker
6. **Fix C4**: Add transaction to `requestOperator` (30 min)
7. **Add M2**: Rate limiting (3 ore)
8. **Add H7**: Virus scan file upload (4 ore)

### LONG TERM (Prossimo Mese)

9. **Fix C2**: Internal notes to separate table (1 giorno)
10. **Refactor L1**: Split chat.controller.js (3 ore)
11. **Fix H4**: Add transactions everywhere (2 ore)
12. **Improve H6**: Unified error handling (1 giorno)

---

## 🔬 Testing Recommendations

**Unit Tests Mancanti**:
- Controllers (0% coverage stimata)
- Services (0% coverage stimata)

**Integration Tests Mancanti**:
- API endpoints
- WebSocket events
- Database transactions

**Recommendation**: Aggiungere Jest + Supertest
**Effort**: 1 settimana setup + ongoing

---

## 📚 Documentazione Mancante

- [ ] API reference completo (Swagger/OpenAPI)
- [ ] Database schema ER diagram
- [ ] WebSocket events documentation
- [ ] Error codes reference
- [ ] Rate limiting policies
- [ ] Security best practices guide

---

**Report Creato**: 29 Ottobre 2025
**Next**: Audit Frontend Dashboard (`AUDIT_FRONTEND_REPORT.md`)
