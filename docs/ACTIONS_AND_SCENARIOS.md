# Azioni Utente/Operatore e Scenari d'Uso Reali

**Data**: 29 Ottobre 2025
**Status**: Analisi completata

---

## 📊 AZIONI DISPONIBILI - STATO ATTUALE

### 🟢 UTENTE (Widget)

#### Chat Actions
- ✅ **Creare nuova sessione chat** - `POST /api/chat/session`
- ✅ **Inviare messaggio** - `POST /api/chat/session/:id/message`
- ✅ **Richiedere operatore** - `POST /api/chat/session/:id/request-operator`
- ✅ **Ricevere messaggi operatore** - Socket.IO `operator_message`
- ✅ **Essere notificato assegnazione operatore** - Socket.IO `operator_assigned`
- ✅ **Vedere chat chiusa** - Socket.IO `chat_closed`

#### Ticket Actions
- ✅ **Creare ticket** - `POST /api/tickets`
- ✅ **Riprendere ticket esistente** - `GET /api/tickets/resume/:resumeToken`

#### Limitazioni Utente
- ❌ Non può chiudere la chat
- ❌ Non può riaprire chat chiusa
- ❌ Non può vedere storico conversazioni precedenti
- ❌ Non può allegare file/immagini
- ❌ Non può valutare l'operatore
- ❌ Non può modificare messaggi inviati
- ❌ Non può cancellare messaggi
- ❌ Non può vedere status operatore (online/offline/typing)
- ❌ Non può richiedere operatore specifico

---

### 🔵 OPERATORE (Dashboard)

#### Chat Actions
- ✅ **Vedere tutte le chat** - `GET /api/chat/sessions`
- ✅ **Filtrare chat** (status, archived, flagged, search)
- ✅ **Aprire chat** - `GET /api/chat/session/:id`
- ✅ **Inviare messaggio** - `POST /api/chat/session/:id/operator-message`
- ✅ **Chiudere chat** - `POST /api/chat/session/:id/close`
- ✅ **Archiviare chat** - `POST /api/chat/sessions/:id/archive`
- ✅ **Ripristinare chat archiviata** - `POST /api/chat/sessions/:id/unarchive`
- ✅ **Flag chat (importante)** - `POST /api/chat/sessions/:id/flag`
- ✅ **Unflag chat** - `POST /api/chat/sessions/:id/unflag`
- ✅ **Trasferire chat ad altro operatore** - `POST /api/chat/sessions/:id/transfer`
- ✅ **Cancellare chat (soft delete)** - `DELETE /api/chat/sessions/:id`
- ✅ **Marcare messaggi come letti** - `POST /api/chat/session/:id/mark-read`
- ✅ **Convertire chat in ticket** - `POST /api/chat/session/:id/convert-to-ticket`
- ✅ **Ricevere notifiche real-time** - Socket.IO listeners
- ✅ **Vedere badge unread count** - Dashboard UI

#### Ticket Actions
- ✅ **Vedere tutti i ticket** - `GET /api/tickets`
- ✅ **Vedere dettaglio ticket** - `GET /api/tickets/:id`
- ✅ **Assegnare ticket a sé** - `POST /api/tickets/:id/assign`
- ✅ **Risolvere ticket** - `POST /api/tickets/:id/resolve`

#### Limitazioni Operatore
- ❌ Non può riaprire chat chiusa
- ❌ Non può modificare messaggi inviati
- ❌ Non può cancellare singoli messaggi
- ❌ Non può inviare allegati (file, immagini, video)
- ❌ Non può vedere cronologia completa utente (chat precedenti)
- ❌ Non può aggiungere note interne non visibili all'utente
- ❌ Non può taggare chat con etichette custom
- ❌ Non può impostare promemoria/follow-up
- ❌ Non può vedere metriche performance personali
- ❌ Non può esportare transcript chat
- ❌ Non può cercare all'interno dei messaggi
- ❌ Non può vedere typing indicator dell'utente
- ❌ Non può inviare typing indicator
- ❌ Non può creare risposte rapide (canned responses) custom
- ❌ Non può prioritizzare chat manualmente
- ❌ Non può mettere chat in pausa
- ❌ Non può assegnare SLA/deadline a chat
- ❌ Non può bloccare/bannare utenti
- ❌ Non può vedere analytics dashboard

---

## 🎭 SCENARI D'USO REALI

### Scenario 1: Cliente Arrabbiato con Problema Urgente
**Flusso Attuale**:
1. ✅ User apre chat
2. ✅ AI risponde ma non risolve
3. ✅ User richiede operatore
4. ✅ Operatore assegnato
5. ✅ Conversazione operatore-user
6. ✅ Operatore chiude chat

**Problemi**:
- ❌ **Nessuna priorità**: Chat urgente mescolata con normali
- ❌ **No note interne**: Operatore non può scrivere note per colleghi
- ❌ **No escalation**: Non può escalare a supervisor
- ❌ **No follow-up**: Nessun modo di fare follow-up dopo 24h
- ❌ **No transcript**: Cliente non riceve email con conversazione

---

### Scenario 2: Cliente Torna Dopo 1 Settimana
**Flusso Attuale**:
1. ✅ User apre widget
2. ✅ Nuova sessione creata
3. ❌ **PROBLEMA**: Operatore NON vede storico conversazioni precedenti
4. ❌ **PROBLEMA**: User deve ri-spiegare tutto da capo

**Azioni Mancanti**:
- ❌ **User history**: Vedere tutte le chat precedenti dello stesso user
- ❌ **User profile**: Profilo utente con nome, email, chat precedenti
- ❌ **Context retention**: AI non ricorda conversazioni precedenti
- ❌ **Merge sessions**: Unire sessioni multiple dello stesso user

---

### Scenario 3: Ticket Complesso che Richiede Tempo
**Flusso Attuale**:
1. ✅ Chat → Converti in ticket
2. ✅ Ticket assegnato
3. ✅ Ticket risolto
4. ❌ **PROBLEMA**: Nessun modo di comunicare progress al cliente

**Azioni Mancanti**:
- ❌ **Ticket updates**: Aggiungere update/note al ticket
- ❌ **Customer notification**: Notificare cliente di progress
- ❌ **Ticket status intermedi**: Solo PENDING/OPEN/RESOLVED (manca IN_PROGRESS, WAITING_CUSTOMER, etc.)
- ❌ **Ticket priority**: Nessuna priorità (LOW/NORMAL/HIGH non usata?)
- ❌ **Ticket SLA**: Nessun tracking tempo risposta
- ❌ **Ticket re-open**: Cliente non può riaprire ticket chiuso
- ❌ **Ticket comments**: Thread di commenti tra operatori

---

### Scenario 4: Operatore Va in Pausa/Fine Turno
**Flusso Attuale**:
1. ✅ Operatore può trasferire chat ad altro operatore
2. ❌ **PROBLEMA**: Nessun modo di mettere "Away" o "Busy"
3. ❌ **PROBLEMA**: Chat continuano ad arrivare anche se offline

**Azioni Mancanti**:
- ❌ **Status operatore**: Away, Busy, Available, Offline
- ❌ **Auto-away**: Dopo N minuti inattività
- ❌ **Pause queue**: Smettere di ricevere nuove chat
- ❌ **Handoff notes**: Note per operatore successivo durante transfer
- ❌ **Shift management**: Orari turno, disponibilità
- ❌ **Max concurrent chats**: Limite chat simultanee per operatore

---

### Scenario 5: Cliente Invia Screenshot/File
**Flusso Attuale**:
1. ❌ **BLOCCATO**: Widget non supporta allegati
2. ❌ User deve descrivere problema a parole
3. ❌ Operatore non può richiedere screenshot

**Azioni Mancanti**:
- ❌ **File upload utente**: Immagini, PDF, screenshot
- ❌ **File upload operatore**: Inviare guide, documenti
- ❌ **Image preview**: Preview immagini in chat
- ❌ **File storage**: Dove salvare file? (S3, Cloudinary, etc.)
- ❌ **File size limits**: Validazione dimensione file
- ❌ **Virus scan**: Scansione antivirus file caricati

---

### Scenario 6: Analisi Performance e Reporting
**Flusso Attuale**:
1. ❌ **BLOCCATO**: Nessun analytics disponibile

**Azioni Mancanti**:
- ❌ **Dashboard analytics**: Metriche operatore/sistema
- ❌ **Response time**: Tempo medio risposta
- ❌ **Resolution time**: Tempo medio risoluzione
- ❌ **Customer satisfaction**: Rating post-chat
- ❌ **Chat volume**: Grafico chat per giorno/ora
- ❌ **Operator performance**: Chat gestite, rating medio, tempo medio
- ❌ **Peak hours**: Identificare orari di picco
- ❌ **Common issues**: Identificare problemi ricorrenti
- ❌ **Export reports**: CSV/Excel export per management
- ❌ **AI performance**: Accuracy AI, confidence distribution

---

### Scenario 7: Cliente Vuole Parlare con Manager
**Flusso Attuale**:
1. ✅ Operatore può trasferire ad altro operatore
2. ❌ **PROBLEMA**: Nessuna distinzione ruoli (tutti operatori uguali)

**Azioni Mancanti**:
- ❌ **Escalation hierarchy**: Junior → Senior → Manager
- ❌ **Escalation rules**: Automatica dopo N minuti o customer request
- ❌ **Supervisor panel**: Dashboard speciale per supervisors
- ❌ **Live monitoring**: Supervisor vede chat in corso
- ❌ **Whisper/intervene**: Supervisor può suggerire a operatore senza che user veda
- ❌ **Force takeover**: Manager può prendere chat da operatore

---

### Scenario 8: Spam/Abuso
**Flusso Attuale**:
1. ✅ Operatore può chiudere chat
2. ❌ **PROBLEMA**: Stesso user può aprire infinite nuove chat

**Azioni Mancanti**:
- ❌ **Block user**: Bloccare IP/session permanentemente
- ❌ **Rate limiting**: Max N chat per user per giorno
- ❌ **Spam detection**: AI identifica spam automaticamente
- ❌ **Report abuse**: Flag chat come spam/abuso
- ❌ **Blacklist**: Lista IP/pattern bloccati
- ❌ **Moderazione**: Review chat flaggate

---

### Scenario 9: Formazione Nuovi Operatori
**Flusso Attuale**:
1. ❌ **BLOCCATO**: Nessun supporto training

**Azioni Mancanti**:
- ❌ **Observation mode**: Operatore junior osserva senior
- ❌ **Chat templates**: Template risposte per situazioni comuni
- ❌ **Knowledge base link**: Linkare KB articles durante chat
- ❌ **Auto-suggestions**: Suggerire risposte basate su KB
- ❌ **Training analytics**: Tracciare performance durante training
- ❌ **Feedback loop**: Senior può dare feedback su chat junior

---

### Scenario 10: Conformità e Audit
**Flusso Attuale**:
1. ✅ Chat salvate in database
2. ❌ **PROBLEMA**: Nessun audit trail, export, o compliance tools

**Azioni Mancanti**:
- ❌ **Audit log**: Chi ha fatto cosa quando
- ❌ **Chat export**: Export massivo per compliance
- ❌ **Data retention**: Policy automatica cancellazione dopo N mesi
- ❌ **GDPR compliance**: User può richiedere dati/cancellazione
- ❌ **Encryption**: Chat a riposo criptate
- ❌ **Backup**: Backup automatici
- ❌ **Search all**: Ricerca globale attraverso tutte le chat (per audit)

---

## 🚨 AZIONI CRITICHE MANCANTI (High Priority)

### P0 - Blockers per Uso Reale
1. **File Upload** (utente + operatore)
   - Impact: CRITICAL - Molti supporti richiedono screenshot
   - Effort: 3-4 giorni
   - Componenti: Widget upload, Dashboard view, Storage (S3), Validation

2. **User History/Profile**
   - Impact: CRITICAL - Operatore cieco senza contesto
   - Effort: 2-3 giorni
   - Componenti: User identification, Session linking, UI dashboard

3. **Note Interne Operatore**
   - Impact: HIGH - Collaborazione tra operatori impossibile
   - Effort: 1 giorno
   - Componenti: Note field, Permission check, UI

4. **Chat Transcript via Email**
   - Impact: HIGH - Cliente vuole copia conversazione
   - Effort: 1 giorno
   - Componenti: Email template, Send on close

5. **Typing Indicator**
   - Impact: MEDIUM - UX migliorata
   - Effort: 4-6 ore
   - Componenti: Socket.IO events, UI animation

---

### P1 - Important per Production
6. **Customer Satisfaction Rating**
   - Impact: HIGH - Nessuna metrica qualità
   - Effort: 1-2 giorni

7. **Analytics Dashboard**
   - Impact: HIGH - Management cieco
   - Effort: 3-5 giorni

8. **Chat Priority/Tags**
   - Impact: MEDIUM - Organizzazione caotica
   - Effort: 1-2 giorni

9. **Reopen Ticket/Chat**
   - Impact: MEDIUM - User frustrato se risolto troppo presto
   - Effort: 1 giorno

10. **Operator Status (Away/Busy)**
    - Impact: MEDIUM - Queue management
    - Effort: 1 giorno

---

### P2 - Nice to Have
11. **Canned Responses Custom**
12. **Escalation Workflow**
13. **SLA Tracking**
14. **Live Monitoring (Supervisor)**
15. **Chat Templates**
16. **Export Reports**
17. **Block/Ban Users**
18. **Auto-suggestions from KB**
19. **Merge User Sessions**
20. **Advanced Search**

---

## 📋 MATRICE IMPATTO vs EFFORT

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| File Upload | CRITICAL | 3-4d | **P0.1** |
| User History | CRITICAL | 2-3d | **P0.2** |
| Internal Notes | HIGH | 1d | **P0.3** |
| Email Transcript | HIGH | 1d | **P0.4** |
| Typing Indicator | MEDIUM | 6h | P1.1 |
| CSAT Rating | HIGH | 2d | P1.2 |
| Analytics | HIGH | 4d | P1.3 |
| Priority/Tags | MEDIUM | 1d | P1.4 |
| Reopen Ticket | MEDIUM | 1d | P1.5 |
| Operator Status | MEDIUM | 1d | P1.6 |
| Canned Responses | LOW | 2d | P2.1 |
| Escalation | LOW | 3d | P2.2 |
| SLA Tracking | LOW | 2d | P2.3 |

---

## 🎯 RACCOMANDAZIONI

### Per Launch Immediato (MVP)
Sistema è **usabile così com'è** per:
- ✅ Supporto base chat AI
- ✅ Escalation a operatore
- ✅ Ticketing semplice
- ✅ Piccolo team (1-3 operatori)
- ✅ Volume basso (<50 chat/giorno)

### Per Production Reale
Implementare **almeno P0** prima di:
- ❌ Team >5 operatori
- ❌ Volume >100 chat/giorno
- ❌ Supporto che richiede screenshot
- ❌ Customer base ricorrente

### Per Enterprise
Implementare **P0 + P1** prima di:
- ❌ Team >10 operatori
- ❌ Volume >500 chat/giorno
- ❌ Requisiti compliance/audit
- ❌ SLA contrattuali

---

## 📊 COMPARAZIONE COMPETITOR

### Intercom / Zendesk / Freshdesk
**Hanno**:
- ✅ File upload
- ✅ User profiles
- ✅ Internal notes
- ✅ CSAT
- ✅ Analytics
- ✅ Canned responses
- ✅ Tags/Priority
- ✅ SLA
- ✅ Escalation
- ✅ Advanced search

**Lucine Manca**:
- ❌ Tutti i sopra

**Lucine Ha (loro non hanno)**:
- ✅ AI semantico integrato con pgvector
- ✅ Sistema più semplice e leggero

---

**Conclusione**: Sistema funzionante ma necessita feature P0 per competere con soluzioni enterprise.

