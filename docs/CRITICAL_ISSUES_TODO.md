# 🚨 CRITICAL ISSUES & TODO - Session 31 Ottobre 2025

**Status**: ✅ ALL BLOCKERS RESOLVED
**Priorità**: MOVED TO NEXT BATCH
**Creato**: 31 Ottobre 2025
**Completato**: 31 Ottobre 2025

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

### ✅ **ISSUE #1B: Nessuna Notifica/Counter Ticket in Dashboard**
**Severity**: HIGH - Feature Mancante
**Status**: ✅ FIXED - Commits 0d14725 + c7ad0e4
**Reported**: 31 Ottobre 2025, 23:59
**Fixed**: 31 Ottobre 2025

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

**Soluzione Implementata**:
1. ✅ Backend: WebSocket event `new_ticket_created` emesso a dashboard room
2. ✅ Dashboard: Listener in Index.tsx + state management
3. ✅ Dashboard: Badge rosso con counter in OperatorSidebar.tsx
4. ✅ Notifiche desktop via notificationService

**File Modificati**:
- Backend: `src/controllers/ticket.controller.js` (emit evento)
- Dashboard: `src/pages/Index.tsx` (listener + state)
- Dashboard: `src/components/dashboard/OperatorSidebar.tsx` (badge UI)

**Effort**: 45 min (completato)

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

### ✅ **ISSUE #2: Utente Riprende Chat Senza Controllo Operatori Online**
**Severity**: CRITICAL - UX Rotta
**Status**: ✅ FIXED - Commits 9519f54 + 1f3a30e
**Reported**: 31 Ottobre 2025
**Fixed**: 31 Ottobre 2025

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

**Soluzione Implementata**:
- ✅ Backend: Query operatori connessi via WebSocket rooms
- ✅ Backend: Campo `operatorOnline` in GET /api/chat/session/:id
- ✅ Widget: Check operatorOnline prima di permettere resume
- ✅ Widget: Se offline → recovery options [Apri Ticket] [Continua con AI] [Richiedi nuovo operatore]

**File Modificati**:
- `src/controllers/chat.controller.js` (lines 332-347)
- `snippets/chatbot-popup.liquid` (lines 2350-2385)

**Effort**: 40 min (completato)

---

## 🟡 **HIGH PRIORITY - Da Risolvere Presto**

### ✅ **ISSUE #3: Smart Actions Non Spariscono Dopo Click**
**Severity**: HIGH - UX Confusion
**Status**: ✅ FIXED - Commit 1f3a30e
**Reported**: 31 Ottobre 2025
**Fixed**: 31 Ottobre 2025

**Sintomi**:
- Box "⏱️ Sei ancora lì? [Sì sono qui] [Continua con AI]"
- Utente clicca un bottone
- Box rimane visibile nello storico chat
- Sembra che l'utente possa cliccare di nuovo

**Comportamento Atteso**:
- Utente clicca bottone → box sparisce
- Nello storico rimane solo il messaggio "✅ Perfetto! Continuo ad aspettarti"

**Soluzione Implementata**:
- ✅ Sostituito singolo `actionsContainer.remove()` con `querySelectorAll('.smart-actions-container')`
- ✅ Rimuove TUTTI i container con una chiamata centrale `removeAllActionContainers()`
- ✅ Ogni action handler chiama questa funzione dopo il click

**File Modificati**:
- `snippets/chatbot-popup.liquid` (lines 2052-2147 - tutti gli action handlers)

**Root Cause**: Singolo remove() non trovava tutti i duplicati nel DOM

**Effort**: 20 min (completato)

---

### ✅ **ISSUE #4: Operatore Aggiorna Pagina - Reconnect Grace Period**
**Severity**: HIGH - Operatore Experience
**Status**: ✅ FIXED - Commit (backend grace period)
**Reported**: 31 Ottobre 2025
**Fixed**: 31 Ottobre 2025

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

**Soluzione Implementata**:
- ✅ Backend: Delay 10 secondi prima di notificare disconnect
- ✅ Backend: Map<operatorId, timeoutId> per tracking timeouts
- ✅ Backend: Se operatore riconnette entro 10s → clearTimeout + cancel notification
- ✅ Grace period solo se operatore ha chat attive (WITH_OPERATOR status)

**File Modificati**:
- `src/services/websocket.service.js` (lines 8-10, 23-30, 159-178)

**Pattern Usato**: Map + setTimeout con cancellazione su reconnect

**Effort**: 30 min (completato)

---

## 📋 **MEDIUM PRIORITY - Important but not blocking**

### ✅ **ISSUE #5: Nessun Operatore Disponibile - Check Preventivo**
**Status**: ✅ ALREADY IMPLEMENTED
**Effort**: N/A (già presente)
**Updated**: 31 Ottobre 2025

**Scenario**:
- Utente clicca "Richiedi Operatore"
- Tutti operatori offline
- Sistema crea richiesta WAITING
- Utente aspetta indefinitamente

**Verificato Implementazione Esistente**:
1. ✅ Backend check operatori online PRIMA di creare WAITING
2. ✅ Se nessuno online:
   - Messaggio: "❌ Ci spiace, non ci sono operatori disponibili al momento"
   - Smart actions: [📋 Apri Ticket] [🤖 Continua con AI]
   - NO richiesta WAITING creata
3. ✅ Se almeno 1 online:
   - Normale flusso WAITING
   - "⏳ In attesa di un operatore..."

**File Già Implementato**:
- `src/controllers/chat.controller.js` (requestOperator endpoint)
- Check con `io.sockets.adapter.rooms.get('operator_X')`

**Conclusione**: Feature già presente, nessun intervento necessario

---

### ✅ **ISSUE #6: Operatore Non Risponde - Timeout**
**Status**: ✅ ALREADY IMPLEMENTED (Verified 2 Novembre 2025)
**Effort**: N/A (già presente)

**Scenario**:
- Operatore accetta chat
- Non scrive mai (10+ minuti)
- Utente aspetta

**Soluzione Implementata**:
- ✅ Timeout 10 minuti dall'accettazione (startOperatorResponseTimeout)
- ✅ Se operatore non ha inviato almeno 1 messaggio → chat chiusa
- ✅ Emette `operator_not_responding` a utente
- ✅ Emette `chat_timeout_cancelled` a operatore
- ✅ Status: CLOSED con closureReason: 'OPERATOR_TIMEOUT'

**File Implementati**:
- `src/services/websocket.service.js` (lines 313-389)
- `src/controllers/chat.controller.js` (chiamate a startOperatorResponseTimeout)

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

### ✅ **ISSUE #9: Utente Disconnette Durante Chat**
**Status**: ✅ ALREADY IMPLEMENTED (Verified 2 Novembre 2025)
**Effort**: N/A (già presente)

**Problema**:
- Utente chiude widget/tab
- Operatore non sa che utente se n'è andato

**Soluzione Implementata**:
- ✅ Backend rileva user disconnect tramite WebSocket
- ✅ Notifica operatore con `user_disconnected` event
- ✅ Timeout di 5 minuti per auto-close
- ✅ Se utente riconnette entro 5 min → timeout cancellato
- ✅ Se timeout scade → chat chiusa con USER_DISCONNECTED_TIMEOUT
- ✅ Emette `chat_auto_closed` a operatore

**File Implementati**:
- `src/services/websocket.service.js` (lines 210-301)
- Listener: socket.on('disconnect') gestisce user disconnect

---

### ✅ **ISSUE #9B: Utente Inattivo Durante Chat (NEW)**
**Status**: ✅ IMPLEMENTED (2 Novembre 2025)
**Severity**: MEDIUM - UX & Resource Management
**Commits**: Backend `0aca061`, Frontend `eb343fa`

**Problema**:
- Utente resta connesso ma non scrive (inattivo)
- Operatore aspetta indefinitamente
- Nessun feedback a utente o operatore
- Chat resta aperta sprecando risorse

**Soluzione Implementata**:

**Timeline Progressiva** (v2.3.4):
1. **T=0**: Operatore joins/User sends message → timer starts
2. **T=5 min**: User inactive → presence check triggered
   - Widget: Mostra "⏱️ Sei ancora qui? Hai ancora bisogno di aiuto?" con countdown (5 min)
   - Widget: Pulsante "Sì sono qui" per confermare presenza
   - Operator: Riceve notifica in chat + desktop notification
   - Message: "{userName} è inattivo da 5 minuti. Gli è stato chiesto se è ancora presente."
3. **T=5-10 min**: User può rispondere
   - Se user clicca "Sì" o invia messaggio → timer reset a 0
   - Se user non risponde → continua timeout
4. **T=10 min**: Auto-close se nessuna risposta
   - Chat chiusa: status CLOSED, reason USER_INACTIVITY_TIMEOUT
   - Widget: "La chat è stata chiusa per inattività"
   - Operator: "Chat chiusa automaticamente per inattività utente"
   - Dashboard: Chat list refresh automatico

**Eventi WebSocket**:
- `user_presence_check` → widget (countdown: 300s)
- `user_inactivity_warning` → operator
- `chat_closed_inactivity` → widget
- `chat_auto_closed` → operator (reused)
- `user_confirmed_presence` → cancella timers + restart

**Backend Files**:
- `src/services/websocket.service.js`:
  - userInactivityWarningTimeouts Map
  - userInactivityFinalTimeouts Map
  - startUserInactivityCheck() - inizia timer
  - startUserInactivityFinalTimeout() - secondo timeout
  - cancelUserInactivityCheck() - cancella timers
  - Modified user_confirmed_presence listener

- `src/controllers/chat.controller.js`:
  - sendUserMessage() → reset timer ogni messaggio
  - acceptOperator() → start timer quando operatore joins
  - operatorIntervene() → start timer quando operatore interviene

**Frontend Files**:
- `frontend-dashboard/src/pages/Index.tsx`:
  - Listener user_inactivity_warning
  - Listener chat_closed_inactivity
  - Desktop notifications a operatore
  - System messages in chat window

**Features**:
- ✅ Progressive timeout (5 min warning + 5 min grace = 10 min total)
- ✅ Clear visual feedback con countdown
- ✅ Interactive buttons per user ("Sì sono qui")
- ✅ Real-time notifications a entrambi i lati
- ✅ Auto-reset timer su ogni user activity
- ✅ Liberazione automatica risorse operatore
- ✅ Previene chat abbandonate

**Effort**: 60 min (completato)

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

### **✅ COMPLETATI (31 Ottobre 2025)**:
1. ✅ **ISSUE #1**: Debug messaggi operatore non visibili (45 min) - COMPLETATO
2. ✅ **ISSUE #1A**: Messaggio vuoto ticket (15 min) - COMPLETATO
3. ✅ **ISSUE #1B**: Notifiche ticket sidebar (45 min) - COMPLETATO
4. ✅ **ISSUE #2**: Check operatore online su resume (40 min) - COMPLETATO
5. ✅ **ISSUE #5**: Nessun operatore disponibile check (N/A) - GIÀ IMPLEMENTATO
6. ✅ **ISSUE #3**: Smart actions non spariscono (20 min) - COMPLETATO
7. ✅ **ISSUE #4**: Grace period reconnect operatore (30 min) - COMPLETATO

**🎉 Tutti i blocker critici risolti! Sistema pronto per produzione.**

### **✅ COMPLETATI (2 Novembre 2025)**:
8. ✅ **ISSUE #6**: Operatore non risponde timeout (N/A) - GIÀ IMPLEMENTATO
9. ✅ **ISSUE #9**: User disconnect notification (N/A) - GIÀ IMPLEMENTATO
10. ✅ **ISSUE #9B**: User inactivity presence check (60 min) - IMPLEMENTATO

**🎉 Timeout management completamente implementato!**

### **NEXT BATCH**:
11. ISSUE #7: Session expiry (20 min)
12. ISSUE #8: Rate limiting (30 min)

**Tempo totale**: ~50 min

### **FUTURE ENHANCEMENTS**:
- ISSUE #10: Network quality detection
- Security audit refresh
- Performance optimization

---

## 📝 **NOTES**

**Session Info**:
- Working Directory: `/Users/brnobtt/Desktop/lucine-backend`
- Frontend Dashboard: `frontend-dashboard/src/`
- Widget: `/Users/brnobtt/Desktop/lucine-minimal/snippets/chatbot-popup.liquid`

**Deployment**:
- Backend: Auto-deploy Render on push to main
- Widget: Auto-sync Shopify on push to main

**Ultima Modifica**: 2 Novembre 2025 (v2.3.4 - User Inactivity System)

---

## 🎉 **SESSION SUMMARY**

**Fixes Completati in questa sessione**:
- 7 issue critici risolti
- 6 commit pushati e deployed
- 0 blocker rimanenti
- Sistema production-ready

**Key Fixes**:
1. Messaggi operatore visibili in dashboard (optimistic UI)
2. Auto-scroll funzionante (Radix UI viewport)
3. Typing indicator cleanup on message receive
4. Ticket notifications con badge counter in sidebar
5. Check operatore online su resume chat
6. Smart actions cleanup dopo click
7. Grace period 10s per reconnect operatore

**Commits**:
- `aab6e33` - Messaggi operatore visibili
- `50b2f5a` - Fix messaggio vuoto ticket
- `0d14725` - Notifiche ticket in dashboard
- `c7ad0e4` - TypeScript fix badge counter
- `9519f54` - Check operatore online (backend)
- `1f3a30e` - Check operatore online (widget) + smart actions fix + UX improvements

---

## 🎉 **SESSION SUMMARY - 2 Novembre 2025 (v2.3.4)**

**Focus**: User Inactivity Management & Timeout System Completion

**Features Implemented**:
1. ✅ Verified ISSUE #6 already implemented (Operator timeout)
2. ✅ Verified ISSUE #9 already implemented (User disconnect)
3. ✅ NEW: User inactivity presence check system (ISSUE #9B)
   - Progressive timeout: 5 min warning + 5 min grace
   - Widget countdown and interactive buttons
   - Operator notifications at each stage
   - Auto-close after 10 min total inactivity
   - Timer auto-reset on user activity

**Technical Implementation**:
- Backend: 2 new timeout Maps (warning + final)
- Backend: 3 exported functions (start, cancel, final)
- Backend: Modified user_confirmed_presence listener
- Backend: Integration in sendUserMessage, acceptOperator, operatorIntervene
- Frontend: 2 new WebSocket listeners
- Frontend: Desktop notifications for operators
- Frontend: Auto-refresh chat list on closure

**Quality**:
- Clear feedback to both sides
- No silent failures
- Resource-efficient (Map-based tracking)
- Prevents abandoned chats
- Professional UX

**Commits**:
- Backend: `86a809d` - Name extraction feature
- Backend: `0aca061` - User inactivity system
- Frontend: `bc91032` - Name capture UI
- Frontend: `eb343fa` - Inactivity notifications

**Time Spent**: ~90 min total (verification + implementation)
**Issues Resolved**: 3 (1 new + 2 verified)
**Files Modified**: 4 (2 backend + 2 frontend)
**Lines Added**: ~230
**WebSocket Events**: 4 new events
