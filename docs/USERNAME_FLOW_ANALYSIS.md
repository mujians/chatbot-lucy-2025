# 📊 ANALISI COMPLETA FLUSSO userName

**Data**: 3 Novembre 2025
**Feature**: v2.3.3 - Name Extraction
**Status**: ⚠️ IMPLEMENTATO ma NON VISIBILE in Dashboard

---

## 🎯 **OBIETTIVO FEATURE**

Estrarre automaticamente il nome dell'utente quando risponde alla domanda "come ti chiami?" dell'operatore, e mostrarlo nella dashboard al posto di "Visitatore".

---

## 🔄 **FLUSSO UX COMPLETO**

### **1. Scenario Utente**

```
T=0: Utente apre widget
     userName: null (default)
     Display: "Guest" / "Visitatore"

T=1: Utente richiede operatore
     Status: ACTIVE → WAITING
     Widget: "⏳ In attesa di un operatore..."

T=2: Operatore accetta chat
     Status: WAITING → WITH_OPERATOR
     Backend: Invia messaggio automatico

T=3: Widget riceve messaggio operatore
     Content: "Ciao! Dammi un attimo che controllo la conversazione. Intanto, come ti chiami?"
     Display: Messaggio visibile all'utente

T=4: Utente risponde "Marco"
     Widget: sendUserMessage("Marco")
     Backend: Riceve messaggio

T=5: Backend analizza messaggio
     extractUserName("Marco") → returns "Marco"
     Database: UPDATE ChatSession SET userName='Marco'
     WebSocket: Emit user_name_captured to operator

T=6a: Dashboard riceve evento
      ✅ Frontend ha listener
      ❓ Dashboard aggiorna chat list?

T=6b: ChatListPanel display
      ❓ Mostra "Marco" o ancora "Visitatore"?
```

---

## 🏗️ **ARCHITETTURA IT**

### **Backend - Name Extraction**

**File**: `src/controllers/chat.controller.js`

#### 1. Funzione di Estrazione (Lines 75-143)

```javascript
function extractUserName(messageContent) {
  if (!messageContent || typeof messageContent !== 'string') {
    return null;
  }

  const trimmed = messageContent.trim();

  // Skip if message is too long (likely not just a name)
  if (trimmed.length > 50) {
    return null;
  }

  // Skip if message contains typical conversation phrases
  const conversationPhrases = [
    'ciao', 'salve', 'buongiorno', 'buonasera', 'grazie', 'prego',
    'aiuto', 'help', 'problema', 'non funziona', 'come', 'cosa',
    'quando', 'dove', 'perché', 'perche', 'vorrei', 'mi serve',
    'ho bisogno', 'devo', 'posso', 'puoi', 'può', 'puo'
  ];

  const lowerMessage = trimmed.toLowerCase();
  if (conversationPhrases.some(phrase => lowerMessage.includes(phrase))) {
    return null;
  }

  // Pattern detection for common name introductions
  // "mi chiamo Marco", "sono Marco", "Marco", etc.
  const namePatterns = [
    /(?:mi chiamo|sono|chiamami|mi puoi chiamare|il mio nome è|il mio nome e)\s+([a-zA-Zàèéìòù'\s]+)/i,
    /^([A-Z][a-zàèéìòù']+(?:\s+[A-Z][a-zàèéìòù']+)?)$/  // Capitalized name(s)
  ];

  for (const pattern of namePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      let name = match[1] ? match[1].trim() : match[0].trim();

      // Clean up name
      name = name.replace(/\s+/g, ' ');

      // Validate name length
      if (name.length >= 2 && name.length <= 30) {
        return name;
      }
    }
  }

  return null;
}
```

**Pattern Supportati**:
- ✅ `"Marco"` → Marco
- ✅ `"mi chiamo Marco"` → Marco
- ✅ `"sono Marco"` → Marco
- ✅ `"Marco Rossi"` → Marco Rossi
- ❌ `"ciao marco"` → null (conversazione)
- ❌ `"mi chiamo marco e ho un problema..."` → null (troppo lungo)

#### 2. Applicazione in sendUserMessage (Lines 565-590)

```javascript
// v2.3.3: Extract and save user name if not already set
if (!session.userName && session.status === 'WITH_OPERATOR') {
  const extractedName = extractUserName(message);
  if (extractedName) {
    console.log(`📝 Extracted user name: "${extractedName}" from session ${sessionId}`);

    // Update session with userName
    session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { userName: extractedName },
      select: {
        id: true,
        operatorId: true,
        userName: true,
        status: true,
      },
    });

    // Notify operator that we captured the name
    if (session.operatorId) {
      io.to(`operator_${session.operatorId}`).emit('user_name_captured', {
        sessionId: sessionId,
        userName: extractedName,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

**Condizioni per Estrazione**:
1. ✅ `session.userName` deve essere null/undefined
2. ✅ `session.status` deve essere `'WITH_OPERATOR'`
3. ✅ `extractUserName()` deve ritornare un valore non-null

**Evento WebSocket**:
- **Canale**: `operator_${operatorId}`
- **Evento**: `user_name_captured`
- **Payload**: `{ sessionId, userName, timestamp }`

#### 3. Automatic Greeting Message (Lines 980-988, 1165-1172)

```javascript
// When operator accepts chat (WAITING → WITH_OPERATOR)
const greetingMessage = await prisma.message.create({
  data: {
    sessionId: sessionId,
    type: 'OPERATOR',
    content: `Ciao! Dammi un attimo che controllo la conversazione. Intanto, come ti chiami?`,
    operatorId: operator.id,
  },
});
```

**Trigger**:
- `acceptOperator()` (line 980-988) - Operatore accetta chat WAITING
- `operatorIntervene()` (line 1165-1172) - Operatore interviene in chat ACTIVE

---

### **Frontend Dashboard - Display Name**

**File**: `frontend/src/pages/Index.tsx`

#### 1. WebSocket Listener (Lines 364-381)

```typescript
// v2.3.3: User name captured from message
socket.on('user_name_captured', (data) => {
  console.log('📝 User name captured:', data);

  // Update chat userName in the list
  setChats(prev => prev.map(chat =>
    chat.id === data.sessionId
      ? { ...chat, userName: data.userName }
      : chat
  ));

  // Update selected chat if it's the current one
  if (selectedChat?.id === data.sessionId) {
    setSelectedChat(prev => prev ? { ...prev, userName: data.userName } : null);
  }

  // Update AI chats if it's there
  setActiveAIChats(prev => prev.map(chat =>
    chat.id === data.sessionId
      ? { ...chat, userName: data.userName }
      : chat
  ));
});
```

**Stato Aggiornato**:
1. ✅ `chats` array - Lista chat in sidebar
2. ✅ `selectedChat` - Chat attualmente aperta
3. ✅ `activeAIChats` - Chat AI attive (monitor)

#### 2. API Load Chats (Lines 448-487)

```typescript
const loadChats = async () => {
  try {
    const params: any = {};
    if (searchQuery) params.search = searchQuery;

    const response = await chatApi.getSessions(params);
    const sessionsData = response.data || response;

    // Parse messages JSON string and add computed lastMessage
    const parsedChats = sessionsData.map((session: any) => {
      // ...parsing logic...

      return {
        ...session,  // ✅ userName è incluso qui dal backend
        messages,
        lastMessage: messages.length > 0 ? messages[messages.length - 1] : undefined,
      };
    });

    setChats(parsedChats);
  } catch (error) {
    console.error('❌ Failed to load chats:', error);
  }
};
```

**Backend Response** (`getSessions` lines 1598-1673):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userName": "Marco",  // ✅ Campo presente nel response
      "status": "WITH_OPERATOR",
      "operatorId": "...",
      "messages": [...],
      "lastMessage": {...},
      "urgencyScore": 1245.5,
      // ...altri campi...
    }
  ]
}
```

#### 3. ChatListPanel Display (Lines 121-123)

```tsx
<span className="font-semibold text-base truncate">
  {chat.userName || `Visitatore`}
</span>
```

**Logica Display**:
- Se `chat.userName` esiste → mostra il nome
- Altrimenti → mostra "Visitatore"

---

## 🔍 **DEBUG CHECKLIST**

### **Backend Verification**

```sql
-- 1. Verifica userName nel database
SELECT id, "userName", status, "lastMessageAt"
FROM "ChatSession"
WHERE "userName" IS NOT NULL
ORDER BY "lastMessageAt" DESC
LIMIT 10;

-- 2. Verifica tutte le sessioni WITH_OPERATOR
SELECT id, "userName", status, "operatorId"
FROM "ChatSession"
WHERE status = 'WITH_OPERATOR'
ORDER BY "createdAt" DESC
LIMIT 10;
```

### **Backend Console Logs**

```bash
# Quando userName viene estratto:
📝 Extracted user name: "Marco" from session 3c404354-bf07-47f3-a367-ef4485a8bf6e
✅ Chat 3c404354-bf07-47f3-a367-ef4485a8bf6e userName saved: Marco
```

### **Frontend Console Logs**

```javascript
// Quando evento viene ricevuto:
📝 User name captured: {
  sessionId: "3c404354-bf07-47f3-a367-ef4485a8bf6e",
  userName: "Marco",
  timestamp: "2025-11-03T10:30:15.234Z"
}

// Verifica stato chats:
console.log('Current chats:', chats.map(c => ({ id: c.id, userName: c.userName })));
```

### **Network Inspection**

1. **WebSocket Events** (Chrome DevTools → Network → WS):
   ```
   → user_message: "Marco"
   ← user_name_captured: { sessionId, userName: "Marco" }
   ```

2. **GET /api/chat/sessions**:
   ```json
   {
     "data": [
       {
         "id": "...",
         "userName": "Marco",  // ✅ Verifica presenza
         "status": "WITH_OPERATOR"
       }
     ]
   }
   ```

---

## ⚠️ **POSSIBILI PROBLEMI**

### **1. userName Non Estratto dal Messaggio**

**Causa**: Pattern non riconosciuto o condizioni non soddisfatte

**Debug**:
```javascript
// Backend: Aggiungi log in extractUserName()
console.log('🔍 Attempting to extract name from:', messageContent);
console.log('🔍 Pattern match result:', extractedName);
```

**Test Cases**:
```javascript
extractUserName("Marco")          // ✅ → "Marco"
extractUserName("mi chiamo Marco") // ✅ → "Marco"
extractUserName("sono Marco")      // ✅ → "Marco"
extractUserName("ciao Marco")      // ❌ → null (conversazione)
extractUserName("MarcoRossi")      // ❌ → null (no spazio)
```

### **2. userName Salvato ma Non Visibile in Dashboard**

**Possibili Cause**:

**A) Evento `user_name_captured` non ricevuto**
- Verifica WebSocket connesso: `socket.connected === true`
- Verifica operatore connesso al room: `operator_${operatorId}`
- Backend log: `io.to('operator_...')` sta emettendo?

**B) Frontend non aggiorna stato**
- Verifica listener registrato: `socket.on('user_name_captured')`
- Verifica `setChats()` viene chiamato
- React DevTools: Controlla se `chats[].userName` cambia

**C) loadChats() sovrascrive il nome**
- Se `loadChats()` viene chiamato DOPO l'evento
- Ma PRIMA che backend abbia salvato nel DB
- → nome viene perso perché DB ritorna ancora `userName: null`

**Timing Issue**:
```
T=0: User invia "Marco"
T=1: Backend extractUserName() → "Marco"
T=2: Backend UPDATE database
T=3: Backend emit user_name_captured
T=4: Frontend riceve evento → setChats (userName: "Marco")
T=5: ⚠️ Frontend chiama loadChats() per altro motivo
T=6: ⚠️ Database UPDATE non completato ancora
T=7: loadChats() riceve userName: null
T=8: ❌ Nome sovrascritto con null
```

**D) ChatListPanel riceve props vecchi**
- Verifica che `chats` prop sia aggiornato
- React key non cambia → componente non re-render

### **3. userName Mostrato ma Poi Scompare**

**Causa**: Refresh della lista sovrascrive il nome

**Soluzione**: Verificare che ogni `loadChats()` includa il `userName` dal backend

---

## ✅ **POSSIBILI SOLUZIONI**

### **Soluzione 1: Verifica Database Salvataggio**

Aggiungi log dopo `prisma.chatSession.update()`:

```javascript
session = await prisma.chatSession.update({
  where: { id: sessionId },
  data: { userName: extractedName },
});

console.log(`✅ Database updated, session.userName:`, session.userName);

// Verifica immediata
const verifySession = await prisma.chatSession.findUnique({
  where: { id: sessionId },
  select: { id: true, userName: true },
});
console.log(`🔍 Verify DB read:`, verifySession);
```

### **Soluzione 2: Forza Re-fetch dopo Event**

```typescript
socket.on('user_name_captured', async (data) => {
  console.log('📝 User name captured:', data);

  // Update local state
  setChats(prev => prev.map(chat =>
    chat.id === data.sessionId
      ? { ...chat, userName: data.userName }
      : chat
  ));

  // ✅ NUOVO: Forza re-fetch per sincronizzare con DB
  await loadChats();
});
```

### **Soluzione 3: Ottimizzazione - Aggiorna Solo Chat Specifica**

Invece di aggiornare tutto l'array, aggiorna solo la chat interessata:

```typescript
socket.on('user_name_captured', (data) => {
  console.log('📝 User name captured:', data);

  setChats(prev => {
    const chatIndex = prev.findIndex(c => c.id === data.sessionId);
    if (chatIndex === -1) return prev;

    const updatedChats = [...prev];
    updatedChats[chatIndex] = {
      ...updatedChats[chatIndex],
      userName: data.userName
    };

    return updatedChats;
  });

  // Same for selectedChat
  if (selectedChat?.id === data.sessionId) {
    setSelectedChat(prev => prev ? { ...prev, userName: data.userName } : null);
  }
});
```

### **Soluzione 4: Backend - Emit a Dashboard Room**

Attualmente l'evento va solo a `operator_${operatorId}`. Aggiungere anche broadcast alla dashboard:

```javascript
// Notify operator
if (session.operatorId) {
  io.to(`operator_${session.operatorId}`).emit('user_name_captured', {
    sessionId: sessionId,
    userName: extractedName,
    timestamp: new Date().toISOString(),
  });

  // ✅ NUOVO: Broadcast anche a dashboard room
  io.to('dashboard').emit('user_name_captured', {
    sessionId: sessionId,
    userName: extractedName,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 📊 **ANALISI FLOW COMPLETO**

### **Flow Ottimale (Funzionante)**

```
[USER] Scrive "Marco"
   ↓
[WIDGET] sendUserMessage("Marco")
   ↓
[BACKEND] Riceve in chat.controller.js:sendUserMessage()
   ↓
[BACKEND] extractUserName("Marco") → "Marco"
   ↓
[BACKEND] prisma.chatSession.update({ userName: "Marco" })
   ↓
[DATABASE] userName salvato ✅
   ↓
[BACKEND] io.to(`operator_${operatorId}`).emit('user_name_captured', ...)
   ↓
[FRONTEND] socket.on('user_name_captured') → setChats(...) ✅
   ↓
[DASHBOARD] ChatListPanel riceve props con userName ✅
   ↓
[UI] Mostra "Marco" invece di "Visitatore" ✅
```

### **Flow Problematico (Non Visibile)**

```
[USER] Scrive "Marco"
   ↓
[BACKEND] extractUserName() → "Marco" ✅
   ↓
[BACKEND] prisma.chatSession.update() ✅
   ↓
[BACKEND] emit user_name_captured ✅
   ↓
[FRONTEND] Riceve evento ✅
   ↓
[FRONTEND] setChats() aggiorna ✅
   ↓
⚠️ PROBLEMA: React non re-render?
⚠️ PROBLEMA: loadChats() subito dopo sovrascrive?
⚠️ PROBLEMA: ChatListPanel usa props vecchi?
   ↓
[UI] Mostra ancora "Visitatore" ❌
```

---

## 🎯 **RACCOMANDAZIONI**

### **Immediate Actions**

1. **Aggiungi Logging Dettagliato**:
   ```javascript
   // Backend
   console.log(`📝 Extracted name: "${extractedName}"`);
   console.log(`✅ Database updated: ${session.userName}`);
   console.log(`📤 Emitting user_name_captured to operator_${session.operatorId}`);

   // Frontend
   console.log(`📝 Received user_name_captured:`, data);
   console.log(`🔄 Before setChats:`, chats.find(c => c.id === data.sessionId)?.userName);
   console.log(`🔄 After setChats:`, /* next render */);
   ```

2. **Test con Console Commands**:
   ```javascript
   // In browser console quando operatore è connesso
   socket.emit('user_message', {
     sessionId: '<current-session-id>',
     message: 'Marco'
   });

   // Verifica evento ricevuto
   socket.on('user_name_captured', console.log);
   ```

3. **Verifica Database Directly**:
   ```sql
   -- Subito dopo che utente scrive "Marco"
   SELECT "userName" FROM "ChatSession" WHERE id = '<session-id>';
   -- Deve ritornare "Marco" entro 1 secondo
   ```

### **Long-term Improvements**

1. **Add to getSessions() Response Logging**:
   ```javascript
   const sessionsWithMessages = sessions.map((session) => {
     console.log(`Session ${session.id}: userName="${session.userName}"`);
     return { ...session, ... };
   });
   ```

2. **Widget: Show User Name in Header**:
   ```javascript
   // Widget mostra "Chat con Marco" invece di "Chat"
   if (userName) {
     chatTitle.textContent = `Chat con ${userName}`;
   }
   ```

3. **Add Test Endpoint**:
   ```javascript
   // GET /api/chat/sessions/:sessionId/debug
   router.get('/sessions/:sessionId/debug', async (req, res) => {
     const session = await prisma.chatSession.findUnique({
       where: { id: req.params.sessionId },
       select: { id: true, userName: true, status: true, operatorId: true }
     });
     res.json({ session, timestamp: new Date().toISOString() });
   });
   ```

---

## 📝 **CONCLUSIONE**

La feature di name extraction è **COMPLETAMENTE IMPLEMENTATA** dal punto di vista tecnico:
- ✅ Backend estrae il nome
- ✅ Backend salva nel database
- ✅ Backend emette evento WebSocket
- ✅ Frontend ha listener
- ✅ Frontend aggiorna stato
- ✅ UI legge da props

**Il problema è**: userName non appare nella dashboard.

**Possibili cause** (da verificare nell'ordine):
1. Database UPDATE non completa (transazione/latency)
2. WebSocket evento non arriva al frontend
3. React state update non triggera re-render
4. loadChats() sovrascrive il nome
5. ChatListPanel riceve props stale

**Next Steps**:
1. Aggiungere logging dettagliato in tutti i punti critici
2. Test manuale con console commands
3. Verifica database timing con query dirette
4. Analisi network per eventi WebSocket

---

**Version**: v2.3.3
**Last Updated**: 3 Novembre 2025
