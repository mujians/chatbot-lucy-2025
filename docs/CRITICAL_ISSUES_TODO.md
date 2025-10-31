# 🚨 CRITICAL ISSUES & TODO - Session 31 Ottobre 2025

**Status**: IN PROGRESS
**Priorità**: BLOCKING PRODUCTION
**Creato**: 31 Ottobre 2025

---

## 🔴 **BLOCKERS - Da Risolvere IMMEDIATAMENTE**

### ✅ **ISSUE #1A: Messaggio Vuoto Dopo Creazione Ticket**
**Severity**: HIGH - UX Bug Visibile
**Status**: ✅ FIXED - Commit 50b2f5a
**Reported**: 31 Ottobre 2025, 23:59
**Fixed**: 1 Novembre 2025, 00:05

**Sintomi**:
- Utente compila form ticket e clicca "Invia"
- Appare un messaggio vuoto (balloon/bubble vuota)
- Poi appare "✅ Ticket creato! Ti ricontatteremo al più presto"
- Il balloon vuoto rimane visibile nello storico

**Probabile Causa**:
- `addMessage()` chiamato con contenuto vuoto o undefined
- Due chiamate addMessage() successive
- Form ticket rimosso ma lascia elemento DOM vuoto

**File Coinvolti**:
- `snippets/chatbot-popup.liquid` (submitTicket function, showTicketForm)
- Lines ~2477-2520 circa

**Debug Necessario**:
- [ ] Verificare submitTicket() - quanti addMessage() chiamati?
- [ ] Verificare se form viene rimosso correttamente
- [ ] Verificare parametri addMessage()

**Soluzione Implementata**:
- Usa closest('.chat-message') per trovare parent container
- Rimuove intero container messaggio, non solo form
- Poi aggiunge messaggio di successo
- Nessun balloon vuoto rimane

**Effort**: 15 min

---

### ❌ **ISSUE #1B: Nessuna Notifica/Counter Ticket in Dashboard**
**Severity**: HIGH - Feature Mancante
**Status**: 🔴 OPEN
**Reported**: 31 Ottobre 2025, 23:59

**Sintomi**:
- Nuovo ticket creato da utente
- Dashboard sidebar NON mostra notifica
- Nessun counter/badge numerico
- Operatore non sa che c'è un nuovo ticket

**Comportamento Atteso**:
```
Sidebar Menu:
📊 Dashboard
💬 Chat (2)  ← counter chat attive
📋 Ticket (3) ← MANCA questo counter! 🔴
👤 Operatori
⚙️ Settings
```

**Soluzione Necessaria**:
1. Backend: WebSocket event `new_ticket` → emette a dashboard room
2. Backend: API GET /api/tickets/count → ritorna unread count
3. Dashboard: Listener WebSocket + update badge
4. Dashboard: Badge rosso con numero tickets pending

**File Coinvolti**:
- Backend: `src/services/websocket.service.js`
- Backend: `src/controllers/ticket.controller.js`
- Dashboard: Sidebar component (trovare quale)
- Dashboard: WebSocket setup

**Effort**: 45 min

---

### ✅ **ISSUE #1: Messaggi Operatore NON Visibili in Dashboard**
**Severity**: CRITICAL - Sistema inutilizzabile
**Status**: ✅ FIXED - Commit aab6e33
**Reported**: Operatore non vede i propri messaggi dopo invio
**Fixed**: 31 Ottobre 2025, 23:55

**Sintomi**:
- Operatore invia messaggio
- Messaggio appare nel widget utente ✅
- Messaggio NON appare nella dashboard operatore ❌
- Auto-scroll NON funziona ❌

**File Coinvolti**:
- `frontend-dashboard/src/components/ChatWindow.jsx`
- `src/controllers/chat.controller.js` (sendOperatorMessage)
- `src/services/websocket.service.js`

**Fix Tentati**:
1. Rimossa aggiunta locale (line 184-185 ChatWindow.jsx)
2. Cambiato scroll a scrollTop (lines 224-234)
3. Emissione solo a chat room (chat.controller.js:814-819)

**Problema**: Fix non funziona ancora

**Debug Necessario**:
- [ ] Verificare se WebSocket emette correttamente
- [ ] Verificare se dashboard riceve evento operator_message
- [ ] Verificare se setMessages aggiorna state
- [ ] Verificare se useEffect scroll viene triggerato
- [ ] Console.log completo flusso messaggio

**Soluzione Implementata**:
- Ripristinata aggiunta locale (optimistic UI)
- Aggiunto filtro operatorId nel listener WebSocket
- Messaggi propri aggiunti localmente, altri via WebSocket

**Effort**: 45 min

---

### ❌ **ISSUE #2: Utente Riprende Chat Senza Controllo Operatori Online**
**Severity**: CRITICAL - UX Rotta
**Status**: 🔴 OPEN
**Reported**: 31 Ottobre 2025

**Sintomi**:
- Utente ha sessionId salvato con status WITH_OPERATOR
- Utente riapre widget e clicca "Riprendi chat"
- Sistema passa in modalità operatore SENZA verificare se operatore ancora online
- Utente scrive messaggi nel vuoto (operatore offline/disconnesso)

**Flow Attuale (ROTTO)**:
```
1. validateRestoredSession() → trova WITH_OPERATOR
2. showResumePrompt() → mostra "Riprendi" / "Nuova"
3. User clicca "Riprendi"
4. resumeExistingChat() → isOperatorMode = true ❌ NO CHECK
5. User scrive → nessuno risponde
```

**Flow Corretto Necessario**:
```
1. validateRestoredSession() → trova WITH_OPERATOR
2. Backend check: operatore ancora connesso? ✅
3a. Se SÌ → showResumePrompt()
3b. Se NO → "Operatore non più disponibile" + [Ticket/AI/Nuova]
```

**File Coinvolti**:
- `snippets/chatbot-popup.liquid` (validateRestoredSession, resumeExistingChat)
- Backend: Endpoint GET /api/chat/session/:id → aggiungere campo `operatorOnline: boolean`

**Soluzione**:
- [ ] Backend: Query operatori connessi via WebSocket rooms
- [ ] Backend: Aggiungi campo `operatorOnline` in risposta session
- [ ] Widget: Check operatorOnline prima di permettere resume
- [ ] Widget: Se offline → mostra recovery options

**Effort**: 40 min

---

## 🟡 **HIGH PRIORITY - Da Risolvere Presto**

### ⚠️ **ISSUE #3: Smart Actions Non Spariscono Dopo Click**
**Severity**: HIGH - UX Confusion
**Status**: 🟡 OPEN
**Reported**: 31 Ottobre 2025

**Sintomi**:
- Box "⏱️ Sei ancora lì? [Sì sono qui] [Continua con AI]"
- Utente clicca un bottone
- Box rimane visibile nello storico chat
- Sembra che l'utente possa cliccare di nuovo

**Comportamento Atteso**:
- Utente clicca bottone → box sparisce
- Nello storico rimane solo il messaggio "✅ Perfetto! Continuo ad aspettarti"

**File Coinvolti**:
- `snippets/chatbot-popup.liquid` (showSmartActions, action handlers)
- Lines 2073-2129 (action handlers che chiamano `actionsContainer.remove()`)

**Problema**:
- `actionsContainer.remove()` viene chiamato ✅
- Ma forse il container non viene trovato/rimosso correttamente?

**Debug Necessario**:
- [ ] Verificare che actionsContainer.remove() funzioni
- [ ] Test con diverse azioni
- [ ] Verificare se ci sono duplicati container

**Effort**: 20 min

---

### ⚠️ **ISSUE #4: Operatore Aggiorna Pagina - Reconnect Grace Period**
**Severity**: HIGH - Operatore Experience
**Status**: 🟡 OPEN
**Reported**: 31 Ottobre 2025

**Scenario**:
- Operatore in chat attiva con utente
- Operatore fa refresh pagina (F5)
- Sistema rileva disconnect → notifica utente "Operatore disconnesso" ❌
- Operatore riconnette dopo 2 secondi
- Utente già spaventato inutilmente

**Comportamento Attuale**:
```
T=0: Operatore F5
T=0.1s: WebSocket disconnect → emit operator_disconnected
T=2s: Operatore riconnette
T=2.1s: Operatore rejoin room
```
❌ **Utente ha visto "Operatore disconnesso" inutilmente**

**Comportamento Desiderato**:
```
T=0: Operatore F5
T=0.1s: WebSocket disconnect → WAIT 10 secondi
T=2s: Operatore riconnette → NO notification sent
T=10s+: Se ancora offline → emit operator_disconnected
```

**Soluzione**:
- [ ] Backend: Delay 10-15 sec prima di notificare disconnect
- [ ] Backend: Se operatore riconnette entro 10s → cancel notification
- [ ] Implementare "grace period" con setTimeout

**File Coinvolti**:
- `src/services/websocket.service.js` (lines 123-161 disconnect handler)

**Effort**: 30 min

---

## 📋 **MEDIUM PRIORITY - Important but not blocking**

### 📌 **ISSUE #5: Nessun Operatore Disponibile - Check Preventivo**
**Status**: 🔴 TODO - PRIORITÀ ALTA
**Effort**: 30 min
**Updated**: 31 Ottobre 2025, 23:58

**Scenario**:
- Utente clicca "Richiedi Operatore"
- Tutti operatori offline
- Sistema crea richiesta WAITING
- Utente aspetta indefinitamente

**Osservazione Utente**:
> "quando il sistema intercetta una richiesta di operatore invece di dare le due possibilità
> (parla con un operatore o continua con AI) dovrebbe già dire: 'ci spiace non ci sono
> operatori online in questo momento, apri un ticket o continua con AI'"

**Soluzione Migliorata**:
1. Backend check operatori online PRIMA di creare WAITING
2. Se nessuno online:
   - Messaggio: "❌ Ci spiace, non ci sono operatori disponibili al momento"
   - Smart actions: [📋 Apri Ticket] [🤖 Continua con AI]
   - NO richiesta WAITING creata
3. Se almeno 1 online:
   - Normale flusso WAITING
   - "⏳ In attesa di un operatore..."

---

### 📌 **ISSUE #6: Operatore Non Risponde - Timeout**
**Status**: 🟢 TODO
**Effort**: 25 min

**Scenario**:
- Operatore accetta chat
- Non scrive mai (10+ minuti)
- Utente aspetta

**Soluzione**:
- Timeout 8-10 minuti dall'accettazione
- Se operatore non ha inviato almeno 1 messaggio → "Operatore non risponde" + recovery

---

### 📌 **ISSUE #7: Session Expiry**
**Status**: 🟢 TODO
**Effort**: 20 min

**Problema**:
- localStorage persiste forever
- SessionId vecchio di mesi ancora valido?

**Soluzione**:
- localStorage expiry: 7 giorni
- Backend valida session age

---

### 📌 **ISSUE #8: Rate Limiting / Spam Protection**
**Status**: 🟢 TODO
**Effort**: 30 min

**Problema**:
- Nessun limite messaggi
- Bot/utente frustrato può spammare

**Soluzione**:
- Backend: max 10 msg/min per session
- Warning: "Rallenta, per favore"

---

### 📌 **ISSUE #9: Utente Disconnette Durante Chat**
**Status**: 🟢 TODO
**Effort**: 20 min

**Problema**:
- Utente chiude widget/tab
- Operatore non sa che utente se n'è andato

**Soluzione**:
- Backend rileva user disconnect
- Notifica operatore "Utente disconnesso"

---

### 📌 **ISSUE #10: Network Quality - User Offline Detection**
**Status**: 🟢 TODO
**Effort**: 25 min

**Problema**:
- Utente perde WiFi
- Nessun feedback

**Soluzione**:
- Widget mostra "🔴 Offline"
- "🟡 Riconnessione in corso..."
- Coda messaggi localmente

---

## 🔒 **SECURITY - To Verify**

### 🔐 **SECURITY #1: XSS Protection**
- [ ] Verificare sanitization input messaggi
- [ ] Test con `<script>alert('xss')</script>`
- [ ] Verificare escaping HTML

### 🔐 **SECURITY #2: SessionId Validation**
- [ ] Backend valida sessionId + userId match
- [ ] Impossibile accedere chat altrui modificando localStorage

### 🔐 **SECURITY #3: Race Condition - Double Accept**
- [ ] Verificare transaction lock su acceptOperator
- [ ] Test con 2 operatori che accettano simultaneamente

---

## 📊 **PRIORITÀ ESECUZIONE**

### **OGGI (BLOCKING)** - Aggiornato 01/11/2025 00:05:
1. ✅ **ISSUE #1**: Debug messaggi operatore non visibili (45 min) - COMPLETATO
2. ✅ **ISSUE #1A**: Messaggio vuoto ticket (15 min) - COMPLETATO
3. 🔴 **ISSUE #1B**: Notifiche ticket sidebar (45 min) ← IN CORSO
4. 🔴 **ISSUE #2**: Check operatore online su resume (40 min)
5. 🔴 **ISSUE #5**: Nessun operatore disponibile check (30 min)
6. 🟡 **ISSUE #3**: Smart actions non spariscono (20 min)
7. 🟡 **ISSUE #4**: Grace period reconnect operatore (30 min)

**Tempo totale rimanente**: ~3 ore

### **NEXT BATCH**:
8. ISSUE #6: Operatore non risponde timeout (25 min)
9. ISSUE #9: User disconnect notification (20 min)
10. ISSUE #7: Session expiry (20 min)

**Tempo totale**: ~1.5 ore

### **SETTIMANA PROSSIMA**:
- ISSUE #8: Rate limiting
- ISSUE #10: Network quality
- Security checks

---

## 📝 **NOTES**

**Session Info**:
- Working Directory: `/Users/brnobtt/Desktop/lucine-backend`
- Frontend Dashboard: `frontend-dashboard/src/`
- Widget: `/Users/brnobtt/Desktop/lucine-minimal/snippets/chatbot-popup.liquid`

**Deployment**:
- Backend: Auto-deploy Render on push to main
- Widget: Auto-sync Shopify on push to main

**Ultima Modifica**: 31 Ottobre 2025, 23:45
