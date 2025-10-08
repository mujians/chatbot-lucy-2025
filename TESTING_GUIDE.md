# 🧪 Testing Guide - Lucine Chatbot

Guida completa per testare tutte le funzionalità implementate.

---

## 🚀 Setup Iniziale

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```

**Configura `.env`:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/lucine_chatbot"
JWT_SECRET="your-secret-key-change-in-production"
OPENAI_API_KEY="sk-your-openai-api-key"  # Optional per test
NODE_ENV="development"
PORT=3001
```

**Setup Database:**
```bash
# Crea database
createdb lucine_chatbot

# Installa pgvector
psql lucine_chatbot -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Migrations
npx prisma migrate dev --name init

# Seed data (admin + operator + KB items)
npm run seed

# Avvia server
npm run dev
```

### 2. Widget
```bash
cd frontend-widget
npm install
npm run dev
```

### 3. Dashboard
```bash
cd frontend-dashboard
npm install
npm run dev
```

---

## ✅ Test Scenari

### SCENARIO 1: Chat AI Successo ✅

**Obiettivo:** User chiede info, AI risponde dalla knowledge base

1. Apri widget: `http://localhost:5173`
2. Click bubble chat
3. Invia: "Dove parcheggiare?"
4. **Atteso:** AI risponde con info parcheggio P5

**Verifica Backend:**
```bash
# Check API logs
# Dovresti vedere:
# - POST /api/chat/session (create session)
# - POST /api/chat/session/:id/message (send message)
# - OpenAI API call
# - Knowledge base search
```

---

### SCENARIO 2: Richiesta Operatore (Online) ✅

**Obiettivo:** User richiede operatore, viene assegnato

**Setup:**
1. Login dashboard: `http://localhost:5174`
   - Email: `admin@lucine.it`
   - Password: `admin123`
2. Toggle availability → ONLINE (nella dashboard UI)

**Test Widget:**
1. Apri widget (nuova tab)
2. Invia: "Voglio parlare con un operatore"
3. AI risponde con bassa confidence
4. Click: "PARLA CON OPERATORE"
5. **Atteso:**
   - Sistema message: "Admin Lucine si è unito alla chat"
   - Header diventa verde: "CHAT CON ADMIN LUCINE"

**Test Real-time:**
1. Nella dashboard (TODO: UI needed)
2. **Dovresti vedere:** Notifica nuova chat
3. Apri chat
4. Invia messaggio da dashboard
5. **Atteso:** User vede messaggio real-time nel widget

---

### SCENARIO 3: Richiesta Operatore (Offline) → Ticket ✅

**Obiettivo:** Nessun operatore online, user crea ticket

**Setup:**
1. Assicurati che TUTTI gli operatori siano OFFLINE
2. Check: `GET http://localhost:3001/api/operators/online` → count: 0

**Test Widget:**
1. Apri widget
2. Invia: "Voglio parlare con un operatore"
3. Click: "PARLA CON OPERATORE"
4. **Atteso:** Form ticket appare

**Compila Form:**
- Nome: "Mario Rossi"
- Messaggio: "Info biglietti gruppo"
- Metodo: WhatsApp
- Numero: "+393331234567"
- Click: "INVIA RICHIESTA"

**Atteso:**
- ✅ Alert: "Richiesta inviata! Ti abbiamo inviato un messaggio WhatsApp"
- Widget si chiude dopo 3 secondi
- (Se Twilio configurato) WhatsApp inviato

**Verifica Database:**
```bash
# Check ticket creato
psql lucine_chatbot -c "SELECT * FROM \"Ticket\";"

# Dovresti vedere:
# - userName: Mario Rossi
# - contactMethod: WHATSAPP
# - whatsappNumber: +393331234567
# - status: PENDING
# - resumeToken: <uuid>
```

---

### SCENARIO 4: Resume Ticket da Link ✅

**Obiettivo:** User clicca link WhatsApp, riprende chat

**Get Resume Token:**
```bash
psql lucine_chatbot -c "SELECT resumeToken FROM \"Ticket\" LIMIT 1;"
```

**Test:**
1. Apri: `http://localhost:5173?token=<resumeToken>`
2. **Atteso:**
   - Chat history caricata
   - Widget mostra messaggi precedenti
   - User può continuare conversazione

**Test API:**
```bash
curl http://localhost:3001/api/tickets/resume/<resumeToken>
```

---

### SCENARIO 5: Test Authentication ✅

**Test Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@lucine.it",
    "password": "admin123"
  }'
```

**Atteso:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "operator": {
      "id": "...",
      "email": "admin@lucine.it",
      "name": "Admin Lucine",
      "role": "ADMIN"
    }
  }
}
```

**Test Protected Route:**
```bash
TOKEN="<your-token>"

curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### SCENARIO 6: Test Knowledge Base CRUD ✅

**List KB Items:**
```bash
curl http://localhost:3001/api/knowledge \
  -H "Authorization: Bearer $TOKEN"
```

**Create KB Item:**
```bash
curl -X POST http://localhost:3001/api/knowledge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "question": "Quanto costa il biglietto?",
    "answer": "Il biglietto costa €15 per adulti e €8 per bambini.",
    "category": "BIGLIETTI"
  }'
```

**Update KB Item:**
```bash
curl -X PUT http://localhost:3001/api/knowledge/<itemId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "answer": "NUOVO: Il biglietto costa €12 per adulti."
  }'
```

**Delete KB Item:**
```bash
curl -X DELETE http://localhost:3001/api/knowledge/<itemId> \
  -H "Authorization: Bearer $TOKEN"
```

---

### SCENARIO 7: Test Ticket Management ✅

**List Tickets:**
```bash
curl http://localhost:3001/api/tickets \
  -H "Authorization: Bearer $TOKEN"
```

**Assign Ticket to Me:**
```bash
curl -X POST http://localhost:3001/api/tickets/<ticketId>/assign \
  -H "Authorization: Bearer $TOKEN"
```

**Resolve Ticket:**
```bash
curl -X POST http://localhost:3001/api/tickets/<ticketId>/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "resolutionNotes": "Problema risolto via email"
  }'
```

---

### SCENARIO 8: Test WebSocket Real-time ✅

**Setup:**
1. Apri Developer Tools → Console
2. Nel widget, apri chat

**Test User → Operator:**
```javascript
// In widget console
socket.emit('user_message', {
  sessionId: '<your-session-id>',
  message: 'Test message from user'
});
```

**Test Operator → User:**
```javascript
// In dashboard console (TODO: implement)
socket.emit('operator_message', {
  sessionId: '<session-id>',
  message: 'Test response from operator',
  operatorId: '<operator-id>'
});
```

---

## 🐛 Debug Checklist

### Backend Not Starting
- [ ] PostgreSQL running? (`pg_isready`)
- [ ] Database exists? (`psql -l | grep lucine`)
- [ ] .env configured correctly?
- [ ] Prisma migrated? (`npx prisma migrate status`)
- [ ] Port 3001 free? (`lsof -i :3001`)

### Widget Not Connecting
- [ ] Backend running on 3001?
- [ ] CORS configured? (check backend logs)
- [ ] WebSocket proxy working? (check Vite config)
- [ ] Browser console errors?

### OpenAI Not Working
- [ ] OPENAI_API_KEY valid?
- [ ] API credits available?
- [ ] Check backend logs for API errors
- **Fallback:** AI returns error message, suggests operator

### Twilio Not Sending
- [ ] TWILIO_ACCOUNT_SID configured?
- [ ] TWILIO_AUTH_TOKEN configured?
- [ ] Phone number verified?
- **For testing:** Check console logs, notification service logs

---

## 📊 Expected Logs

### Successful Chat Flow
```
✅ Client connected: abc123
👤 User joined chat: session-uuid-1
📤 User message sent
🤖 OpenAI API call successful
📥 AI response generated (confidence: 0.85)
```

### Operator Assignment
```
👨‍💼 Operator admin-uuid joined dashboard
📨 New chat request assigned
🟢 Operator online status broadcast
```

### Ticket Creation
```
🎫 Ticket created: ticket-uuid-1
📱 WhatsApp notification sent (SID: SM...)
📧 Email notification sent
```

---

## 🎯 Performance Benchmarks

### API Response Times (Expected)
- `POST /api/auth/login`: < 200ms
- `GET /api/chat/session/:id`: < 100ms
- `POST /api/chat/session/:id/message` (with AI): < 2s
- `POST /api/tickets`: < 300ms
- `GET /api/knowledge`: < 150ms

### WebSocket Latency
- Message delivery: < 100ms
- Operator assignment: < 200ms

---

## ✅ Test Completion Checklist

### Backend API
- [ ] Health check works
- [ ] Login successful
- [ ] Protected routes require token
- [ ] Chat session creation
- [ ] AI message response
- [ ] Operator assignment
- [ ] Ticket creation
- [ ] Ticket resume
- [ ] Knowledge base CRUD
- [ ] WebSocket connection

### Widget
- [ ] Chat opens/closes
- [ ] Welcome message shown
- [ ] Send user message
- [ ] Receive AI response
- [ ] Smart actions appear (low confidence)
- [ ] Request operator works
- [ ] Ticket form submission
- [ ] Session persistence (refresh page)
- [ ] Resume from token URL

### Dashboard (Partial)
- [ ] Login works
- [ ] Dashboard loads
- [ ] Toggle availability (API call)
- [ ] Stats display (mock data)

---

## 🚨 Known Limitations (Current Build)

1. **pgvector embeddings:** Not fully active (uses text search fallback)
2. **Dashboard UI:** Only login + layout (chat/ticket UI needed)
3. **Twilio:** Requires valid account (falls back to console logs)
4. **OpenAI:** Requires valid API key (falls back to error message)

---

## 📞 Support

Se qualcosa non funziona:

1. **Check logs** in tutti i 3 terminali (backend, widget, dashboard)
2. **Check database** con Prisma Studio: `npx prisma studio`
3. **Check API** con curl/Postman
4. **Check browser console** per errori frontend

---

**Happy Testing! 🎄✨**
