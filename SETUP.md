# 🚀 Setup Iniziale - Lucine Chatbot

Questa guida ti aiuterà a configurare e avviare il progetto Lucine Chatbot.

## ⚠️ Prerequisiti

Prima di iniziare, assicurati di avere installato:

- **Node.js 20+** (verifica con `node --version`)
- **PostgreSQL 14+** (con estensione pgvector)
- **Git**

## 📦 Step 1: Installazione Dipendenze

### Backend
```bash
cd backend
npm install
```

### Frontend Widget
```bash
cd frontend-widget
npm install
```

### Frontend Dashboard
```bash
cd frontend-dashboard
npm install
```

## 🗄️ Step 2: Setup Database

### 2.1 Crea il database PostgreSQL
```sql
CREATE DATABASE lucine_chatbot;
```

### 2.2 Installa l'estensione pgvector
```sql
\c lucine_chatbot
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.3 Configura variabili d'ambiente
```bash
cd backend
cp .env.example .env
```

Modifica `.env` con le tue credenziali:
```
DATABASE_URL="postgresql://user:password@localhost:5432/lucine_chatbot"
JWT_SECRET="your-secret-key-here"
OPENAI_API_KEY="sk-your-openai-key"
TWILIO_ACCOUNT_SID="ACxxxxxx"
TWILIO_AUTH_TOKEN="your-token"
```

### 2.4 Esegui le migrations
```bash
cd backend
npx prisma migrate dev --name init
```

### 2.5 Popola il database con dati di test
```bash
npm run seed
```

Questo creerà:
- Admin: `admin@lucine.it` / `admin123`
- Operator: `mario.rossi@lucine.it` / `operator123`
- 5 items nella knowledge base
- System settings

## 🚀 Step 3: Avvio Applicazione

### Opzione A: Avvio manuale (3 terminali)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Server disponibile su: http://localhost:3001

**Terminal 2 - Widget:**
```bash
cd frontend-widget
npm run dev
```
Widget disponibile su: http://localhost:5173

**Terminal 3 - Dashboard:**
```bash
cd frontend-dashboard
npm run dev
```
Dashboard disponibile su: http://localhost:5174

### Opzione B: Script automatico (TODO)
```bash
./start-all.sh
```

## ✅ Step 4: Verifica Installazione

### 4.1 Backend Health Check
Apri browser su: http://localhost:3001/health

Dovresti vedere:
```json
{
  "status": "ok",
  "timestamp": "2025-10-08T12:00:00.000Z",
  "uptime": 10.5
}
```

### 4.2 Test Widget
Apri: http://localhost:5173

Dovresti vedere:
- Bubble chatbot in basso a destra
- Cliccando si apre popup chat
- Welcome message: "Ciao! Sono Lucy..."

### 4.3 Test Dashboard
Apri: http://localhost:5174

Login con:
- Email: `admin@lucine.it`
- Password: `admin123`

Dovresti vedere la dashboard operatori.

## 🧪 Step 5: Test Funzionalità Base

### Test 1: Chat AI
1. Apri widget (http://localhost:5173)
2. Invia messaggio: "Dove parcheggiare?"
3. Dovresti ricevere risposta AI con info parcheggio

### Test 2: Richiesta Operatore
1. Nel widget, scrivi: "Voglio parlare con operatore"
2. L'AI dovrebbe offrire bottone "PARLA CON OPERATORE"
3. Se nessun operatore online → form ticket
4. Se operatore online → connessione real-time

### Test 3: Dashboard Operatore
1. Login dashboard
2. Toggle status a "ONLINE"
3. Apri widget in altra tab
4. Richiedi operatore
5. Dovresti vedere notifica in dashboard

## 🔧 Troubleshooting

### Problema: Prisma non trova il database
**Soluzione:**
```bash
cd backend
npx prisma generate
npx prisma migrate reset
npm run seed
```

### Problema: Port già in uso
**Soluzione:**
```bash
# Trova processo su porta 3001
lsof -i :3001
kill -9 <PID>

# Oppure cambia porta in .env
PORT=3002
```

### Problema: OpenAI API non funziona
**Soluzione:**
- Verifica chiave API sia valida
- Controlla crediti OpenAI
- Per sviluppo, puoi mockare le risposte AI

### Problema: pgvector non installato
**Soluzione:**
```bash
# macOS con Homebrew
brew install pgvector

# Ubuntu/Debian
sudo apt-get install postgresql-server-dev-14
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

## 📚 Prossimi Passi

Dopo il setup di base, puoi:

1. **Implementare autenticazione completa** (JWT + refresh tokens)
2. **Aggiungere più eventi WebSocket** (real-time chat)
3. **Integrare OpenAI completamente** (AI service)
4. **Setup Twilio WhatsApp** (notifications)
5. **Aggiungere più componenti shadcn/ui** (dashboard UI)

## 🆘 Supporto

Se incontri problemi:
1. Controlla i logs nel terminal
2. Verifica `.env` sia configurato correttamente
3. Assicurati che PostgreSQL sia in esecuzione
4. Controlla che le porte 3001, 5173, 5174 siano libere

## 📝 Note Importanti

- **Non committare `.env`** (già in .gitignore)
- **Cambia JWT_SECRET** prima del deployment
- **Le chiavi API** sono sensitive - non condividerle
- **Database seed** è solo per sviluppo

## 🎯 Stato Attuale

✅ Struttura progetto completa
✅ Backend base (Express + Socket.io)
✅ Database schema (Prisma)
✅ Frontend Widget base
✅ Frontend Dashboard base

🚧 Da completare:
- Autenticazione completa
- WebSocket chat system
- OpenAI integration
- Twilio WhatsApp
- UI components completi

---

**Buon sviluppo! 🎄✨**
