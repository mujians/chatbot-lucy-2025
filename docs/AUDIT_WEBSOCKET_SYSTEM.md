# Audit WebSocket System - Lucine Chatbot

**Data Audit**: 30 Ottobre 2025
**File Analizzati**:
- `backend/src/services/websocket.service.js`
- `backend/src/controllers/chat.controller.js`
- `backend/src/controllers/ticket.controller.js`
- `backend/src/controllers/operator.controller.js`
- `backend/src/controllers/whatsapp.controller.js`

---

## 📊 MAPPA COMPLETA EVENTI WEBSOCKET

### Events FROM Backend TO Client

#### Room: `dashboard`
| Event Name | Controller | Line | Data | Purpose |
|------------|-----------|------|------|---------|
| `new_chat_created` | chat | 237 | {sessionId, userName} | Nuova chat creata |
| `chat_assigned` | chat | 514 | {sessionId, operatorId, operatorName} | Chat assegnata ad operatore |
| `chat_deleted` | chat | 822 | {sessionId} | Chat eliminata |
| `chat_archived` | chat | 855 | {sessionId} | Chat archiviata |
| `chat_unarchived` | chat | 888 | {sessionId} | Chat de-archiviata |
| `chat_flagged` | chat | 923 | {sessionId, reason} | Chat segnalata |
| `chat_unflagged` | chat | 957 | {sessionId} | Chat de-segnalata |
| `chat_transferred` | chat | 1053 | {sessionId, fromOperator, toOperator} | Chat trasferita |
| `new_ticket_created` | ticket | 133 | {ticketId, ...} | Nuovo ticket creato |
| `ticket_assigned` | ticket | 271 | {ticketId, operatorId} | Ticket assegnato |
| `ticket_resolved` | ticket | 318 | {ticketId} | Ticket risolto |
| `chat_converted_to_ticket` | ticket | 495 | {sessionId, ticketId} | Chat convertita a ticket |
| `operator_availability_changed` | operator | 30 | {operatorId, available} | Operatore cambia disponibilità |

#### Room: `operator_{operatorId}`
| Event Name | Controller | Line | Data | Purpose |
|------------|-----------|------|------|---------|
| `user_message` | chat | 349 | {sessionId, userName, message, unreadCount} | Messaggio da utente |
| `new_chat_request` | chat | 507 | {sessionId, userName, ...} | Nuova richiesta chat |
| `chat_transferred_from_you` | chat | 1040 | {sessionId, toOperator, reason} | Chat trasferita DA te |
| `chat_transferred_to_you` | chat | 1046 | {sessionId, fromOperator, reason} | Chat trasferita A te |

#### Room: `chat_{sessionId}`
| Event Name | Controller | Line | Data | Purpose |
|------------|-----------|------|------|---------|
| `user_message` | chat | 357 | {sessionId, userName, message} | Messaggio utente (P0-1 fix) |
| `operator_assigned` | chat | 520 | {sessionId, operatorName, operatorId} | Operatore assegnato |
| `operator_message` | chat | 594 | {sessionId, message} | Messaggio operatore |
| `chat_closed` | chat | 673 | {sessionId, message} | Chat chiusa |
| `new_message` | chat | 679 | (closingMessage) | Messaggio chiusura |
| `user_typing` | websocket | 53 | {sessionId, isTyping} | User sta scrivendo |
| `operator_typing` | websocket | 64 | {sessionId, operatorName, isTyping} | Operatore sta scrivendo |
| Upload file event | chat | 1566 | {sessionId, message} | File caricato |

#### Global Broadcast (no room)
| Event Name | Controller | Line | Data | Purpose |
|------------|-----------|------|------|---------|
| `whatsapp_message` | whatsapp | 72 | {...} | Messaggio WhatsApp ricevuto |
| `new_chat` | whatsapp | 88 | {...} | Nuova chat da WhatsApp |
| `operator_message` | whatsapp | 226 | {...} | Risposta operatore via WhatsApp |

### Events FROM Client TO Backend

| Event Name | Handler Location | Data Expected | Purpose |
|------------|-----------------|---------------|---------|
| `operator_join` | websocket.service.js:11 | {operatorId} | Operatore entra in room personale |
| `operator_leave` | websocket.service.js:17 | {operatorId} | Operatore esce da room personale |
| `join_dashboard` | websocket.service.js:24 | (none) | Client dashboard si connette |
| `leave_dashboard` | websocket.service.js:30 | (none) | Client dashboard si disconnette |
| `join_chat` | websocket.service.js:35 | {sessionId} | Join chat room specifica |
| `leave_chat` | websocket.service.js:42 | {sessionId} | Leave chat room specifica |
| `user_typing` | websocket.service.js:49 | {sessionId, isTyping} | User sta scrivendo |
| `operator_typing` | websocket.service.js:60 | {sessionId, operatorName, isTyping} | Operatore sta scrivendo |

---

## 🚨 CRITICAL FINDINGS

### 🔴 CRITICAL #1: Room Name Inconsistency (ticket.controller.js)

**File**: `backend/src/controllers/ticket.controller.js`
**Line**: 383

```javascript
io.to(`operator:${ticket.operatorId}`).emit('ticket_resumed', {
  //    ^^^^^^^^^ WRONG! Uses COLON instead of UNDERSCORE
```

**Problem**:
- WebSocket service joins: `operator_{operatorId}` (UNDERSCORE)
- Ticket controller emits to: `operator:{operatorId}` (COLON)
- **Result**: Event `ticket_resumed` is NEVER received by operators!

**Impact**:
- 🔴 Operators don't get notified when tickets are resumed
- Feature appears broken but silently fails

**Fix Required**:
```javascript
io.to(`operator_${ticket.operatorId}`).emit('ticket_resumed', {
  //    ^^^^^^^^^
```

---

### 🟡 MEDIUM #2: Global Broadcasts in whatsapp.controller.js

**File**: `backend/src/controllers/whatsapp.controller.js`
**Lines**: 72, 88, 226

```javascript
io.emit('whatsapp_message', {...})  // ← NO ROOM! Broadcast to ALL
io.emit('new_chat', {...})          // ← NO ROOM! Broadcast to ALL
io.emit('operator_message', {...})  // ← NO ROOM! Broadcast to ALL
```

**Problem**:
- Eventi broadcastati a TUTTI i client connessi
- Widget utenti ricevono messaggi di altri utenti!
- Dashboard riceve TUTTI i messaggi WhatsApp (anche di altre chat)

**Security Risk**: 🔴 HIGH
- Privacy leak: User A vede messaggi di User B
- Performance: Tutti ricevono tutti i messaggi

**Fix Required**: Usare room specifici
```javascript
io.to(`chat_${sessionId}`).emit('whatsapp_message', {...})
io.to('dashboard').emit('new_chat', {...})
io.to(`operator_${operatorId}`).emit('operator_message', {...})
```

---

### 🟡 MEDIUM #3: No Authentication on operator_join

**File**: `backend/src/services/websocket.service.js`
**Line**: 11-14

```javascript
socket.on('operator_join', (data) => {
  const { operatorId } = data;
  socket.join(`operator_${operatorId}`);  // ← NO VERIFICATION!
  console.log(`👤 Operator ${operatorId} joined room`);
});
```

**Problem**:
- Qualsiasi client può fare `socket.emit('operator_join', {operatorId: 'any-id'})`
- Nessuna verifica JWT token
- Client malevolo può joinare room di altri operatori

**Security Risk**: 🔴 CRITICAL
- Attacker può ricevere chat di altri operatori
- Attacker può impersonare operatori

**Fix Required**: Verificare JWT prima di join
```javascript
socket.on('operator_join', async (data) => {
  const { operatorId, token } = data;

  // Verify JWT token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.operatorId !== operatorId) {
      return socket.emit('error', {message: 'Unauthorized'});
    }
    socket.join(`operator_${operatorId}`);
  } catch (err) {
    socket.emit('error', {message: 'Invalid token'});
  }
});
```

---

### 🟢 LOW #4: No Connection Tracking

**Problem**:
- WebSocket service non tiene traccia di:
  - Quali operatori sono online
  - Quanti client sono in dashboard
  - Mapping socket.id → operatorId

**Impact**:
- Impossibile sapere "quanti operatori sono online" senza DB query
- Impossibile disconnettere specifico operatore
- Debug difficile

**Enhancement Suggestion**:
```javascript
const connectedOperators = new Map(); // operatorId → Set<socket.id>
const dashboardClients = new Set();   // socket.id

socket.on('operator_join', (data) => {
  const {operatorId} = data;
  if (!connectedOperators.has(operatorId)) {
    connectedOperators.set(operatorId, new Set());
  }
  connectedOperators.get(operatorId).add(socket.id);
});
```

---

### 🟢 LOW #5: No Error Handling

**Problem**:
- Nessun try/catch nei WebSocket handlers
- Se un evento causa exception, socket disconnects
- No error events emessi al client

**Example Risk**:
```javascript
socket.on('join_chat', (data) => {
  const { sessionId } = data;
  socket.join(`chat_${sessionId}`);  // ← Se sessionId è undefined?
});
```

**Enhancement**:
```javascript
socket.on('join_chat', (data) => {
  try {
    const { sessionId } = data;
    if (!sessionId) {
      return socket.emit('error', {message: 'sessionId required'});
    }
    socket.join(`chat_${sessionId}`);
  } catch (err) {
    console.error('join_chat error:', err);
    socket.emit('error', {message: 'Failed to join chat'});
  }
});
```

---

### 🟢 LOW #6: No Heartbeat/Ping-Pong

**Problem**:
- Nessun heartbeat mechanism
- Client disconnesso può rimanere in room per minuti
- Load balancer potrebbe killare connection idle

**Enhancement**: Socket.io ha built-in ping-pong, ma va configurato
```javascript
// In server.js where io is created
const io = new Server(httpServer, {
  pingTimeout: 60000,
  pingInterval: 25000,
});
```

---

## 🔍 EVENT COVERAGE ANALYSIS

### Dashboard Events (Frontend)

**File da verificare**: `src/pages/Index.tsx`, `src/contexts/SocketContext.tsx`

Events dashboard SHOULD listen to:
- ✅ `new_chat_request` - Ascoltato in Index.tsx:52
- ✅ `user_message` - Ascoltato in Index.tsx:67
- ✅ `chat_closed` - Ascoltato in Index.tsx:88
- ✅ `chat_assigned` - Ascoltato in Index.tsx:96
- ⚠️ `new_chat_created` - Backend emette (chat.controller:237) - Dashboard ascolta?
- ⚠️ `chat_deleted` - Backend emette - Dashboard ascolta?
- ⚠️ `chat_archived` - Backend emette - Dashboard ascolta?
- ⚠️ `chat_transferred` - Backend emette - Dashboard ascolta?
- ⚠️ `ticket_resumed` - Backend emette (ma con room sbagliato!) - Dashboard ascolta?
- ⚠️ `operator_availability_changed` - Backend emette - Dashboard ascolta?

**Finding**: Molti eventi emessi dal backend ma **mai ascoltati** dal frontend!

---

### Widget Events

**File da verificare**: `lucine-minimal/snippets/chatbot-popup.liquid`

Events widget SHOULD listen to:
- ✅ `operator_assigned` - Ascoltato (line ~1998)
- ✅ `operator_message` - Ascoltato (line ~1998)
- ✅ `chat_closed` - Ascoltato (line ~2020)
- ✅ `operator_typing` - Ascoltato (line ~2013)
- ⚠️ `new_message` - Backend emette (chat.controller:679) - Widget ascolta?

---

## 📊 ROOM USAGE STATISTICS

### Rooms Utilizzati
1. `dashboard` - Room globale dashboard
2. `operator_{operatorId}` - Room per ogni operatore
3. `chat_{sessionId}` - Room per ogni sessione chat
4. ~~`operator:{operatorId}`~~ - ❌ TYPO in ticket.controller.js

### Room Naming Convention
- ✅ **Correct**: `chat_${sessionId}`, `operator_${operatorId}`
- ❌ **Incorrect**: `operator:${operatorId}` (ticket.controller.js:383)

---

## 🎯 RECOMMENDATIONS

### Priority P0 (Fix Immediately)
1. **Fix ticket.controller.js:383** - Change `operator:` to `operator_`
2. **Fix whatsapp.controller.js global broadcasts** - Use specific rooms
3. **Add authentication to operator_join** - Verify JWT token

### Priority P1 (Important)
4. **Add error handling** to all WebSocket handlers
5. **Map missing event listeners** in dashboard
6. **Add connection tracking** for online operators

### Priority P2 (Nice to Have)
7. **Add heartbeat configuration**
8. **Add WebSocket middleware** for logging/metrics
9. **Add event validation** (schema check)

---

## 🧪 TESTING SCENARIOS

### Test #1: ticket_resumed Event
**Steps**:
1. Create ticket
2. Suspend ticket
3. Resume ticket
4. **Expected**: Operator receives `ticket_resumed` event
5. **Actual**: Event sent to wrong room (`operator:` instead of `operator_`)
6. **Result**: ❌ FAIL - Event never received

### Test #2: WhatsApp Privacy Leak
**Steps**:
1. Open widget as User A
2. Send WhatsApp message
3. Open second widget as User B
4. **Expected**: User B should NOT see User A's message
5. **Actual**: Global broadcast - User B receives event
6. **Result**: ❌ FAIL - Privacy leak

### Test #3: Operator Impersonation
**Steps**:
1. Open browser console
2. Connect to WebSocket
3. Emit `operator_join` with random operatorId
4. **Expected**: Should be rejected (no auth)
5. **Actual**: Joins room successfully
6. **Result**: ❌ FAIL - Security breach

---

## 📝 ACTION ITEMS

- [ ] Fix ticket.controller.js room name (5 min)
- [ ] Fix whatsapp.controller.js broadcasts (30 min)
- [ ] Add auth to operator_join (1 hour)
- [ ] Add error handling to all handlers (2 hours)
- [ ] Map all dashboard event listeners (1 hour)
- [ ] Add connection tracking (2 hours)
- [ ] Write integration tests (4 hours)

---

**Total Issues Found**: 6 (1 critical, 2 medium, 3 low)
**Total Events Mapped**: 30+ events
**Security Issues**: 2 critical (auth, privacy leak)

**Audit Completato**: 30 Ottobre 2025, 00:25
**Next**: Audit Chat Controller (1476 righe)
