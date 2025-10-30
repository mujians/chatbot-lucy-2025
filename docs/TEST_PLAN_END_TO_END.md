# Test Plan End-to-End - Sistema Lucine
**Data**: 29 Ottobre 2025
**Deploy**: commit f1b5f8d / 7aa0507

## ✅ Pre-requisiti

- [ ] Backend deployed su Render: https://chatbot-lucy-2025.onrender.com
- [ ] Dashboard accessibile con credenziali operatore
- [ ] Widget installato su Shopify
- [ ] Browser: Chrome normale + Chrome incognito

---

## 🧪 TEST 1: Backend Endpoints (Automated)

### 1.1 Public Settings Endpoint
```bash
curl https://chatbot-lucy-2025.onrender.com/api/settings/public
```
**Expected**:
```json
{
  "success": true,
  "data": {
    "primaryColor": "#dc2626",
    "greeting": "...",
    "title": "LUCY - ASSISTENTE VIRTUALE"
  }
}
```
**Result**: ✅ PASS / ❌ FAIL

---

### 1.2 Operator Message Endpoint Exists (P2 Fix)
```bash
curl -X POST https://chatbot-lucy-2025.onrender.com/api/chat/session/test-id/operator-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"message":"test"}'
```
**Expected**: `{"error":{"message":"Invalid token"}}` (401) - endpoint esiste!
**Result**: ✅ PASS / ❌ FAIL

---

## 🧪 TEST 2: Dashboard Frontend - Real-time Updates (P3 Fix)

### 2.1 Dashboard Login
1. Apri Dashboard: http://localhost:5173 (o URL production)
2. Login con credenziali operatore
3. Vai alla pagina Chat

**Expected**:
- Dashboard si carica senza errori
- Nessun errore "Cannot find module '../lib/axios'" (P1 fix)
- Chat list è visibile

**Result**: ✅ PASS / ❌ FAIL

---

### 2.2 Dashboard Socket.IO Connection
1. Apri DevTools → Console
2. Cerca nei logs:
   - `🔌 Client connected:` (Socket.IO connesso)
   - NO errori Socket.IO

**Expected**: Socket.IO connesso senza errori
**Result**: ✅ PASS / ❌ FAIL

---

### 2.3 New Chat Real-time Update
**Setup**:
- Dashboard aperta e loggato
- DevTools console aperta

**Steps**:
1. Apri widget in incognito (nuovo utente)
2. Invia primo messaggio nel widget
3. Guarda la Dashboard (NON ricaricare!)

**Expected**:
- Dashboard console mostra: `🆕 New chat created: {...}`
- Chat list si aggiorna automaticamente (SENZA refresh manuale)
- Nuova chat appare nella lista

**Result**: ✅ PASS / ❌ FAIL

---

## 🧪 TEST 3: Widget UX - Operator Assignment (P7 Fix)

### 3.1 Clear Old Session
1. Chrome normale → Apri DevTools (F12)
2. Console → esegui:
```javascript
localStorage.removeItem('chatSessionId');
localStorage.clear();
location.reload();
```

**Expected**: Widget si ricarica con nuova sessione
**Result**: ✅ PASS / ❌ FAIL

---

### 3.2 Request Operator - Misleading Message Fix
**Setup**: Widget aperto, nuova sessione

**Steps**:
1. Widget: invia "voglio parlare con operatore"
2. Widget: clicca "Parla con Operatore"
3. Leggi messaggio che appare nel widget

**Expected** (P7 Fix):
- Messaggio: "⏳ Ti abbiamo messo in coda. Admin Lucine ti risponderà a breve."
- NO messaggio "✅ Admin Lucine si è unito alla chat!" (era ingannevole)

**Result**: ✅ PASS / ❌ FAIL

---

## 🧪 TEST 4: Operator-User Communication (P2, P5, P6, P10)

### 4.1 Operator Accepts Chat
**Setup**:
- Widget (Chrome incognito) ha richiesto operatore
- Dashboard aperta

**Steps**:
1. Dashboard: vedi nuova chat in stato WAITING
2. Dashboard: clicca sulla chat per aprirla
3. Dashboard console: verifica logs

**Expected** (P10 Fix):
- Console mostra: `operator_join` con `operatorId` (NON sessionId)
- Console mostra: `join_chat` con `sessionId`
- NO errori

**Result**: ✅ PASS / ❌ FAIL

---

### 4.2 Operator Sends Message to User
**Setup**: ChatWindow aperto nella Dashboard

**Steps**:
1. Dashboard: scrivi messaggio "Ciao, sono qui per aiutarti"
2. Dashboard: clicca Invia
3. **Guarda il Widget** (Chrome incognito)

**Expected** (P2 Fix):
- Widget riceve il messaggio IMMEDIATAMENTE
- Messaggio appare con nome operatore
- Widget header mostra "Chat con Admin Lucine"

**Result**: ✅ PASS / ❌ FAIL

**Se FAIL**:
- Backend logs mostrano: `💬 Emitted to chat_${sessionId}`?
- Widget console mostra errori Socket.IO?

---

### 4.3 User Sends Message to Operator
**Setup**: ChatWindow aperto, operatore ha già inviato almeno 1 messaggio

**Steps**:
1. Widget: scrivi "Grazie! Ho una domanda"
2. Widget: clicca Invia
3. **Guarda la Dashboard ChatWindow**

**Expected**:
- Dashboard riceve messaggio IMMEDIATAMENTE
- Messaggio appare con timestamp corretto
- NO schermata bianca

**Result**: ✅ PASS / ❌ FAIL

---

### 4.4 Socket.IO Room Names Consistency (P2 Fix)
**Verification**: Durante test 4.2 e 4.3

**Backend logs should show**:
- `io.to('operator_123')` ← con underscore
- `io.to('chat_abc-def')` ← con underscore
- NO `operator:123` ← NO due punti

**Result**: ✅ PASS / ❌ FAIL

---

## 🧪 TEST 5: Dashboard Token Management (P8, P9 Fix)

### 5.1 ChatList Token Usage
**Setup**: Dashboard aperta, DevTools Network tab

**Steps**:
1. Dashboard: ricarica la pagina
2. Network: guarda request a `/api/chat/sessions`
3. Network: Headers → Authorization header

**Expected** (P8 Fix):
- Header `Authorization: Bearer <token>` presente
- Token preso da localStorage
- NO errori "token is not defined"

**Result**: ✅ PASS / ❌ FAIL

---

### 5.2 ChatWindow Transfer Chat
**Setup**: ChatWindow aperto

**Steps**:
1. Dashboard: clicca "🔄 Trasferisci Chat"
2. DevTools console: guarda per errori
3. Network: guarda request a `/api/operators`

**Expected** (P9 Fix):
- Modal si apre senza errori
- Request ha Authorization header
- NO errore "token is not defined"
- Lista operatori si carica

**Result**: ✅ PASS / ❌ FAIL

---

## 🧪 TEST 6: Widget operator_assigned Event (P5 Fix)

### 6.1 Real Operator Join Notification
**Setup**:
- Widget ha richiesto operatore
- Widget console aperta

**Steps**:
1. Dashboard: operatore apre ChatWindow
2. Dashboard: invia primo messaggio
3. **Guarda widget console**

**Expected** (P5 Fix):
- Widget riceve event: `operator_assigned`
- Widget mostra: "✅ Admin Lucine si è unito alla chat!"
- Questo è DOPO che operatore ha effettivamente aperto la chat

**Result**: ✅ PASS / ❌ FAIL

---

## 🧪 TEST 7: Dashboard WebSocket Rooms (P4 Fix)

### 7.1 Dashboard Room Join
**Setup**: Dashboard appena aperta

**Steps**:
1. DevTools console
2. Cerca logs Socket.IO

**Expected** (P4 Fix):
- Backend logs (Render): `📊 Dashboard client joined`
- Socket joined room 'dashboard'
- NO errori "unknown event join_dashboard"

**Result**: ✅ PASS / ❌ FAIL

---

## 📊 TEST SUMMARY

| Test | Status | Notes |
|------|--------|-------|
| 1.1 Public Settings | ⬜ | |
| 1.2 Operator Endpoint | ⬜ | |
| 2.1 Dashboard Login | ⬜ | |
| 2.2 Socket Connection | ⬜ | |
| 2.3 Real-time Updates | ⬜ | P3, P6 |
| 3.1 Clear Session | ⬜ | |
| 3.2 Misleading Message | ⬜ | P7 |
| 4.1 Operator Accept | ⬜ | P10 |
| 4.2 Operator → User | ⬜ | P2 |
| 4.3 User → Operator | ⬜ | |
| 4.4 Room Names | ⬜ | P2 |
| 5.1 ChatList Token | ⬜ | P8 |
| 5.2 Transfer Token | ⬜ | P9 |
| 6.1 operator_assigned | ⬜ | P5 |
| 7.1 Dashboard Room | ⬜ | P4 |

---

## 🚨 Common Issues & Solutions

### Issue: Dashboard doesn't update in real-time
**Check**:
- DevTools console: Socket.IO connected?
- Backend logs: `📊 Dashboard client joined`?
- Fix P3 applied? (ChatList.jsx Socket listeners)

### Issue: Operator messages don't reach user
**Check**:
- Backend logs: Room name format (operator_ vs operator:)
- Widget console: Socket.IO errors?
- Fix P2 applied? (Socket room names)

### Issue: Widget shows blank screen
**Check**:
- Session status in WITH_OPERATOR?
- Backend returns `withOperator: true`?
- Widget handles `data.data?.withOperator`?

### Issue: Dashboard crashes on load
**Check**:
- Console error: "Cannot find module '../lib/axios'"?
- Fix P1 applied? (axios.js file exists)

---

## ✅ ACCEPTANCE CRITERIA

All tests must PASS for system to be considered working:

- [ ] Backend endpoints all working
- [ ] Dashboard real-time updates working
- [ ] Operator messages reach users instantly
- [ ] User messages reach operators instantly
- [ ] Widget shows correct UX messages
- [ ] No token errors in Dashboard
- [ ] Socket.IO rooms working correctly
- [ ] operator_assigned event received by widget

---

## 📝 Test Results

**Tested by**: _________________
**Date**: _________________
**Overall Status**: ⬜ PASS / ⬜ FAIL
**Notes**:



