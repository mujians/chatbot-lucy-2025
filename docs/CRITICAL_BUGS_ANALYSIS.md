# Analisi Critica Bug Sistema Lucine Chatbot

**Data Analisi**: 29 Ottobre 2025
**Metodologia**: Lettura completa codice sorgente (4781 righe totali)
**Codice Analizzato**:
- `chat.controller.js` (1476 righe) - Backend controller principale
- `ChatWindow.jsx` (1290 righe) - Dashboard operatore
- `chatbot-popup.liquid` (2015 righe) - Widget Shopify

---

## 🔴 CRITICAL BUGS - SISTEMA PARZIALMENTE ROTTO

### ✅ BUG #1: Eventi Socket.IO NON Ricevuti dal Widget [RISOLTO - 29/10/2025]

**Status**: ✅ FIXED (commit 53cf1ab)
**File**: `backend/src/controllers/chat.controller.js`
**Linee**: 476-482
**Severity**: 🔴 CRITICAL - **La chiusura chat non funziona per l'utente**

**Codice Problematico**:
```javascript
// Line 476-482 in closeSession()
io.to(`chat:${sessionId}`).emit('chat_closed', {    // ❌ WRONG!
  sessionId: sessionId,
  message: closingMessage,
});

io.to(`chat:${sessionId}`).emit('new_message', closingMessage); // ❌ WRONG!
```

**Problema**:
- Backend usa `chat:${sessionId}` (con COLON)
- Ma il widget si collega a room `chat_${sessionId}` (con UNDERSCORE)
- **Risultato**: Eventi `chat_closed` e `new_message` MAI ricevuti dal widget

**Verifica**:
```javascript
// Widget - Line ~952 (chatbot-popup.liquid)
// Widget joins room:
socket.emit('join_chat', { sessionId: chat.id });

// Backend websocket.service.js joins:
socket.join(`chat_${sessionId}`);  // ✅ UNDERSCORE

// Ma closeSession emette a:
io.to(`chat:${sessionId}`).emit(...);  // ❌ COLON - DIVERSO!
```

**Impact in Produzione**:
1. Operatore chiude chat → pulsante "Chiudi Chat" nella dashboard
2. Backend chiama `closeSession()` → salva status CLOSED in DB
3. Backend emette `chat_closed` a room `chat:${id}` ← SBAGLIATA
4. Widget NON riceve evento (è in room `chat_${id}`)
5. Widget rimane in stato "Chat Attiva" anche se chiusa
6. Utente può continuare a scrivere → messaggi persi
7. Input field non viene disabilitato (P1.7 implementato ma evento mai ricevuto!)

**Fix**:
```javascript
// Lines 476-482: CHANGE COLON to UNDERSCORE
io.to(`chat_${sessionId}`).emit('chat_closed', {  // ✅ FIX
  sessionId: sessionId,
  message: closingMessage,
});

io.to(`chat_${sessionId}`).emit('new_message', closingMessage);  // ✅ FIX
```

**Effort**: 30 secondi
**Priority**: 🔴 P0 - IMMEDIATE FIX REQUIRED

---

### ✅ BUG #2: Transfer Chat - Eventi Mai Ricevuti [RISOLTO - 29/10/2025]

**Status**: ✅ FIXED (commit 53cf1ab)
**File**: `backend/src/controllers/chat.controller.js`
**Linee**: 805, 811
**Severity**: 🔴 CRITICAL - **Trasferimento chat non notifica operatori**

**Codice Problematico**:
```javascript
// Lines 805-815 in transferSession()
io.to(`operator:${session.operatorId}`).emit('chat_transferred_from_you', {  // ❌ COLON
  sessionId,
  toOperator: targetOperator,
  reason,
});

io.to(`operator:${toOperatorId}`).emit('chat_transferred_to_you', {  // ❌ COLON
  sessionId,
  fromOperator: session.operator,
  reason,
});
```

**Problema**:
- Backend emette a `operator:${id}` (COLON)
- Dashboard si collega a `operator_${id}` (UNDERSCORE)
- **Risultato**: Operatori NON ricevono notifica di trasferimento

**Verifica in ChatWindow.jsx**:
```javascript
// Line 100 (ChatWindow.jsx)
newSocket.emit('operator_join', { operatorId: operatorId });

// Backend websocket.service.js:
socket.join(`operator_${operatorId}`);  // ✅ UNDERSCORE

// Ma transferSession emette a:
io.to(`operator:${session.operatorId}`).emit(...);  // ❌ COLON
```

**Impact**:
1. Operatore A trasferisce chat a Operatore B
2. Backend aggiorna DB correttamente
3. Backend emette eventi a room `operator:A` e `operator:B` ← SBAGLIATE
4. Operatori non ricevono eventi (sono in room `operator_A`, `operator_B`)
5. Operatore B non sa di avere nuova chat
6. Operatore A vede ancora la chat come propria
7. **Confusion totale tra operatori**

**Fix**:
```javascript
// Lines 805, 811: CHANGE COLON to UNDERSCORE
io.to(`operator_${session.operatorId}`).emit('chat_transferred_from_you', {  // ✅ FIX
  sessionId,
  toOperator: targetOperator,
  reason,
});

io.to(`operator_${toOperatorId}`).emit('chat_transferred_to_you', {  // ✅ FIX
  sessionId,
  fromOperator: session.operator,
  reason,
});
```

**Effort**: 20 secondi
**Priority**: 🔴 P0

---

### ✅ BUG #3: Frontend Filtra Operatori con Campo Deprecato [RISOLTO - 29/10/2025]

**Status**: ✅ FIXED (commit 884f13f)
**File**: `frontend-dashboard/src/components/ChatWindow.jsx`
**Linee**: 210-211
**Severity**: 🟠 HIGH - **Transfer chat mostra "Nessun operatore disponibile" sempre**

**Codice Problematico**:
```javascript
// Line 210-211 (handleOpenTransferModal)
const available = response.data.data?.operators?.filter(
  (op) => op.id !== currentOperatorId && op.isOnline && op.isAvailable  // ❌ isOnline DEPRECATO
) || [];
```

**Problema**:
1. `isOnline` field è stato rimosso/deprecato (secondo ROADMAP P0)
2. Background job auto-offline è disabilitato (`background-jobs.service.js:2`)
3. **Campo `isOnline` è sempre `false` o `null`**
4. Filtro `op.isOnline && op.isAvailable` → SEMPRE false
5. Array `available` sempre vuoto
6. Modal mostra "Nessun operatore disponibile"

**Verifica in Backend**:
```javascript
// chat.controller.js Line 253-259 (requestOperator)
const availableOperators = await prisma.operator.findMany({
  where: {
    isAvailable: true,   // ✅ SOLO isAvailable - isOnline NON usato
  },
  orderBy: { totalChatsHandled: 'asc' },
});
```

Backend usa SOLO `isAvailable`, ma frontend filtra ANCHE con `isOnline`!

**Impact**:
- Transfer chat funzionalità COMPLETAMENTE ROTTA
- Modal sempre mostra "Nessun operatore disponibile"
- Impossibile trasferire chat anche se ci sono operatori disponibili

**Fix**:
```javascript
// Line 210-211: REMOVE isOnline check
const available = response.data.data?.operators?.filter(
  (op) => op.id !== currentOperatorId && op.isAvailable  // ✅ FIX: remove && op.isOnline
) || [];
```

**Effort**: 10 secondi
**Priority**: 🟠 P1

**NOTA**: Backend ha stesso problema in `transferSession()` line 774:
```javascript
// Line 774 - STESSO BUG nel backend
if (!targetOperator.isOnline || !targetOperator.isAvailable) {  // ❌ isOnline check
```
Rimuovere anche lì.

---

### ✅ BUG #4: Dashboard Non Ascolta Evento `chat_closed` [RISOLTO - 29/10/2025]

**Status**: ✅ FIXED (commit 493c722)
**File**: `frontend-dashboard/src/components/ChatWindow.jsx`
**Linee**: 104-130
**Severity**: 🟡 MEDIUM - **Dashboard non si aggiorna quando chat chiusa**

**Codice Esistente**:
```javascript
// Lines 104-130
newSocket.on('user_message', (data) => { /* ... */ });
newSocket.on('operator_message', (data) => { /* ... */ });
newSocket.on('user_typing', (data) => { /* ... */ });

// ❌ MANCA: listener per 'chat_closed'
```

**Problema**:
- Backend emette `chat_closed` quando operatore chiude chat
- Dashboard NON ascolta questo evento
- **ChatWindow rimane aperto** anche se chat chiusa
- Operatore può continuare a inviare messaggi (API fallisce ma UI non si aggiorna)

**Fix**:
```javascript
// Add after line 130
newSocket.on('chat_closed', (data) => {
  console.log('📨 Chat closed:', data);
  if (data.sessionId === chat.id) {
    // Update local state
    setMessages((prev) => [...prev, data.message]);
    // Notify operator and close window
    alert('La chat è stata chiusa');
    onClose?.();
  }
});
```

**Effort**: 5 minuti
**Priority**: 🟡 P2

---

## 🟠 HIGH PRIORITY - Race Conditions & Data Loss

### ⏳ BUG #5: Race Condition in Message Updates ⚠️ DATA LOSS [POSTPONED]

**Status**: ⏳ TODO - Fix complesso, richiede refactoring 7 funzioni
**File**: `backend/src/controllers/chat.controller.js`
**Linee**: 152-173, 207-216, 287-297, 370-391, 433-450, 781-796, 1000-1014, 1057-1078
**Severity**: 🟠 HIGH - **Messaggi persi con operazioni simultanee**

**Problema Architetturale**:
```javascript
// TUTTE queste funzioni fanno lo stesso pattern NON SAFE:

// Step 1: Read from DB
const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });

// Step 2: Parse JSON
const messages = JSON.parse(session.messages || '[]');  // ❌ RACE CONDITION

// Step 3: Modify in memory
messages.push(newMessage);

// Step 4: Write back to DB
await prisma.chatSession.update({
  where: { id: sessionId },
  data: { messages: JSON.stringify(messages) }  // ❌ SOVRASCRIVE
});
```

**Scenario di Perdita Dati (Riproducibile)**:

```
T0: Session.messages = [msg1, msg2, msg3]

T1: User invia messaggio "Ciao"
    → sendUserMessage() READ: [msg1, msg2, msg3]

T2: Operator invia messaggio "Salve"
    → sendOperatorMessage() READ: [msg1, msg2, msg3]  ← STESSI dati!

T3: User modifica: [..., msg4_user]
    → sendUserMessage() WRITE: [msg1, msg2, msg3, msg4_user]

T4: Operator modifica: [..., msg4_operator]
    → sendOperatorMessage() WRITE: [msg1, msg2, msg3, msg4_operator]  ← SOVRASCRIVE!

RESULT: msg4_user è PERSO!
```

**Frequenza**: Alta su chat attive con user e operator che scrivono simultaneamente

**Impact**:
- Messaggi persi senza trace
- Conversazioni incomplete
- User frustrati ("Ho scritto ma non vedo il messaggio")

**Funzioni Affette**:
1. `sendUserMessage()` (lines 152-216)
2. `sendOperatorMessage()` (lines 370-391)
3. `requestOperator()` (lines 287-297) - aggiunge system message
4. `closeSession()` (lines 433-450) - aggiunge closing message
5. `transferSession()` (lines 781-796) - aggiunge transfer message
6. `addInternalNote()` (lines 1000-1014)
7. `updateInternalNote()` (lines 1057-1078)

**Fix Raccomandato**:
Usare Prisma transactions con row-level locking:

```javascript
// SOLUZIONE 1: Pessimistic locking (PostgreSQL)
await prisma.$transaction(async (tx) => {
  // Lock row
  const session = await tx.$queryRaw`
    SELECT * FROM "ChatSession"
    WHERE id = ${sessionId}
    FOR UPDATE
  `;

  const messages = JSON.parse(session.messages || '[]');
  messages.push(newMessage);

  await tx.chatSession.update({
    where: { id: sessionId },
    data: { messages: JSON.stringify(messages) }
  });
});

// SOLUZIONE 2: Optimistic locking
const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
const currentVersion = session.version; // Add version field to schema

const updated = await prisma.chatSession.updateMany({
  where: {
    id: sessionId,
    version: currentVersion  // Only update if version matches
  },
  data: {
    messages: JSON.stringify(messages),
    version: { increment: 1 }
  }
});

if (updated.count === 0) {
  // Version mismatch - retry
  throw new Error('Concurrent modification detected');
}

// SOLUZIONE 3: (BEST) Separate Messages table - vedi Bug #6
```

**Effort**: 2 giorni (refactor tutti i controller)
**Priority**: 🟠 P1

---

### BUG #6: Messages Storage Non Scalabile (Già Documentato)

**Problema**: Già documentato in AUDIT_BACKEND_REPORT.md sezione C1
**Impact**: Performance + Race Conditions
**Raccomandazione**: Migrare a tabella `Message` separata

---

## 🟡 MEDIUM PRIORITY - Logic Bugs

### BUG #7: Widget Auto-Refresh Settings - Memory Leak

**File**: `/Users/brnobtt/Desktop/lucine-minimal/snippets/chatbot-popup.liquid`
**Linee**: 842-847
**Severity**: 🟡 MEDIUM - **Memory leak su widget persistente**

**Codice Problematico**:
```javascript
// Lines 842-847
function startSettingsAutoRefresh() {
  setInterval(() => {
    console.log('🔄 Auto-refreshing widget settings...');
    loadWidgetSettings(true);
  }, 5 * 60 * 1000); // 5 minutes
}

// Line 898
startSettingsAutoRefresh();  // ❌ MAI cleanup!
```

**Problema**:
- `setInterval` viene chiamato senza salvare reference
- **Impossibile cancellare** interval
- Se utente naviga tra pagine Shopify → interval continua
- Ogni page load crea NUOVO interval
- Dopo 1 ora navigazione: 12+ intervals attivi simultaneamente
- **Memory leak + API spam**

**Verifica**:
```javascript
// User journey:
// Page 1: initializeChatbot() → setInterval #1
// Navigate to Page 2: → DOM cleared but interval #1 ALIVE
// Page 2: initializeChatbot() → setInterval #2
// Navigate to Page 3: → intervals #1, #2 ALIVE
// Page 3: initializeChatbot() → setInterval #3
// ...
// Dopo 10 pagine: 10 intervals chiamano API ogni 5 min = 10 req/5min
```

**Impact**:
- Memory leak crescente
- API backend sovraccarica
- Performance degradation browser
- Battery drain mobile

**Fix**:
```javascript
// Store interval ID globally
let settingsRefreshInterval = null;

function startSettingsAutoRefresh() {
  // Clear existing interval if any
  if (settingsRefreshInterval) {
    clearInterval(settingsRefreshInterval);
  }

  settingsRefreshInterval = setInterval(() => {
    console.log('🔄 Auto-refreshing widget settings...');
    loadWidgetSettings(true);
  }, 5 * 60 * 1000);
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (settingsRefreshInterval) {
    clearInterval(settingsRefreshInterval);
  }
});
```

**Effort**: 10 minuti
**Priority**: 🟡 P2

---

### ✅ BUG #8: ChatWindow - Memory Leak con setTimeout [RISOLTO - 29/10/2025]

**Status**: ✅ FIXED (commit 8345ade)
**File**: `frontend-dashboard/src/components/ChatWindow.jsx`
**Linee**: 126
**Severity**: 🟡 MEDIUM - **setTimeout senza cleanup**

**Codice Problematico**:
```javascript
// Lines 121-128
newSocket.on('user_typing', (data) => {
  if (data.sessionId === chat.id) {
    setUserIsTyping(data.isTyping);
    if (data.isTyping) {
      setTimeout(() => setUserIsTyping(false), 3000);  // ❌ No cleanup
    }
  }
});
```

**Problema**:
- `setTimeout` creato senza salvare reference
- Se componente unmount PRIMA di 3 secondi → timeout esegue su unmounted component
- React warning: "Can't perform state update on unmounted component"
- Memory leak (piccolo ma ripetuto)

**Scenario**:
```
T0: User typing event → setUserIsTyping(true)
T0: setTimeout(() => setUserIsTyping(false), 3000) creato

T1 (after 1 second): Operatore chiude ChatWindow
T1: Component unmount
T1: setTimeout reference PERSA (non cancellato)

T3 (after 3 seconds): setTimeout esegue
T3: setUserIsTyping(false) chiamato su component UNMOUNTED
T3: React warning + memory leak
```

**Fix**:
```javascript
// Add ref for timeout
const typingTimeoutRef = useRef(null);  // ✅ Already exists! Line 42

// Fix listener
newSocket.on('user_typing', (data) => {
  if (data.sessionId === chat.id) {
    setUserIsTyping(data.isTyping);
    if (data.isTyping) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Set new timeout
      typingTimeoutRef.current = setTimeout(() => {
        setUserIsTyping(false);
      }, 3000);
    }
  }
});

// Add cleanup in useEffect
return () => {
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }
  // ... existing cleanup
};
```

**Effort**: 5 minuti
**Priority**: 🟡 P2

---

### BUG #9: Widget - Doppia Gestione Messaggi (Inconsistenza)

**File**: Widget + Backend
**Linee**: Widget 1423-1470, Backend 156-167
**Severity**: 🟡 MEDIUM - **Messaggi duplicati o mancanti**

**Problema Logico**:
```javascript
// WIDGET - sendMessage() line 1423
const response = await fetch(`${BACKEND_URL}/api/chat/session/${sessionId}/message`, {
  method: 'POST',
  body: JSON.stringify({ message: message })
});

// Se risposta OK:
if (data.data?.aiResponse) {
  addMessage(data.data.aiResponse.content, 'bot');  // ✅ Aggiunge AI response
}

// BACKEND - sendUserMessage() lines 156-167
await prisma.chatSession.update({
  data: {
    messages: JSON.stringify(messages),  // ✅ Salva user message in DB
  }
});

// Ma il widget NON aggiunge user message qui!
// Lo aggiunge PRIMA della fetch (line 1333):
addMessage(message, 'user');  // ✅ Aggiunge user message localmente
```

**Flow Attuale**:
```
1. Widget addMessage(userMsg, 'user')  ← Local display
2. Widget POST /api/chat/.../message
3. Backend salva userMsg in DB
4. Backend genera AI response
5. Backend salva AI response in DB
6. Backend return { userMessage, aiResponse }
7. Widget ignora userMessage (già mostrato)
8. Widget addMessage(aiResponse, 'bot')  ← Local display
```

**Problema**:
- Se POST fallisce → userMessage mostrato ma NON salvato in DB
- Se POST succeed MA response parsing fallisce → aiResponse salvato in DB ma NON mostrato
- **Inconsistenza tra UI e DB**

**Scenario Reale**:
```javascript
// User scrive "Ciao"
addMessage("Ciao", 'user');  // ✅ Mostrato immediatamente

// Network error durante POST
fetch(...).catch(error => {
  console.error('❌ Chat Error:', error);
  addMessage('Mi dispiace, c\'è stato un problema. Riprova...', 'bot');
  // ❌ "Ciao" rimane visible ma NON è in DB!
});

// User refresha pagina:
// Sessione ripresa da DB → "Ciao" message MANCANTE
```

**Fix Raccomandato**:
```javascript
// APPROCCIO 1: Optimistic UI con rollback
const tempId = Date.now().toString();
addMessage(message, 'user', null, null, tempId);  // Temporary ID

try {
  const response = await fetch(...);
  // Success: mark as confirmed
  confirmMessage(tempId, response.data.data.message.id);
} catch (error) {
  // Rollback: remove temp message
  removeMessage(tempId);
  addMessage('Errore invio. Riprova.', 'bot');
}

// APPROCCIO 2: Wait for confirmation
// Non mostrare userMessage finché POST non succeed
showLoadingIndicator('Invio messaggio...');
try {
  const response = await fetch(...);
  if (response.data.data.message) {
    addMessage(response.data.data.message.content, 'user');  // ✅ From server
  }
  if (response.data.data.aiResponse) {
    addMessage(response.data.data.aiResponse.content, 'bot');
  }
} finally {
  hideLoadingIndicator();
}
```

**Effort**: 1 ora
**Priority**: 🟡 P2

---

## 🟢 LOW PRIORITY - Code Smells

### BUG #10: Chat.messages Parsing Fragile

**File**: Multiple (backend controllers, frontend components, widget)
**Severity**: 🟢 LOW - **Error handling mancante**

**Pattern Ripetuto** (20+ occorrenze):
```javascript
const messages = JSON.parse(session.messages || '[]');  // ❌ No try/catch
```

**Problema**:
- Se `session.messages` contiene JSON invalido → crash
- Nessun error handling
- Nessun fallback

**Possibili Cause JSON Invalido**:
1. Race condition durante write (vedi Bug #5)
2. Database corruption
3. Manual DB edit
4. Migration bug

**Impact**:
- Intero controller crash
- Chat diventa inaccesibile
- 500 Internal Server Error

**Fix Pattern**:
```javascript
function parseMessages(messagesString) {
  try {
    const parsed = JSON.parse(messagesString || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse messages:', error);
    console.error('Invalid messages string:', messagesString);
    // Return empty array + log for monitoring
    return [];
  }
}

// Usage:
const messages = parseMessages(session.messages);
```

**Occorrenze da Fixare**:
- `chat.controller.js`: Lines 152, 287, 370, 433, 781, 1000, 1057, 1114
- `ChatWindow.jsx`: Line 77, 195-197
- Widget: Line 1792

**Effort**: 2 ore (refactor + testing)
**Priority**: 🟢 P3

---

## 📊 Summary Matrix

| Bug # | Component | Severity | Impact | Users Affected | Current Status | Effort | Priority |
|-------|-----------|----------|--------|----------------|----------------|--------|----------|
| #1 | Backend Socket | 🔴 CRITICAL | Chat close broken | 100% widget users | BROKEN | 30s | P0 |
| #2 | Backend Socket | 🔴 CRITICAL | Transfer broken | All operators | BROKEN | 20s | P0 |
| #3 | Frontend Filter | 🟠 HIGH | Transfer UI broken | All operators | BROKEN | 10s | P1 |
| #4 | Frontend Socket | 🟡 MEDIUM | UI not updated | All operators | DEGRADED | 5m | P2 |
| #5 | Backend Storage | 🟠 HIGH | Data loss | Active chats | AT RISK | 2d | P1 |
| #6 | Backend Schema | 🟠 HIGH | Performance | Growing | DEGRADED | 3d | P1 |
| #7 | Widget Interval | 🟡 MEDIUM | Memory leak | All widget users | LEAK | 10m | P2 |
| #8 | Frontend Timeout | 🟡 MEDIUM | Memory leak | All operators | LEAK | 5m | P2 |
| #9 | Widget Consistency | 🟡 MEDIUM | UI/DB mismatch | All widget users | INCONSISTENT | 1h | P2 |
| #10 | All - Parsing | 🟢 LOW | Crash on invalid data | Edge cases | FRAGILE | 2h | P3 |

---

## 🚀 Recommended Fix Order

### IMMEDIATE (Today)
1. **Bug #1**: Fix `chat_closed` event (30 seconds)
2. **Bug #2**: Fix transfer events (20 seconds)
3. **Bug #3**: Remove `isOnline` filter (10 seconds)

**Total**: 1 minuto - **3 critical bugs fixed**

### SHORT TERM (This Week)
4. **Bug #7**: Fix settings auto-refresh leak (10 min)
5. **Bug #8**: Fix typing timeout leak (5 min)
6. **Bug #4**: Add chat_closed listener (5 min)

**Total**: 20 minuti

### MEDIUM TERM (Next 2 Weeks)
7. **Bug #5**: Implement transaction locking (2 days)
8. **Bug #9**: Fix message consistency (1 hour)
9. **Bug #6**: Migrate to separate Messages table (3 days)

**Total**: ~1 settimana

### LONG TERM (Next Month)
10. **Bug #10**: Add robust JSON parsing (2 hours)
11. Code review generale
12. E2E testing suite

---

## 🧪 Testing Scenarios per Verificare Fix

### Test #1: Chat Close
```
1. User apre widget
2. User scrive messaggio
3. Operator risponde
4. Operator clicca "Chiudi Chat"
5. ✅ VERIFY: Widget mostra "Chat chiusa"
6. ✅ VERIFY: Input field disabilitato
7. ✅ VERIFY: Placeholder = "Chat chiusa"
```

### Test #2: Transfer Chat
```
1. Operator A ha chat attiva
2. Operator A clicca "Trasferisci"
3. ✅ VERIFY: Modal mostra lista operatori disponibili (non vuota!)
4. Operator A seleziona Operator B
5. Operator A clicca "Trasferisci"
6. ✅ VERIFY: Operator A riceve notifica "Chat trasferita"
7. ✅ VERIFY: Operator B riceve notifica "Chat ricevuta"
8. ✅ VERIFY: Dashboard Operator B mostra nuova chat
```

### Test #3: Concurrent Messages
```
1. User e Operator in chat attiva
2. User scrive "Messaggio 1" (non invia)
3. Operator scrive "Risposta 1" → SEND
4. User SEND "Messaggio 1" (simultaneamente)
5. ✅ VERIFY: Entrambi i messaggi salvati in DB
6. ✅ VERIFY: Entrambi visibili in chat history
7. ✅ VERIFY: Ordine cronologico corretto
```

### Test #4: Memory Leak
```
1. Apri widget su pagina 1
2. Naviga a pagina 2 (widget re-init)
3. Naviga a pagina 3 (widget re-init)
4. Ripeti 10 volte
5. Apri DevTools → Performance → Memory
6. ✅ VERIFY: Memory usage stabile (no crescita continua)
7. ✅ VERIFY: setInterval count stabile (max 1)
```

---

## 📝 Note Implementative

### Socket.IO Room Naming Convention

**STANDARD ADOTTATO** (da mantenere):
```javascript
// ✅ CORRECT naming with UNDERSCORE
chat_${sessionId}       // Chat room for user + operator
operator_${operatorId}  // Operator personal room
dashboard               // All operators broadcast room
```

**❌ EVITARE**:
```javascript
// ❌ WRONG - causes missed events
chat:${sessionId}       // COLON - inconsistent
operator:${operatorId}  // COLON - inconsistent
```

### Transaction Pattern Raccomandato

```javascript
// Standard transaction pattern per messaggi
async function addMessageToSession(sessionId, newMessage) {
  return await prisma.$transaction(async (tx) => {
    // Lock session row
    const session = await tx.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const messages = parseMessages(session.messages);  // Safe parsing
    messages.push(newMessage);

    await tx.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    return messages;
  });
}
```

---

**Report Creato**: 29 Ottobre 2025
**Prossimo Step**: Implementare fix P0 immediati (Bugs #1, #2, #3)
**Validation**: Testing con scenari sopra elencati
