# 🔄 Operator Flow Changes - DA RIFARE con Message Table

**Data**: 30 Ottobre 2025
**Problema**: Modifiche fatte su codice vecchio (JSON messages), da riscrivere con Message table

**Branch backup**: `backup-operator-flow-old-code`

---

## 📝 MODIFICHE DA RIFARE

### 1. **requestOperator()** - backend/src/controllers/chat.controller.js

**Posizione**: Circa linea 237

**MODIFICHE FATTE (su vecchio codice)**:
```javascript
// PRIMA (auto-assignment):
await prisma.chatSession.update({
  where: { id: sessionId },
  data: {
    status: 'WITH_OPERATOR',      // ❌ Assegnava subito
    operatorId: assignedOperator.id,
  },
});

messages.push({
  type: 'system',
  content: `${assignedOperator.name} si è unito alla chat`,  // ❌ Messaggio prima dell'accettazione
});

io.to(`operator_${assignedOperator.id}`).emit('new_chat_request', {...});
io.to('dashboard').emit('chat_assigned', {...});  // ❌ Evento sbagliato

// DOPO (WAITING state):
await prisma.chatSession.update({
  where: { id: sessionId },
  data: {
    status: 'WAITING',  // ✅ In attesa
    lastMessageAt: new Date(),
  },
});

// ✅ NON aggiunge messaggi
// ✅ Emette a TUTTI gli operatori disponibili
for (const operator of availableOperators) {
  io.to(`operator_${operator.id}`).emit('new_chat_request', {
    sessionId,
    userName: session.userName || `Utente #${sessionId.slice(0, 8)}`,
    lastMessage: lastUserMessage?.content || '',
    timestamp: new Date().toISOString(),
  });
}

io.to('dashboard').emit('chat_waiting_operator', {  // ✅ Nuovo evento
  sessionId,
  userName: session.userName,
  timestamp: new Date().toISOString(),
});

io.to(`chat_${sessionId}`).emit('operator_request_sent', {  // ✅ Nuovo evento
  sessionId,
  status: 'WAITING',
  message: 'Richiesta inviata. In attesa di un operatore...',
});
```

**DA FARE**:
- ✅ Cambiare status a WAITING
- ✅ Emettere a tutti gli operatori
- ✅ Emettere `chat_waiting_operator` invece di `chat_assigned`
- ✅ NON aggiungere messaggi system (corretto così)

---

### 2. **acceptOperator()** - NUOVA FUNZIONE

**Posizione**: Dopo `requestOperator()`, circa linea 327

**CODICE SCRITTO (❌ USA JSON)**:
```javascript
export const acceptOperator = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { operatorId } = req.body;

    // ... validazioni ...

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (session.status !== 'WAITING') {
      return res.status(400).json({
        error: { message: 'Session is not waiting for operator' }
      });
    }

    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'WITH_OPERATOR',
        operatorId: operatorId,
      },
    });

    // ❌ VECCHIO - USA JSON
    const messages = JSON.parse(session.messages || '[]');
    const systemMessage = {
      id: Date.now().toString(),
      type: 'system',
      content: `${operator.name} si è unito alla chat`,
      timestamp: new Date().toISOString(),
    };
    messages.push(systemMessage);

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    // Update operator stats
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        activeChats: { increment: 1 },
        totalChatsHandled: { increment: 1 },
      },
    });

    // Emit events
    io.to(`chat_${sessionId}`).emit('operator_joined', {
      sessionId,
      operatorName: operator.name,
      operatorId: operator.id,
      message: systemMessage,
    });

    io.to('dashboard').emit('chat_accepted', {
      sessionId,
      operatorId: operator.id,
      operatorName: operator.name,
    });

    io.to('dashboard').emit('chat_request_cancelled', {
      sessionId,
      reason: 'accepted_by_another_operator',
    });

    res.json({
      success: true,
      data: {
        session: {
          id: sessionId,
          status: 'WITH_OPERATOR',
          operatorId: operator.id,
          operatorName: operator.name,
        },
      },
    });
  } catch (error) {
    console.error('Accept operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
```

**✅ CODICE CORRETTO (CON createMessage)**:
```javascript
export const acceptOperator = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { operatorId } = req.body;

    if (!operatorId) {
      return res.status(400).json({
        error: { message: 'Operator ID is required' },
      });
    }

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Verify session is in WAITING status
    if (session.status !== 'WAITING') {
      return res.status(400).json({
        error: { message: 'Session is not waiting for operator' },
      });
    }

    // Get operator details
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      return res.status(404).json({
        error: { message: 'Operator not found' },
      });
    }

    // ✅ NUOVO - USA createMessage con transaction
    const { message: systemMessage } = await createMessage(
      sessionId,
      {
        type: 'system',
        content: `${operator.name} si è unito alla chat`,
      },
      {
        status: 'WITH_OPERATOR',
        operatorId: operatorId,
      }
    );

    // Update operator stats
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        activeChats: { increment: 1 },
        totalChatsHandled: { increment: 1 },
      },
    });

    // Notify widget: operator joined
    io.to(`chat_${sessionId}`).emit('operator_joined', {
      sessionId: sessionId,
      operatorName: operator.name,
      operatorId: operator.id,
      message: {
        id: systemMessage.id,
        type: systemMessage.type,
        content: systemMessage.content,
        timestamp: systemMessage.createdAt,
      },
    });

    // Notify dashboard: chat accepted
    io.to('dashboard').emit('chat_accepted', {
      sessionId: sessionId,
      operatorId: operator.id,
      operatorName: operator.name,
    });

    // Notify OTHER operators: this chat is now taken
    io.to('dashboard').emit('chat_request_cancelled', {
      sessionId: sessionId,
      reason: 'accepted_by_another_operator',
    });

    console.log(`✅ Operator ${operator.name} accepted chat ${sessionId}`);

    res.json({
      success: true,
      data: {
        session: {
          id: sessionId,
          status: 'WITH_OPERATOR',
          operatorId: operator.id,
          operatorName: operator.name,
        },
      },
    });
  } catch (error) {
    console.error('Accept operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
```

---

### 3. **cancelOperatorRequest()** - NUOVA FUNZIONE

**Posizione**: Prima di `acceptOperator()`, circa linea 327

**CODICE SCRITTO (✅ CORRETTO - non usa messaggi)**:
```javascript
export const cancelOperatorRequest = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    if (session.status !== 'WAITING') {
      return res.status(400).json({
        error: { message: 'Session is not waiting for operator' },
      });
    }

    // Update session: revert to ACTIVE status
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        lastMessageAt: new Date(),
      },
    });

    // Notify dashboard: remove from pending list
    io.to('dashboard').emit('chat_request_cancelled', {
      sessionId: sessionId,
      reason: 'cancelled_by_user',
    });

    // Notify widget: request cancelled
    io.to(`chat_${sessionId}`).emit('operator_request_cancelled', {
      sessionId: sessionId,
      status: 'ACTIVE',
      message: 'Richiesta annullata. Puoi continuare a chattare con l\'assistente AI.',
    });

    console.log(`🚫 User cancelled operator request for session ${sessionId}`);

    res.json({
      success: true,
      data: {
        status: 'ACTIVE',
        message: 'Richiesta operatore annullata',
      },
    });
  } catch (error) {
    console.error('Cancel operator request error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
```

**DA FARE**:
- ✅ Copiare esattamente questo codice (è corretto, non usa messaggi)

---

### 4. **Routes** - backend/src/routes/chat.routes.js

**AGGIUNGERE ALL'IMPORT**:
```javascript
import {
  createSession,
  getSession,
  sendUserMessage,
  requestOperator,
  cancelOperatorRequest,  // ✅ AGGIUNGERE
  acceptOperator,         // ✅ AGGIUNGERE
  sendOperatorMessage,
  // ... resto
} from '../controllers/chat.controller.js';
```

**AGGIUNGERE ROUTES**:
```javascript
// Public routes (for widget)
router.post('/session/:sessionId/cancel-operator-request', cancelOperatorRequest);

// Protected routes (for operators)
router.post('/sessions/:sessionId/accept-operator', authenticateToken, acceptOperator);
```

---

## 🔍 FUNZIONI CHE ESISTEVANO GIÀ

Sul branch `backend/main` esistevano già questi fix che NON conoscevamo:

1. **createMessage()** - Helper per creare singolo messaggio con transaction
2. **createMessages()** - Helper per creare multipli messaggi con transaction
3. **BUG #1-10 fixes** - WebSocket room fixes, memory leaks, race conditions
4. **Message table** - Refactoring completo da JSON a table separata
5. **Transaction locking** - Tutti i controller usano `FOR UPDATE` per race conditions
6. **Safe JSON parsing** - Gestione errori JSON parse

---

## ✅ CHECKLIST RISCRITTURA

Prima di iniziare:
- [ ] Sei in `/Users/brnobtt/Desktop/lucine-production/backend`
- [ ] Hai fatto `git fetch backend`
- [ ] Hai fatto `git checkout main`
- [ ] Hai fatto `git reset --hard backend/main`
- [ ] Hai letto la funzione `createMessage()` nel file
- [ ] Hai letto `requestOperator()` esistente per capire lo stile

Mentre scrivi:
- [ ] `acceptOperator()` usa `createMessage()`, NON JSON
- [ ] `cancelOperatorRequest()` non usa messaggi (ok così)
- [ ] `requestOperator()` modificato per emettere eventi corretti
- [ ] Routes aggiunte correttamente

Dopo aver scritto:
- [ ] Test locale: `npm run dev`
- [ ] Test API con Postman/curl
- [ ] Commit: `git commit -m "feat: Implement WAITING state operator flow"`
- [ ] Push: `git push backend main`
- [ ] Verifica deploy su Render

---

## 📦 EXPORT NECESSARIO

La funzione `createMessage` è già esportata/importata in chat.controller.js?
**Verifica con**: `grep -n "createMessage" backend/src/controllers/chat.controller.js`

Se è definita all'inizio del file, puoi usarla direttamente.

---

## 🧪 TEST DOPO IMPLEMENTAZIONE

```bash
# 1. Backend locale
cd backend
npm run dev

# 2. Test request operator
curl -X POST http://localhost:5000/api/chat/session/TEST-SESSION-ID/request-operator

# 3. Test accept operator (con JWT token)
curl -X POST http://localhost:5000/api/chat/sessions/TEST-SESSION-ID/accept-operator \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"OPERATOR-UUID"}'

# 4. Test cancel
curl -X POST http://localhost:5000/api/chat/session/TEST-SESSION-ID/cancel-operator-request
```

---

**SALVATO IN**: `backup-operator-flow-old-code` branch
**DA RIFARE SU**: `backend/main` branch pulito
**USARE**: `createMessage()` invece di JSON
