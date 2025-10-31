# 🎯 UX FIXES TODO - Widget Improvements

**Created**: 31 Ottobre 2025, 17:00
**Priority**: HIGH - User Experience Issues
**Status**: IN PROGRESS

---

## 🔴 **ISSUE #1: "Apri Ticket" non serve dopo chat_closed**

**File**: `lucine-minimal/snippets/chatbot-popup.liquid`
**Lines**: 2695-2702

**Problema**:
- Quando operatore chiude la chat, widget mostra 3 opzioni:
  - 📋 Apri Ticket ❌ NON SERVE
  - 💬 Nuova Chat ✅ OK
  - ⭐ Valuta ✅ OK

**Motivazione**:
- L'operatore ha già gestito la richiesta
- Se serve follow-up, l'operatore dovrebbe chiedere contatti prima di chiudere
- Mostrare "Apri Ticket" confonde l'utente ("ma non ho appena parlato con qualcuno?")

**Soluzione**:
```javascript
// RIMUOVI questo blocco (lines 2695-2702):
{
  icon: '📋',
  text: 'Apri Ticket',
  description: 'Lascia i tuoi contatti',
  type: 'primary',
  action: 'request_ticket'
},

// MANTIENI solo:
{
  icon: '💬',
  text: 'Nuova Chat',
  description: 'Inizia una nuova conversazione',
  type: 'secondary',
  action: 'start_fresh_chat'
},
{
  icon: '⭐',
  text: 'Valuta',
  description: 'Valuta la tua esperienza',
  type: 'secondary',
  action: 'show_rating',
  data: { sessionId: closedSessionId }
}
```

**Effort**: 5 min

---

## 🔴 **ISSUE #2: Form ticket senza pulsante Annulla/Indietro**

**File**: `lucine-minimal/snippets/chatbot-popup.liquid`
**Lines**: 2458-2475 (showTicketForm function)

**Problema**:
- Utente clicca "Apri Ticket" per sbaglio
- Form appare nella chat
- NON c'è modo di annullare/tornare indietro
- Unica opzione: compilare o ricaricare pagina

**Soluzione**:
Aggiungere pulsante "❌ Annulla" accanto a "📨 Invia messaggio"

```javascript
// Line 2465, SOSTITUISCI:
<button onclick="submitTicket()" style="...">📨 Invia messaggio</button>

// CON:
<div style="display: flex; gap: 10px;">
  <button onclick="cancelTicketForm()" style="background: #6b7280; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: bold; flex: 1;">❌ Annulla</button>
  <button onclick="submitTicket()" style="background: #dc2626; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: bold; flex: 1;">📨 Invia messaggio</button>
</div>
```

**Nuova funzione da aggiungere** (dopo line 2475):
```javascript
// Cancel ticket form
window.cancelTicketForm = function() {
  const form = document.querySelector('.ticket-form');
  if (form) {
    const messageContainer = form.closest('.chat-message');
    if (messageContainer) {
      messageContainer.remove();
    }
  }
  // Re-enable input if we're in AI mode
  if (!isOperatorMode) {
    setInputState(true);
    input.placeholder = 'Scrivi un messaggio...';
  }
  addMessage('Operazione annullata. Posso aiutarti con qualcos\'altro?', 'bot');
};
```

**Effort**: 10 min

---

## 🟡 **ISSUE #3: Utente può chiudere/cancellare sessione?**

**Status**: 🔍 NEEDS CLARIFICATION

**Domanda**: L'utente dovrebbe poter:
- ❌ Chiudere definitivamente la chat (solo operatore può)
- ❌ Cancellare la sessione manualmente
- ✅ Iniziare nuova chat (pulisce UI ma non cancella dal DB)

**Verifica Necessaria**:
- [ ] Controllare se esiste bottone/link "Chiudi" o "Cancella" visibile all'utente
- [ ] Verificare se `start_fresh_chat` permette accessi non autorizzati

**Flussi Corretti**:
1. **Chat con operatore**: Solo operatore può chiudere (evento `chat_closed`)
2. **Chat AI → Nuova chat**: Utente può fare `start_fresh_chat` (pulisce UI)
3. **Cancellazione sessione DB**: Solo automatica (session expiry 7 giorni)

**File da Verificare**:
- `chatbot-popup.liquid` - Lines 2105-2120 (start_fresh_chat handler)
- Widget header - Verificare se c'è pulsante "X" che cancella sessione

**Effort**: 15 min (indagine + eventuale fix)

---

## 📋 **ALTRI PROBLEMI UX DA CONSIDERARE**

### 🟢 **ISSUE #4: "Apri Ticket" da operator_disconnected**

**File**: `chatbot-popup.liquid`
**Lines**: ~2745-2770 (operator_disconnected recovery options)

**Problema**: Mostra "Apri Ticket" quando operatore disconnette.
**Da valutare**: Ha senso qui? Operatore potrebbe riconnettersi...

**Smart actions attuali**:
```javascript
{
  icon: '📋',
  text: 'Apri Ticket',  // ❓ Mantieni o rimuovi?
  description: 'Lascia i tuoi contatti',
  type: 'primary',
  action: 'request_ticket'
},
{
  icon: '🤖',
  text: 'Continua con AI',
  description: 'Prova l\'assistente automatico',
  type: 'secondary',
  action: 'start_fresh_chat'
},
{
  icon: '⭐',
  text: 'Valuta',
  description: 'Valuta la tua esperienza',
  type: 'secondary',
  action: 'show_rating',
  data: { sessionId: sessionId }
}
```

**Opzioni**:
- A) **Rimuovi "Apri Ticket"** - utente può continuare con AI
- B) **Mantieni "Apri Ticket"** - se operatore offline, ha senso lasciare contatti

**Decisione richiesta da utente** ⚠️

---

### 🟢 **ISSUE #5: Form ticket validazione email debole**

**File**: `chatbot-popup.liquid`
**Lines**: 2483-2486

**Problema**:
```javascript
if (!name || !email || !message) {
  alert('Compila tutti i campi');
  return;
}
```

Nessuna validazione formato email!

**Soluzione**:
```javascript
if (!name || !email || !message) {
  alert('Compila tutti i campi');
  return;
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  alert('Inserisci un indirizzo email valido');
  return;
}
```

**Effort**: 5 min

---

### 🟢 **ISSUE #6: Smart actions non spariscono dopo click**

**Status**: GIÀ DOCUMENTATO in CRITICAL_ISSUES_TODO.md (ISSUE #3)
**Lines**: 2073-2129
**Effort**: 20 min (già schedulato)

---

## 📊 **SUMMARY**

| Issue | Priority | Effort | Status |
|-------|----------|--------|--------|
| #1: Remove "Apri Ticket" after chat_closed | 🔴 HIGH | 5 min | READY |
| #2: Add cancel button to ticket form | 🔴 HIGH | 10 min | READY |
| #3: User shouldn't close/delete session | 🟡 MEDIUM | 15 min | NEEDS INVESTIGATION |
| #4: "Apri Ticket" on operator_disconnected | 🟢 LOW | 5 min | NEEDS DECISION |
| #5: Email validation in ticket form | 🟢 LOW | 5 min | READY |
| #6: Smart actions don't disappear | 🟡 HIGH | 20 min | ALREADY TRACKED |

**Total effort for #1 + #2 + #5**: ~20 min
**Total effort with #3**: ~35 min

---

## 🚀 **EXECUTION PLAN**

### Phase 1 (NOW - 20 min):
1. ✅ Fix #1: Remove "Apri Ticket" from chat_closed
2. ✅ Fix #2: Add cancel button to ticket form
3. ✅ Fix #5: Add email validation

### Phase 2 (After user decision):
4. 🔍 Investigate #3: User session control
5. ❓ Decide #4: Keep/remove "Apri Ticket" on disconnect

### Phase 3 (Already scheduled):
6. Fix #6: Smart actions persistence (from CRITICAL_ISSUES_TODO.md)

---

**Next Action**: Start Phase 1 fixes immediately ✅
