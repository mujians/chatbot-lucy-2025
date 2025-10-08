# 🔌 External Services Requirements

**Project:** Lucine Chatbot
**Date:** 2025-10-08

---

## ⚠️ CRITICAL DEPENDENCIES

Il sistema richiede **2 servizi esterni obbligatori** per funzionare:

1. **OpenAI** - Per AI chat
2. **Twilio** - Per notifiche WhatsApp

---

## 1. OpenAI API 🤖

### Status
❌ **NON configurato** - OBBLIGATORIO per chatbot AI

### Cosa Serve
- Account OpenAI con carta di credito
- API Key attiva
- Credito disponibile

### Funzionalità che Dipendono
- ✅ AI chat responses (GPT-4 Turbo)
- ✅ Semantic search nel Knowledge Base (embeddings)
- ✅ Confidence scoring (quando suggerire operatore)
- ✅ Smart actions (bottoni suggeriti)

### Senza OpenAI
❌ Il chatbot NON risponde
❌ User invia messaggio → Nessuna risposta AI
❌ Knowledge base search non funziona
⚠️ Widget carica ma chat è inutilizzabile

### Setup Passo-Passo

#### 1. Crea Account
```
URL: https://platform.openai.com/signup
- Registrati con email
- Verifica email
```

#### 2. Aggiungi Metodo di Pagamento
```
URL: https://platform.openai.com/account/billing
- Aggiungi carta di credito
- Imposta budget mensile (consigliato: $50-100)
- Abilita auto-reload se necessario
```

#### 3. Genera API Key
```
URL: https://platform.openai.com/api-keys
- Click "Create new secret key"
- Nome: "Lucine Chatbot Production"
- Copia la chiave (inizia con "sk-proj-...")
- IMPORTANTE: Salvala subito, non la rivedrai più!
```

#### 4. Configura nel Progetto
```bash
# In backend/.env
OPENAI_API_KEY="sk-proj-vostra-chiave-qui"
OPENAI_MODEL="gpt-4-turbo-preview"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=500
```

### Costi OpenAI

#### Modelli Utilizzati
| Modello | Utilizzo | Costo Input | Costo Output |
|---------|----------|-------------|--------------|
| GPT-4 Turbo | Chat responses | $0.01 / 1K tokens | $0.03 / 1K tokens |
| text-embedding-3-small | KB search | $0.00002 / 1K tokens | - |

#### Stima Costi Mensili

**Scenario 1: Basso Traffico (500 utenti/mese)**
- 500 sessioni chat
- 2 messaggi per sessione = 1000 messaggi
- Avg 150 tokens input + 200 tokens output per messaggio
- **Costo GPT-4:** ~$15-20/mese
- **Costo Embeddings:** ~$0.50/mese
- **TOTALE:** ~$20/mese

**Scenario 2: Medio Traffico (2000 utenti/mese)**
- 2000 sessioni chat
- 2 messaggi per sessione = 4000 messaggi
- **Costo GPT-4:** ~$60-80/mese
- **Costo Embeddings:** ~$2/mese
- **TOTALE:** ~$70/mese

**Scenario 3: Alto Traffico (5000 utenti/mese)**
- 5000 sessioni chat
- 3 messaggi per sessione = 15000 messaggi
- **Costo GPT-4:** ~$180-250/mese
- **Costo Embeddings:** ~$5/mese
- **TOTALE:** ~$200/mese

### Ottimizzazioni Costi
1. **Cache KB embeddings** - Genera embeddings una volta, non ad ogni query
2. **Limita max_tokens** - Default 500, sufficiente per risposte concise
3. **Usa confidence threshold** - Se AI non è sicura, passa subito a operatore (risparmio token)
4. **Monitor usage** - Dashboard OpenAI mostra uso real-time

### Testing
```bash
# Test senza costo (usa free credits se disponibili)
curl -X POST http://localhost:3001/api/chat/session/:id/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Ciao, test"}'

# Se funziona, vedrai risposta AI
# Se fallisce, controlla backend logs per errori API key
```

---

## 2. Twilio (WhatsApp) 📱

### Status
❌ **NON configurato** - OBBLIGATORIO per notifiche WhatsApp

### Cosa Serve
- Account Twilio (free trial disponibile)
- WhatsApp Business sandbox attivato
- Phone number verificato

### Funzionalità che Dipendono
- ✅ Ticket notifications via WhatsApp
- ✅ Resume link via WhatsApp (user clicca link, riprende chat)
- ✅ Operator → User messages via WhatsApp

### Senza Twilio
✅ Tickets funzionano ma SOLO con Email
❌ Tickets con contactMethod="WHATSAPP" → Creati ma NO notifica inviata
❌ User non riceve link per riprendere chat
⚠️ Degrado graceful: sistema funziona, ma WhatsApp non disponibile

### Setup Passo-Passo

#### 1. Crea Account Twilio
```
URL: https://www.twilio.com/try-twilio
- Registrati (free $15 trial credit)
- Verifica email + phone number
```

#### 2. Attiva WhatsApp Sandbox
```
URL: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

Passi:
1. Click "Try it Out" → WhatsApp
2. Invia messaggio WhatsApp a +14155238886 con codice "join xxx-xxx"
3. Ricevi conferma "Joined xxx-xxx sandbox"
4. Ora puoi inviare messaggi WhatsApp a numeri verificati
```

#### 3. Ottieni Credentials
```
URL: https://console.twilio.com/

Copia:
- Account SID (inizia con "AC...")
- Auth Token (click "show" per vederlo)
- WhatsApp Number: "+14155238886" (sandbox number)
```

#### 4. Configura nel Progetto
```bash
# In backend/.env
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token-here"
TWILIO_WHATSAPP_NUMBER="+14155238886"
```

#### 5. Verifica Numeri Destinatari (Sandbox Mode)
```
IMPORTANTE in sandbox mode:
- Solo numeri che hanno fatto "join xxx-xxx" ricevono messaggi
- Per testing: usa il TUO numero (già joined)
- Per produzione: upgrade a full account (no sandbox limit)
```

### Costi Twilio

#### Pricing WhatsApp
| Tipo Messaggio | Costo | Note |
|----------------|-------|------|
| Session initiation | $0.005 | Primo messaggio in 24h |
| Follow-up message | $0.0025 | Entro 24h dalla session |
| User-initiated | Gratis | User risponde |

#### Stima Costi Mensili

**Scenario 1: 100 tickets WhatsApp/mese**
- 100 session initiations × $0.005 = $0.50
- **TOTALE:** ~$0.50/mese

**Scenario 2: 500 tickets WhatsApp/mese**
- 500 session initiations × $0.005 = $2.50
- **TOTALE:** ~$2.50/mese

**Scenario 3: 2000 tickets WhatsApp/mese**
- 2000 session initiations × $0.005 = $10
- **TOTALE:** ~$10/mese

### Sandbox vs Production

#### Sandbox (Free Trial)
- ✅ $15 free credit
- ✅ Ottimo per testing
- ❌ Solo numeri verificati ricevono messaggi
- ❌ Serve "join xxx-xxx" per ogni numero
- ❌ Limite ~100 messaggi con trial credit

#### Production (Full Account)
- ✅ Nessun limite numeri
- ✅ No "join" richiesto
- ✅ Branded sender (tuo nome azienda)
- 💰 Richiede upgrade account + business verification

### Testing
```bash
# 1. Test API (senza inviare WhatsApp)
curl -X POST http://localhost:3001/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1",
    "userName": "Mario Rossi",
    "contactMethod": "WHATSAPP",
    "whatsappNumber": "+393331234567",
    "initialMessage": "Test ticket"
  }'

# 2. Check backend logs per conferma invio Twilio
# Vedrai: "✅ WhatsApp sent (SID: SMxxxxxxxxx)" se funziona
# Oppure: "❌ Twilio error: ..." se fallisce

# 3. Controlla Twilio console logs
URL: https://console.twilio.com/us1/monitor/logs/sms
```

---

## 3. Email SMTP (Opzionale) 📧

### Status
⚠️ **Opzionale** - Ma consigliato per tickets via Email

### Cosa Serve
- Gmail account con App Password
- OPPURE Resend account (più professionale)

### Setup Gmail

#### 1. Abilita 2FA
```
URL: https://myaccount.google.com/security
- Attiva "2-Step Verification"
```

#### 2. Genera App Password
```
URL: https://myaccount.google.com/apppasswords
- Nome app: "Lucine Chatbot"
- Copia password (16 caratteri senza spazi)
```

#### 3. Configura
```bash
# In backend/.env
EMAIL_FROM="noreply@lucine.it"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-char-app-password"
```

### Setup Resend (Alternativa Migliore)
```
URL: https://resend.com
- Free tier: 3000 email/mese
- Setup SPF/DKIM per domain
- API key based (più semplice)
```

---

## 📊 RIEPILOGO COSTI MENSILI

### Scenario Startup (500 utenti/mese)
| Servizio | Costo | Note |
|----------|-------|------|
| OpenAI | $20 | AI chat + embeddings |
| Twilio | $2.50 | WhatsApp notifications |
| Email | $0 | Gmail gratis o Resend free tier |
| **TOTALE** | **$22.50/mese** | |

### Scenario Growing (2000 utenti/mese)
| Servizio | Costo | Note |
|----------|-------|------|
| OpenAI | $70 | Più traffico chat |
| Twilio | $10 | Più tickets WhatsApp |
| Email | $0 | Still free |
| **TOTALE** | **$80/mese** | |

### Scenario Scalato (5000 utenti/mese)
| Servizio | Costo | Note |
|----------|-------|------|
| OpenAI | $200 | Alto volume chat |
| Twilio | $25 | Molti tickets WhatsApp |
| Email | $10 | Resend paid (10K emails) |
| **TOTALE** | **$235/mese** | |

---

## ✅ CHECKLIST SETUP

### Pre-Produzione
- [ ] OpenAI account creato
- [ ] OpenAI API key generata
- [ ] Budget OpenAI impostato
- [ ] Twilio account creato
- [ ] WhatsApp sandbox attivato
- [ ] Test numero WhatsApp verificato
- [ ] Email SMTP configurato (opzionale)
- [ ] Tutte le keys in `.env`
- [ ] Test invio messaggi funzionante

### Produzione
- [ ] OpenAI budget aumentato (se necessario)
- [ ] Twilio upgrade da sandbox a production (se > 100 msg/mese)
- [ ] Twilio business verification completata
- [ ] WhatsApp sender name brandizzato
- [ ] Email domain SPF/DKIM configurato
- [ ] Monitoring attivo (OpenAI + Twilio dashboards)
- [ ] Backup plan se servizi down

---

## 🚨 COSA SUCCEDE SE...

### OpenAI è Down o API Key Invalida
**Impatto:** ❌ CRITICO - Chat AI non funziona
**Soluzione:**
1. User clicca chat → Nessuna risposta AI
2. Sistema mostra: "Servizio temporaneamente non disponibile"
3. Offre subito: "PARLA CON OPERATORE" button
4. Degrada a chat con operatore umano

**Prevenzione:**
- Monitor OpenAI status: https://status.openai.com
- Implementa fallback automatico a operatore
- Alert se API key invalida o quota esaurita

### Twilio è Down o Credito Esaurito
**Impatto:** ⚠️ MEDIO - Tickets funzionano ma no WhatsApp
**Soluzione:**
1. Ticket si crea comunque (salvato in DB)
2. Notifica WhatsApp fallisce gracefully
3. Usa fallback: Email (se configurato)
4. Operator vede ticket in dashboard comunque

**Prevenzione:**
- Monitor Twilio balance
- Alert se credito < $10
- Abilita auto-reload crediti

### Email SMTP Down
**Impatto:** 🟢 BASSO - Tickets WhatsApp funzionano
**Soluzione:**
1. User sceglie WhatsApp invece di Email
2. Sistema funziona normalmente

---

## 📞 SUPPORTO

### OpenAI
- Docs: https://platform.openai.com/docs
- Status: https://status.openai.com
- Support: https://help.openai.com

### Twilio
- Docs: https://www.twilio.com/docs
- Console: https://console.twilio.com
- Support: https://support.twilio.com

---

**Creato:** 2025-10-08
**Aggiornato:** 2025-10-08
