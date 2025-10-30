# Audit: Illusioni di Funzionamento

**Data Audit**: 30 Ottobre 2025, 03:00
**Obiettivo**: Identificare funzionalità che SEMBRANO funzionare ma sono rotte o parziali

---

## 📊 TL;DR - EXECUTIVE SUMMARY

**Definizione "Illusione di Funzionamento"**:
> Una funzionalità che esegue senza errori visibili, restituisce successo, e appare funzionante nei test superficiali, ma in realtà:
> - Non produce l'effetto previsto
> - Produce l'effetto solo in alcuni casi (edge cases falliscono silenziosamente)
> - Produce l'effetto ma con side effects nascosti
> - È implementata ma mai effettivamente utilizzata

**Illusioni Trovate**: 12 casi critici

**Categorie**:
1. 🔴 Eventi WebSocket mai ricevuti (3 casi)
2. 🔴 Funzionalità che falliscono silenziosamente (4 casi)
3. 🔴 Race conditions invisibili (2 casi)
4. 🔴 Codice morto che crea confusione (3 casi)

**Impatto**: 🔴 CRITICAL - Funzionalità appaiono corrette ma non lo sono

---

## 🎭 ILLUSION #1: Ticket Resumed Notifications

**File**: `backend/src/controllers/ticket.controller.js:383`

### Come Appare
✅ Operatore riprende ticket
✅ Backend emette evento `ticket_resumed`
✅ Console.log mostra "Event emitted"
✅ Nessun errore

### La Realtà
```javascript
// Line 383
io.to(`operator:${ticket.operatorId}`).emit('ticket_resumed', {
  //    ^^^^^^^^^ WRONG ROOM NAME!
```

**Verità**: Evento emesso nella room **sbagliata**
- WebSocket service usa: `operator_{operatorId}` (underscore)
- Ticket controller emette a: `operator:{operatorId}` (colon)
- Nessun client è in quella room
- Evento va nel vuoto

### Test Scenario
```javascript
// Test 1: Resume ticket
POST /api/tickets/123/resume

// Response
{ success: true, message: "Ticket resumed" } ✅

// Socket.io event emitted
io.to('operator:abc-123').emit('ticket_resumed', {...}) ✅

// Operatore riceve notifica?
❌ NO - Operatore è in room 'operator_abc-123'

// Error log?
❌ NO - Socket.io non logga "room not found"

// User Experience
Operatore clicca "Resume" → "Operazione completata con successo"
Ma non riceve notifica in-app → Deve refresh manuale per vedere cambio stato
```

### Perché È Un'Illusione
- ✅ HTTP request completa con successo
- ✅ Database aggiornato correttamente
- ✅ WebSocket emit() chiamato senza errori
- ❌ Notifica mai ricevuta (fallimento silenzioso)

**Scoperta**: Solo testando con dashboard aperta si nota la mancanza della notifica

**Fix**: Line 383, change `operator:` to `operator_`

---

## 🎭 ILLUSION #2: WhatsApp Privacy

**File**: `backend/src/controllers/whatsapp.controller.js:72,88,226`

### Come Appare
✅ User A invia messaggio WhatsApp
✅ Backend processa correttamente
✅ Operatore riceve messaggio
✅ Tutto sembra funzionare

### La Realtà
```javascript
// Lines 72, 88, 226
io.emit('whatsapp_message', {...})  // ← Global broadcast!
```

**Verità**: Messaggio broadcastato a TUTTI i client connessi

### Test Scenario
```javascript
// Scenario: Due utenti + Due operatori + Dashboard admin

User A (session-1): Invia "Ciao" via WhatsApp
  ↓
Backend: io.emit('whatsapp_message', {
  sessionId: 'session-1',
  message: 'Ciao'
})
  ↓
Ricevono evento:
  ✅ User A widget (session-1) - CORRECT
  ❌ User B widget (session-2) - LEAK!
  ✅ Operator 1 dashboard - CORRECT
  ❌ Operator 2 dashboard (not assigned) - LEAK!
  ❌ Admin dashboard - LEAK!

// Privacy Impact
User B vede console.log:
  "New WhatsApp message: Ciao (from session-1)"
```

### Perché È Un'Illusione
- ✅ Messaggio arriva a destinazione corretta
- ✅ Nessun errore JavaScript
- ✅ Funzionalità principale funziona
- ❌ Side effect: Privacy leak silenzioso
- ❌ Altri client ricevono dati non autorizzati

**Scoperta**: Solo aprendo due widget contemporaneamente si nota il leak

**Fix**: Use room-specific emits
```javascript
io.to(`chat_${sessionId}`).emit('whatsapp_message', {...})
```

---

## 🎭 ILLUSION #3: Operator Authentication (WebSocket)

**File**: `backend/src/services/websocket.service.js:11-14`

### Come Appare
✅ Dashboard operator login → JWT token ricevuto
✅ WebSocket connection established
✅ Operator joins room
✅ Riceve chat assignments

### La Realtà
```javascript
socket.on('operator_join', (data) => {
  const { operatorId } = data;
  socket.join(`operator_${operatorId}`);  // ← NO AUTH CHECK!
});
```

**Verità**: Chiunque può joinare qualsiasi operator room

### Test Scenario
```javascript
// Malicious user opens browser console on widget page

// Connect to WebSocket
const socket = io('https://backend.com');

// Emit operator_join with random ID
socket.emit('operator_join', {
  operatorId: 'real-operator-uuid'
});

// Result
socket.on('new_chat_request', (data) => {
  console.log('Received chat request:', data);
  // ❌ Attacker now receives ALL chats for that operator!
});

// Operator's Experience
Operator sees:
  - "You have a new chat request from Mario"
  ✅ Appears normal

Attacker sees:
  - Same notification
  ❌ Impersonating operator, no error
```

### Perché È Un'Illusione
- ✅ Operatori autenticati possono lavorare normalmente
- ✅ Sistema funziona per use case legittimo
- ❌ Nessuna verifica chi fa `operator_join`
- ❌ Attacker può impersonare senza autenticazione

**Scoperta**: Solo con test di sicurezza si scopre la vulnerabilità

**Fix**: Verify JWT before allowing room join

---

## 🎭 ILLUSION #4: deleteInternalNote Race Condition

**File**: `backend/src/controllers/chat.controller.js:1330-1380`

### Come Appare
✅ Operator deletes note → "Note deleted successfully"
✅ Dashboard aggiorna UI
✅ Refresh mostra nota rimossa
✅ Tutto appare corretto

### La Realtà
```javascript
// addInternalNote - uses transaction lock ✅
const updated = await addInternalNoteWithLock(sessionId, newNote);

// updateInternalNote - uses transaction lock ✅
const updated = await updateInternalNoteWithLock(sessionId, noteId, content);

// deleteInternalNote - NO LOCK! ❌
const updated = await prisma.chatSession.update({
  where: { id: sessionId },
  data: { internalNotes: JSON.stringify(notes) },
});
```

**Verità**: Delete ha race condition, Add/Update no

### Test Scenario
```javascript
// Session has 3 notes: [A, B, C]

// Time 0ms: Operator 1 deletes note A
  1. Read: [A, B, C]
  2. Remove A: [B, C]

// Time 5ms: Operator 2 deletes note B (simultaneously)
  1. Read: [A, B, C]  ← Still sees A (not committed yet)
  2. Remove B: [A, C]

// Time 10ms: Operator 1 commits
  Database: [B, C]

// Time 15ms: Operator 2 commits
  Database: [A, C]  ← OVERWRITES! Note B deletion lost!

// Result
- Operator 1 sees: "Note A deleted ✅"
- Operator 2 sees: "Note B deleted ✅"
- Reality: Only note B deleted, note A still there ❌
```

### Perché È Un'Illusione
- ✅ Single delete always works
- ✅ UI shows success message
- ✅ Most of the time works correctly
- ❌ Concurrent deletes silently lose data
- ❌ No error, no warning

**Scoperta**: Solo con test di concorrenza si nota la perdita di dati

**Fix**: Use `deleteInternalNoteWithLock()` helper (same pattern as update)

---

## 🎭 ILLUSION #5: Search in Messages

**File**: `backend/src/controllers/chat.controller.js:725`

### Come Appare
✅ Dashboard search bar: "keyword"
✅ Results appear for old chats
✅ Search seems to work

### La Realtà
```javascript
// getSessions search query (line 725)
if (search) {
  where.OR = [
    { userName: { contains: search } },
    { messages: { string_contains: search } }  // ← OLD JSON FIELD!
  ];
}
```

**Verità**: Cerca nel campo `messages` (JSON), non nella tabella `Message`

### Test Scenario
```javascript
// Session created BEFORE Oct 29 (before BUG #6)
Session 1:
  messages: "[{content: 'Hello world'}, ...]" (JSON field)
  messagesNew: [] (empty - not migrated)

// Session created AFTER Oct 29
Session 2:
  messages: "[]" (empty - new sessions don't use this)
  messagesNew: [{content: 'Hello world'}, ...] (Message table)

// Search for "Hello"
Dashboard search: "Hello"
  ↓
Query: WHERE messages::text ILIKE '%Hello%'
  ↓
Results:
  ✅ Session 1 found (has "Hello" in JSON)
  ❌ Session 2 NOT found (JSON is empty)

// User Experience
Old chats: Searchable ✅
New chats: NOT searchable ❌ (appears like they have no messages)
```

### Perché È Un'Illusione
- ✅ Search works for old data
- ✅ No JavaScript errors
- ✅ Search bar functional
- ❌ New sessions invisible to search
- ❌ Degrades over time (more new sessions = less searchable)

**Scoperta**: Solo cercando contenuto in chat recenti si nota il problema

**Fix**: Search in `messagesNew` relation instead
```javascript
{ messagesNew: { some: { content: { contains: search } } } }
```

---

## 🎭 ILLUSION #6: Close Chat Multiple Times

**File**: `backend/src/controllers/chat.controller.js:617-691`

### Come Appare
✅ Operator clicks "Close Chat"
✅ Chat closed successfully
✅ Email transcript sent to user

### La Realtà
```javascript
export const closeSession = async (req, res) => {
  // ❌ NO CHECK if already closed!

  const result = await createMessage(sessionId, {
    type: 'SYSTEM',
    content: 'La chat è stata chiusa...',
  }, {
    status: 'CLOSED',
  });

  // Send email
  if (userEmail) {
    await emailService.sendChatTranscript(...);
  }
}
```

**Verità**: Nessun controllo idempotenza

### Test Scenario
```javascript
// Scenario: Slow network, user double-clicks

Time 0ms: Operator clicks "Close Chat"
  → Request A: POST /api/chat/session/123/close

Time 100ms: UI laggy, operator clicks again
  → Request B: POST /api/chat/session/123/close

// Request A (Time 200ms)
  1. Get session (status: ACTIVE)
  2. Create closing message ✅
  3. Set status = CLOSED ✅
  4. Send email to user@example.com ✅
  5. Emit WebSocket event ✅

// Request B (Time 250ms)
  1. Get session (status: CLOSED)  ← Already closed!
  2. Create ANOTHER closing message ❌
  3. Set status = CLOSED (no-op)
  4. Send email AGAIN to user@example.com ❌
  5. Emit WebSocket event AGAIN ❌

// User Experience
User receives:
  📧 Email 1: "La tua chat è stata chiusa"
  📧 Email 2: "La tua chat è stata chiusa" (duplicate)

Chat window shows:
  🤖 "La chat è stata chiusa dall'operatore"
  🤖 "La chat è stata chiusa dall'operatore" (duplicate)
```

### Perché È Un'Illusione
- ✅ First close works perfectly
- ✅ Database state correct
- ✅ Most users see correct behavior
- ❌ Double-click sends duplicate emails
- ❌ No idempotency check

**Scoperta**: Solo con network lag o test di doppio click si nota

**Fix**: Add status check
```javascript
if (session.status === 'CLOSED') {
  return res.status(400).json({ error: 'Already closed' });
}
```

---

## 🎭 ILLUSION #7: Large Session Performance

**File**: `backend/src/controllers/chat.controller.js:376-385`

### Come Appare
✅ User sends message
✅ AI responds
✅ Fast response (<200ms)

### La Realtà
```javascript
// sendUserMessage
const existingMessages = await prisma.message.findMany({
  where: { sessionId },
  orderBy: { createdAt: 'asc' },
  // ❌ NO LIMIT!
});

const aiResult = await generateAIResponse(message, messagesForAI);
```

**Verità**: Carica TUTTI i messaggi della sessione

### Test Scenario
```javascript
// New chat (10 messages)
User: "Ciao"
  ↓
Backend: Load 10 messages (1ms) ✅
AI: Generate response (200ms) ✅
Total: 201ms ✅

// Chat after 1 week (1,000 messages)
User: "Ciao"
  ↓
Backend: Load 1,000 messages (50ms) ⚠️
AI: Generate response (200ms) ✅
Total: 250ms ⚠️

// Chat after 1 month (10,000 messages)
User: "Ciao"
  ↓
Backend: Load 10,000 messages (500ms) ❌
AI: Generate response (200ms) ✅
Total: 700ms ❌

// User Experience Timeline
Day 1: "Wow, so fast!" ✅
Day 7: "Hmm, a bit slow" ⚠️
Day 30: "Why is this taking so long?" ❌
Day 60: "This is unusable" 🔥
```

### Perché È Un'Illusione
- ✅ Works perfectly in testing (small sessions)
- ✅ Works fine in production initially
- ❌ Performance degrades linearly with session age
- ❌ No warning, just gets slower
- ❌ Eventually becomes unusable

**Scoperta**: Solo con chat di lunga durata si nota la degradazione

**Fix**: Limit message loading
```javascript
const existingMessages = await prisma.message.findMany({
  where: { sessionId },
  orderBy: { createdAt: 'desc' },
  take: 50,  // Only last 50 for context
});
```

---

## 🎭 ILLUSION #8: ChatSession.messages Field

**File**: `backend/prisma/schema.prisma:144`

### Come Appare
✅ Schema has `messages Json` field
✅ Sessions created with `messages: "[]"`
✅ Field exists in database

### La Realtà
```prisma
model ChatSession {
  ...
  messages Json @default("[]")  // ← Initialized but NEVER read!
  ...
  messagesNew Message[]         // ← Actually used
}
```

**Verità**: Campo inizializzato ma mai utilizzato (dead code)

### Test Scenario
```javascript
// Create session
const session = await prisma.chatSession.create({
  data: {
    messages: JSON.stringify([]),  // ← Written!
  }
});

// Send message
await prisma.message.create({  // ← Goes to Message table
  data: { sessionId, content: 'Hello' }
});

// Get session messages
const session = await prisma.chatSession.findUnique({
  include: {
    messagesNew: true  // ← Reads from Message table
  }
});

// session.messages value?
"[]"  // ← Still empty! Never updated!

// But chat has messages?
session.messagesNew = [{content: 'Hello'}]  // ← From Message table

// Database State
ChatSession:
  id: 'abc'
  messages: '[]'          ← Empty (dead code)

Message table:
  sessionId: 'abc'
  content: 'Hello'        ← Actual data
```

### Perché È Un'Illusione
- ✅ Field exists in schema
- ✅ Gets initialized on creation
- ✅ Appears to be "the messages field"
- ❌ Never read anywhere
- ❌ Never updated
- ❌ Wastes disk space

**Scoperta**: Solo leggendo il codice si scopre che è dead code

**Fix**: Remove from schema completely

---

## 🎭 ILLUSION #9: Priority Validation

**File**: `backend/prisma/schema.prisma:167`

### Come Appare
✅ Chat has priority field
✅ Values are LOW, NORMAL, HIGH, URGENT
✅ Validation in controller

### La Realtà
```prisma
// Schema
priority String @default("NORMAL")  // ← String, not enum!

// Controller validation (chat.controller.js:1121)
const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
if (!validPriorities.includes(priority)) {
  return res.status(400).json({ error: ... });
}
```

**Verità**: Validation solo in application layer, non database

### Test Scenario
```javascript
// Via API (protected)
PUT /api/chat/sessions/123/priority
{ priority: "SUPER_HIGH" }

Response: ❌ 400 Bad Request
  "Invalid priority"

// Via direct database access (bypassing API)
UPDATE "ChatSession"
SET priority = 'SUPER_HIGH'
WHERE id = '123';

Result: ✅ Success! (no constraint)

// Via SQL injection (if vulnerability exists)
... OR 1=1; UPDATE "ChatSession" SET priority='HACKED' --

Result: ✅ Success! (no constraint)

// Data State After
Database contains:
  { id: '123', priority: 'NORMAL' }     ✅ Valid
  { id: '456', priority: 'HIGH' }       ✅ Valid
  { id: '789', priority: 'SUPER_HIGH' } ❌ Invalid
  { id: '999', priority: 'hacked' }     ❌ Invalid

// Frontend Behavior
Dashboard sort by priority:
  WHERE priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')

Sessions with invalid priorities → invisible! ❌
```

### Perché È Un'Illusione
- ✅ API validation works
- ✅ Normal users can't break it
- ❌ Database allows ANY string
- ❌ Data corruption possible
- ❌ Invalid data silently ignored in queries

**Scoperta**: Solo con data corruption o security test si nota

**Fix**: Use enum type
```prisma
enum ChatPriority { LOW NORMAL HIGH URGENT }
priority ChatPriority @default(NORMAL)
```

---

## 🎭 ILLUSION #10: Tag Queryability

**File**: `backend/prisma/schema.prisma:168`

### Come Appare
✅ Sessions have tags
✅ Can add/remove tags
✅ Tags displayed in UI

### La Realtà
```prisma
tags Json @default("[]")  // Array of strings in JSON
```

**Verità**: Tags stored as JSON array, not queryable

### Test Scenario
```javascript
// Add tag to session
await prisma.chatSession.update({
  where: { id: '123' },
  data: { tags: JSON.stringify(['urgent', 'billing']) }
});

// Query 1: "Find all sessions tagged 'urgent'"
// ❌ Can't do this efficiently!

// Attempt 1: JSON contains
await prisma.chatSession.findMany({
  where: {
    tags: { string_contains: 'urgent' }  // ⚠️ Also matches 'not-urgent'!
  }
});

// Attempt 2: Full scan
const sessions = await prisma.chatSession.findMany();
const urgent = sessions.filter(s => {
  const tags = JSON.parse(s.tags);
  return tags.includes('urgent');  // ❌ 100,000 sessions loaded to RAM!
});

// Query 2: "How many sessions per tag?"
// ❌ Impossible without loading everything

// Query 3: "Tag autocomplete"
// ❌ Must scan all sessions to get unique tags

// Performance
Sessions: 100,000
Query "urgent" tag: 30 seconds (full scan)
Same query with Tag table: 50ms (indexed)
```

### Perché È Un'Illusione
- ✅ Tagging works in UI
- ✅ Can add/remove tags
- ✅ Tags visible per session
- ❌ Can't query by tag efficiently
- ❌ Can't get tag statistics
- ❌ No autocomplete possible

**Scoperta**: Solo implementando dashboard analytics si scopre il limite

**Fix**: Normalize to Tag + ChatSessionTag tables

---

## 🎭 ILLUSION #11: Internal Notes Concurrency

**File**: `backend/src/controllers/chat.controller.js:1330-1380`

### Come Appare
✅ BUG #5 fixed with pessimistic locking
✅ Add note: Uses `addInternalNoteWithLock()`
✅ Update note: Uses `updateInternalNoteWithLock()`

### La Realtà
```javascript
// Add: ✅ Locked
const updated = await addInternalNoteWithLock(sessionId, newNote);

// Update: ✅ Locked
const updated = await updateInternalNoteWithLock(sessionId, noteId, content);

// Delete: ❌ NOT locked! (duplicate of ILLUSION #4 but different aspect)
const notes = JSON.parse(session.internalNotes || '[]');
notes.splice(noteIndex, 1);
const updated = await prisma.chatSession.update({
  data: { internalNotes: JSON.stringify(notes) }
});
```

**Verità**: Add/Update hanno fix, Delete no (inconsistenza)

### Test Scenario
```javascript
// Session notes: [A, B, C, D]

// Operator 1: Updates note B
Time 0ms: Start updateInternalNoteWithLock()
  - Acquire lock on session
  - Read: [A, B, C, D]
  - Update B → [A, B', C, D]
  - Commit + Release lock
Time 50ms: Done ✅

// Operator 2: Deletes note C (concurrent)
Time 20ms: Start deleteInternalNote()
  - No lock acquired!
  - Read: [A, B, C, D]  ← Reads BEFORE Operator 1 commits
  - Remove C → [A, B, D]
  - Wait for commit...
Time 60ms: Commit
  - Overwrites Operator 1's change!
  - Result: [A, B, D]  ← B' update LOST! ❌

// Illusion
Operator 1: "Note updated ✅"
Operator 2: "Note deleted ✅"
Reality: Update lost, inconsistent state
```

### Perché È Un'Illusione
- ✅ BUG #5 fix appears complete
- ✅ Add/Update work correctly
- ✅ Documentation says "fixed"
- ❌ Delete still has race condition
- ❌ Inconsistent locking strategy

**Scoperta**: Code review rivela delete mancante dal fix

**Fix**: Implement `deleteInternalNoteWithLock()`

---

## 🎭 ILLUSION #12: Notification Recipients

**File**: `backend/prisma/schema.prisma:371`

### Come Appare
✅ Notifications created
✅ recipientId populated
✅ Notifications delivered

### La Realtà
```prisma
model Notification {
  recipientId String?  // ← NO FOREIGN KEY!
  ...
}
```

**Verità**: recipientId è solo una stringa, no relazione

### Test Scenario
```javascript
// Create operator
const operator = await prisma.operator.create({
  data: { id: 'op-123', ... }
});

// Create notification
await prisma.notification.create({
  data: {
    recipientId: 'op-123',
    message: 'New chat assigned'
  }
});

// Notification sent: ✅ Works

// Later: Delete operator
await prisma.operator.delete({
  where: { id: 'op-123' }
});

// Notification still exists with recipientId = 'op-123'
const orphaned = await prisma.notification.findMany({
  where: { recipientId: 'op-123' }
});
// Returns: [{ recipientId: 'op-123', ... }]

// Try to get recipient details
const notif = orphaned[0];
const recipient = await prisma.operator.findUnique({
  where: { id: notif.recipientId }
});
// Returns: null ❌ Operator doesn't exist!

// Dashboard notification list
notifications.map(n => ({
  message: n.message,
  recipient: n.recipient?.name || 'Unknown'  // ← "Unknown" for deleted operators
}));
```

### Perché È Un'Illusione
- ✅ Creating notifications works
- ✅ Delivering to existing operators works
- ❌ Orphaned notifications after operator deletion
- ❌ No cascade delete
- ❌ Can't JOIN to get recipient details efficiently

**Scoperta**: Solo con operator deletion si notano notifiche orfane

**Fix**: Add foreign key with cascade
```prisma
recipient Operator? @relation(fields: [recipientId], references: [id], onDelete: Cascade)
```

---

## 📊 CONSOLIDATO: TUTTE LE ILLUSIONI

| # | Illusione | Categoria | Scoperta | Impatto |
|---|-----------|-----------|----------|---------|
| 1 | ticket_resumed events | WebSocket | Test real-time | 🔴 Feature broken |
| 2 | WhatsApp privacy leak | WebSocket | Multi-user test | 🔴 Security |
| 3 | Operator auth bypass | WebSocket | Security test | 🔴 Critical vuln |
| 4 | deleteNote race condition | Controller | Concurrency test | 🔴 Data loss |
| 5 | Search new messages | Controller | Search recent | 🔴 Feature broken |
| 6 | Close chat idempotency | Controller | Double-click | 🟡 Duplicate emails |
| 7 | Large session perf | Controller | Long-running | 🔴 Performance bomb |
| 8 | messages field dead code | Schema | Code review | 🟢 Waste |
| 9 | Priority validation | Schema | Data corruption | 🟡 Integrity risk |
| 10 | Tag queryability | Schema | Analytics impl | 🟡 Not queryable |
| 11 | Notes delete locking | Controller | Code review | 🔴 Inconsistent |
| 12 | Notification orphans | Schema | Operator deletion | 🟡 Orphaned data |

---

## 🎯 PATTERN RICORRENTI

### Pattern 1: "Funziona Finché Non..."
- Search funziona... finché non cerchi chat recenti
- Performance è ok... finché sessione non cresce
- Notifiche funzionano... finché operatore non viene eliminato

**Root Cause**: Testing insufficiente su edge cases e long-term behavior

---

### Pattern 2: "Validazione in Posto Sbagliato"
- Priority validato in controller, non database
- Auth validato su HTTP, non WebSocket
- Rating range validato in JS, non DB constraint

**Root Cause**: Validation at application layer only (defense in depth mancante)

---

### Pattern 3: "Fix Parziale"
- BUG #5 fix: Add/Update locked, Delete no
- BUG #6 migration: Message table created, old field non rimosso
- WebSocket rooms: Alcuni corretti, altri con typo

**Root Cause**: Incomplete refactoring - old code left behind

---

### Pattern 4: "Successo Silenzioso"
- WebSocket emit() non fallisce mai (anche se room non esiste)
- Race conditions non generano errori
- Dead code eseguito senza impatto

**Root Cause**: Lack of validation/assertion dopo operazioni

---

## 🧪 COME TESTARE LE ILLUSIONI

### Test Suite Consigliata

```javascript
// Test 1: WebSocket Room Existence
describe('WebSocket Events', () => {
  it('should fail if room does not exist', async () => {
    const roomsBefore = io.sockets.adapter.rooms;
    io.to('nonexistent_room').emit('test_event', {});

    // Assertion: Event should be logged as "no recipients"
    expect(logger.warnings).toContain('Event sent to empty room');
  });
});

// Test 2: Concurrency
describe('Internal Notes', () => {
  it('should handle concurrent deletes', async () => {
    const promises = [
      deleteNote(sessionId, 'note1'),
      deleteNote(sessionId, 'note2'),
    ];
    await Promise.all(promises);

    const session = await getSession(sessionId);
    const notes = JSON.parse(session.internalNotes);

    // Both deletes should succeed
    expect(notes).not.toContainObject({ id: 'note1' });
    expect(notes).not.toContainObject({ id: 'note2' });
  });
});

// Test 3: Performance Degradation
describe('Large Sessions', () => {
  it('should maintain performance with 10k messages', async () => {
    // Create session with 10,000 messages
    await seedMessages(sessionId, 10000);

    const start = Date.now();
    await sendUserMessage(sessionId, 'Hello');
    const duration = Date.now() - start;

    // Should complete in < 500ms
    expect(duration).toBeLessThan(500);
  });
});

// Test 4: Data Integrity
describe('Priority Validation', () => {
  it('should reject invalid priorities at DB level', async () => {
    await expect(
      prisma.$executeRaw`UPDATE "ChatSession" SET priority = 'INVALID'`
    ).rejects.toThrow('check constraint');
  });
});
```

---

## 📝 RACCOMANDAZIONI

### Priorità P0 (Immediate)
1. Fix WebSocket room typos (ticket_resumed)
2. Add auth to WebSocket operator_join
3. Fix search to use Message table
4. Add transaction lock to deleteInternalNote
5. Add limit to message loading

### Priorità P1 (Important)
6. Fix WhatsApp global broadcasts (use rooms)
7. Add idempotency check to closeSession
8. Add foreign key to Notification.recipientId
9. Convert priority to enum
10. Remove dead messages JSON field

### Priorità P2 (Nice to have)
11. Normalize tags to separate table
12. Normalize internalNotes to separate table
13. Add check constraints (rating, etc.)
14. Improve error logging for silent failures

---

## 🎓 LEZIONI APPRESE

### Lesson 1: "Non Assume, Verifica"
- WebSocket emit() non fallisce se room vuota → verificare logs
- Race conditions non generano errori → verificare con concurrency tests
- Search sembra funzionare → verificare su tutti i casi

### Lesson 2: "Defense in Depth"
- Validation at multiple layers (controller + database)
- Authentication at all entry points (HTTP + WebSocket)
- Idempotency for all state-changing operations

### Lesson 3: "Complete Your Refactoring"
- BUG #6 migration → rimuovi codice vecchio
- BUG #5 fix → applica a TUTTE le operazioni (add/update/delete)
- Room naming convention → fix TUTTE le occorrenze

### Lesson 4: "Test Edge Cases"
- Large data sets (10k+ messages)
- Concurrent operations (2+ operators)
- Long-running sessions (weeks/months)
- Deleted references (orphaned IDs)

---

**Report Compilato**: 30 Ottobre 2025, 03:30
**Illusioni Trovate**: 12
**Pattern Identificati**: 4
**Test Raccomandati**: 15+

**Conclusione**: Il sistema funziona correttamente per use cases comuni e test superficiali, ma nasconde 12 illusioni di funzionamento che si manifestano solo in edge cases, test di concorrenza, o situazioni di stress. La maggior parte può essere scoperta solo con test approfonditi o code review sistematico.
