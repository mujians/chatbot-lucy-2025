# Nuovi Issues Identificati - 29 Ottobre 2025

## P11: 🔴 CRITICAL - Sessione Persistente Widget

### Problema
Quando utente chiude il widget (pulsante X), la sessione rimane salvata in `localStorage`.
Quando riapre il widget, torna sempre alla stessa chat con operatore, anche se la chat dovrebbe essere considerata "finita".

### Root Cause
```javascript
// snippets/chatbot-popup.liquid:900-903
function closePopup() {
  popup.classList.remove('show');
  isPopupOpen = false;
  // ❌ NON cancella sessionId dal localStorage!
}
```

### Fix Necessario
Quando operatore chiude chat, cancellare sessionId dal localStorage nel widget.

**Opzioni**:
1. **Opzione A**: Clear session quando operatore chiude chat (backend emette `chat_closed`)
2. **Opzione B**: Aggiungere pulsante "Nuova Chat" nel widget
3. **Opzione C**: Clear session dopo X minuti di inattività

---

## P12: 🔴 CRITICAL - Dashboard Non Si Aggiorna in Real-time

### Problema
Dashboard ChatWindow non riceve messaggi utente in real-time.
L'operatore deve refresh manuale per vedere nuovi messaggi.

### Root Cause

**Backend emette** (chat.controller.js:128):
```javascript
io.to(`operator_${session.operatorId}`).emit('user_message', {
  sessionId: sessionId,
  userName: session.userName,
  message: userMessage,
});
```

**ChatWindow ascolta** (ChatWindow.jsx:48):
```javascript
newSocket.on('new_message', (message) => {
  if (message.sessionId === chat.id) {
    setMessages((prev) => [...prev, message]);
  }
});
```

❌ **Mismatch**: Backend emette `user_message`, ChatWindow ascolta `new_message`!

### Fix Necessario
ChatWindow.jsx deve ascoltare `user_message` invece di `new_message`:
```javascript
newSocket.on('user_message', (data) => {
  if (data.sessionId === chat.id) {
    setMessages((prev) => [...prev, data.message]);
  }
});
```

---

## P13: 🟡 MEDIUM - Mancano Notifiche Badge

### Problema
Dashboard non mostra notifiche visive per:
- Nuove chat in arrivo
- Nuovi messaggi nelle chat assegnate all'operatore

### Expected Behavior
1. **Badge su Menu Chat**: Mostra numero di chat WAITING non lette
2. **Badge su Chat Item**: Mostra numero messaggi non letti per quella chat
3. **Sound Notification** (opzionale): Suono quando arriva nuovo messaggio

### Dove Implementare

**ChatList.jsx**:
- Aggiungere state per unread counts
- Badge rosso su "Chat Attive" header con totale WAITING
- Badge su ogni chat item con messaggi non letti

**ChatWindow.jsx**:
- Quando operatore apre chat, marcare messaggi come letti
- Emettere evento al backend `mark_messages_read`

**Backend**:
- Tracciare quali messaggi sono stati letti
- Aggiungere campo `unreadCount` nelle chat sessions
- Endpoint GET `/api/chat/unread-count`

---

## Priorità Fix

1. **P12 (Dashboard real-time)** - CRITICAL, blocca comunicazione
2. **P11 (Sessione persistente)** - HIGH, confonde utenti
3. **P13 (Notifiche badge)** - MEDIUM, migliora UX

