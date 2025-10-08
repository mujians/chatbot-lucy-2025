# 🚀 GUIDA DEPLOYMENT SU RENDER

**Data:** 2025-10-08
**Status:** Pronto per il deploy

---

## ⚠️ IMPORTANTE - Localhost Rimosso

**Tutti i riferimenti a localhost sono stati rimossi dal codice!**

Il sistema ora richiede **OBBLIGATORIAMENTE** le variabili d'ambiente configurate.

---

## 📋 CHECKLIST PRE-DEPLOY

### ✅ Completato
- [x] Backend code completo
- [x] Frontend widget completo con URL check
- [x] Frontend dashboard completo (6 componenti)
- [x] Localhost rimosso da tutti i file
- [x] Variabili d'ambiente configurate
- [x] Database schema pronto

### ⏳ Da fare su Render
- [ ] Creare database PostgreSQL
- [ ] Deploy backend
- [ ] Deploy widget frontend
- [ ] Deploy dashboard frontend
- [ ] Configurare variabili d'ambiente

---

## 1️⃣ SETUP DATABASE (PostgreSQL su Render)

### Step 1: Crea Database

1. Vai su https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configurazione:
   ```
   Name: lucine-chatbot-db
   Database: lucine_chatbot
   User: (auto-generated)
   Region: Frankfurt (o più vicino)
   Plan: Free
   ```
4. Click **"Create Database"**

### Step 2: Ottieni Connection String

Render ti darà due connection strings:

**Internal Database URL** (usa questa per il backend):
```
postgresql://user:password@hostname/database
```

**External Database URL** (per connessioni esterne):
```
postgresql://user:password@hostname:port/database
```

### Step 3: Installa Estensione Vector

1. Nella dashboard del database, click **"Connect"**
2. Copia il comando PSQL
3. Dal tuo terminale locale:
   ```bash
   psql [paste-connection-string-here]

   # Una volta connesso:
   CREATE EXTENSION IF NOT EXISTS vector;
   \q
   ```

---

## 2️⃣ DEPLOY BACKEND

### Step 1: Crea Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect repository o upload folder `backend/`
3. Configurazione:
   ```
   Name: lucine-chatbot-backend
   Region: Frankfurt
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install && npx prisma generate
   Start Command: npm start
   Plan: Free
   ```

### Step 2: Environment Variables

Click **"Environment"** e aggiungi:

```bash
# Database
DATABASE_URL=[Internal-Database-URL-from-step-1]

# Server
NODE_ENV=production
PORT=3001

# JWT
JWT_SECRET=[genera-una-chiave-sicura-random]
JWT_EXPIRES_IN=7d

# OpenAI (OBBLIGATORIO)
OPENAI_API_KEY=sk-proj-[your-key]
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=500

# Twilio (OBBLIGATORIO per WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=your-token
TWILIO_WHATSAPP_NUMBER=+14155238886

# Email (Opzionale)
EMAIL_FROM=noreply@lucine.it
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URLs
SHOPIFY_SITE_URL=https://lucine.it
WIDGET_URL=[your-widget-url-from-step-3]
DASHBOARD_URL=[your-dashboard-url-from-step-4]

# CORS (aggiorna dopo deploy frontend)
CORS_ORIGINS=https://lucine.it,https://[your-widget-url],https://[your-dashboard-url]

# Session & Chat
SESSION_TTL_HOURS=24
CHAT_TIMEOUT_MINUTES=5
OPERATOR_TIMEOUT_SECONDS=30

# Knowledge Base
KB_CONFIDENCE_THRESHOLD=0.7
KB_MAX_RESULTS=5
```

### Step 3: Deploy

1. Click **"Create Web Service"**
2. Render inizierà il build automaticamente
3. Aspetta che il deploy finisca (⏱️ ~3-5 minuti)

### Step 4: Run Migrations

Dopo il primo deploy:

1. Click su **"Shell"** nella dashboard del backend
2. Esegui:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

**IMPORTANTE:** Questo crea le tabelle e aggiunge:
- Admin user: `admin@lucine.it` / `admin123`
- 6 system settings
- Sample knowledge base items

---

## 3️⃣ DEPLOY WIDGET FRONTEND

### Step 1: Aggiorna .env

Nel file `frontend-widget/.env`:
```bash
VITE_API_URL=https://lucine-chatbot-backend.onrender.com/api
VITE_SOCKET_URL=https://lucine-chatbot-backend.onrender.com
```

### Step 2: Build Locale

```bash
cd frontend-widget
npm install
npm run build
```

### Step 3: Deploy su Render

**Opzione A: Static Site**
1. Click **"New +"** → **"Static Site"**
2. Connect repository o upload `frontend-widget/`
3. Configurazione:
   ```
   Name: lucine-widget
   Build Command: npm run build
   Publish Directory: dist
   ```
4. Environment Variables:
   ```
   VITE_API_URL=https://lucine-chatbot-backend.onrender.com/api
   VITE_SOCKET_URL=https://lucine-chatbot-backend.onrender.com
   ```

**Opzione B: Serve da Backend**
Copia il contenuto di `frontend-widget/dist/` in `backend/public/widget/`

---

## 4️⃣ DEPLOY DASHBOARD FRONTEND

### Step 1: Aggiorna .env

Nel file `frontend-dashboard/.env`:
```bash
VITE_API_URL=https://lucine-chatbot-backend.onrender.com/api
VITE_WS_URL=https://lucine-chatbot-backend.onrender.com
```

### Step 2: Build Locale

```bash
cd frontend-dashboard
npm install
npm run build
```

### Step 3: Deploy su Render

1. Click **"New +"** → **"Static Site"**
2. Connect repository o upload `frontend-dashboard/`
3. Configurazione:
   ```
   Name: lucine-dashboard
   Build Command: npm run build
   Publish Directory: dist
   ```
4. Environment Variables:
   ```
   VITE_API_URL=https://lucine-chatbot-backend.onrender.com/api
   VITE_WS_URL=https://lucine-chatbot-backend.onrender.com
   ```

---

## 5️⃣ CONFIGURAZIONE FINALE

### Aggiorna CORS nel Backend

1. Vai su backend environment variables
2. Aggiorna `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=https://lucine.it,https://lucine-widget.onrender.com,https://lucine-dashboard.onrender.com
   ```
3. Save e aspetta il redeploy automatico

### Aggiorna URLs nel Backend

1. Aggiorna `WIDGET_URL`:
   ```
   WIDGET_URL=https://lucine-widget.onrender.com
   ```
2. Aggiorna `DASHBOARD_URL`:
   ```
   DASHBOARD_URL=https://lucine-dashboard.onrender.com
   ```

---

## 6️⃣ TESTING

### Test Backend

```bash
curl https://lucine-chatbot-backend.onrender.com/health
# Dovrebbe rispondere: {"status":"ok",...}
```

### Test Widget

1. Apri: `https://lucine-widget.onrender.com`
2. Il widget NON dovrebbe apparire
3. Apri: `https://lucine-widget.onrender.com?chatbot=test&pb=0`
4. Il widget DOVREBBE apparire ✅

### Test Dashboard

1. Apri: `https://lucine-dashboard.onrender.com`
2. Login con: `admin@lucine.it` / `admin123`
3. Naviga tra i tab
4. Tutte le sezioni dovrebbero caricare ✅

---

## 7️⃣ INTEGRAZIONE SHOPIFY

### Aggiungi Widget a Shopify

1. Vai su Shopify Admin → **Online Store** → **Themes**
2. Click **"..."** → **"Edit Code"**
3. Apri `theme.liquid`
4. Prima del tag `</body>`, aggiungi:

```html
<!-- Lucine Chatbot Widget -->
<script>
  // Load only on pages with ?chatbot=test&pb=0
  const params = new URLSearchParams(window.location.search);
  if (params.get('chatbot') === 'test' && params.get('pb') === '0') {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://lucine-widget.onrender.com/assets/index.js';
    document.body.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://lucine-widget.onrender.com/assets/index.css';
    document.head.appendChild(link);
  }
</script>
```

5. **Save**

### Test su Shopify

```
https://lucine.it?chatbot=test&pb=0
```

---

## 8️⃣ MONITORAGGIO

### Logs Backend

Render Dashboard → lucine-chatbot-backend → **"Logs"**

Controlla:
- Server startup OK
- Database connection OK
- Nessun errore API key
- WebSocket connections

### Logs Database

Render Dashboard → lucine-chatbot-db → **"Logs"**

Controlla:
- Connection count
- Query errors

### Metrics

Render Dashboard → **"Metrics"** per ogni servizio:
- CPU usage
- Memory usage
- Request count
- Response times

---

## 9️⃣ TROUBLESHOOTING

### Backend non parte

1. Check logs: errori sulle env vars?
2. Verifica `DATABASE_URL` sia corretto
3. Verifica `OPENAI_API_KEY` sia valido
4. Run migrations: `npx prisma migrate deploy`

### Widget non appare

1. Check console browser (F12)
2. Verifica URL abbia `?chatbot=test&pb=0`
3. Check variabili `VITE_API_URL` e `VITE_SOCKET_URL`
4. Verifica CORS nel backend

### Dashboard non carica

1. Check console browser
2. Verifica login: `admin@lucine.it` / `admin123`
3. Check API URL in env vars
4. Verifica database sia seedato

### Chat non risponde

1. ❌ **OpenAI API key mancante o invalida**
   - Check env var `OPENAI_API_KEY`
   - Verifica credito su https://platform.openai.com/account/billing

2. ❌ **Database non popolato**
   - Run: `npm run seed` nel backend shell

3. ❌ **WebSocket non connette**
   - Check CORS settings
   - Verifica firewall/proxy

### WhatsApp non invia

1. ❌ **Twilio credentials mancanti**
   - Check `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN`
2. ❌ **Sandbox non attivato**
   - Vai su https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
   - Attiva sandbox
3. ❌ **Numero non verificato**
   - In sandbox mode, il numero deve fare "join xxx-xxx"

---

## 🔐 SECURITY CHECKLIST

- [ ] Cambia `JWT_SECRET` con una chiave random sicura
- [ ] Cambia password admin dopo primo login
- [ ] Verifica `CORS_ORIGINS` contenga SOLO i tuoi domini
- [ ] Non committare file `.env` su Git
- [ ] Abilita 2FA su account Render
- [ ] Monitora usage OpenAI per costi imprevisti
- [ ] Abilita auto-reload crediti Twilio

---

## 💰 COSTI RENDER

### Free Tier
- **Database:** PostgreSQL Free (1GB storage)
- **Backend:** Web Service Free (750 ore/mese, cold start dopo 15min inattività)
- **Frontends:** Static Sites Free (100GB bandwidth/mese)

**Totale Free Tier:** $0/mese

### Paid (se necessario)
- **Database Starter:** $7/mese (10GB storage, no cold start)
- **Backend Starter:** $7/mese (no cold start)

---

## 📊 COSTI ESTERNI

### OpenAI
- **Basso traffico (500 user/mese):** ~$20/mese
- **Medio traffico (2000 user/mese):** ~$70/mese
- **Alto traffico (5000 user/mese):** ~$200/mese

### Twilio
- **Basso (100 tickets/mese):** ~$0.50/mese
- **Medio (500 tickets/mese):** ~$2.50/mese
- **Alto (2000 tickets/mese):** ~$10/mese

**Totale Esterno:** ~$20-210/mese (dipende dal traffico)

---

## ✅ DEPLOY COMPLETO!

Dopo aver seguito questi step, il sistema sarà:

1. ✅ Backend su Render con database PostgreSQL
2. ✅ Widget su Render (visibile solo con ?chatbot=test&pb=0)
3. ✅ Dashboard su Render (login admin)
4. ✅ Integrato su Shopify (opzionale)
5. ✅ Monitorato con logs Render
6. ✅ Sicuro con JWT + CORS + env vars

---

## 📞 SUPPORTO

**Render Docs:** https://render.com/docs
**Render Status:** https://status.render.com

**Issues?** Check:
1. Logs su Render dashboard
2. Console browser (F12)
3. File `EXTERNAL_SERVICES.md` per OpenAI/Twilio setup

---

**Created:** 2025-10-08
**Status:** ✅ Pronto per deploy
**Tempo stimato:** 30-45 minuti per deploy completo
