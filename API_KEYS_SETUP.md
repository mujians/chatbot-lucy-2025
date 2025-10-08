# API Keys Configuration

## OpenAI API Key

**File:** `backend/.env`

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=500
```

**Where to get:**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-proj-`)
4. Paste in backend/.env

**Used in:**
- `backend/src/services/openai.service.js` - AI chat responses
- `backend/src/services/openai.service.js` - Knowledge base embeddings

## Twilio API Keys (WhatsApp)

**File:** `backend/.env`

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886
```

**Where to get:**
1. Go to https://console.twilio.com/
2. Copy Account SID and Auth Token from dashboard
3. For sandbox: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
4. Sandbox number is usually `+14155238886`

**Used in:**
- `backend/src/services/notification.service.js` - Send WhatsApp notifications

**Note:** In sandbox mode, users must send "join xxx-xxx" to the number first.

## SMTP Email Configuration (Optional)

**File:** `backend/.env`

```bash
EMAIL_FROM=noreply@lucine.it
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**For Gmail:**
1. Enable 2-factor authentication
2. Generate app password: https://myaccount.google.com/apppasswords
3. Use app password (not your regular password)

**Used in:**
- `backend/src/services/notification.service.js` - Send email notifications
- `backend/src/controllers/operator.controller.js` - Send operator invitation emails

## Backend Environment Variables

**File:** `backend/.env`

Full example:

```bash
# Database
DATABASE_URL=postgresql://user:password@hostname/database

# Server
NODE_ENV=production
PORT=3001

# JWT
JWT_SECRET=your-random-secret-key-here
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=500

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886

# Email
EMAIL_FROM=noreply@lucine.it
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URLs
SHOPIFY_SITE_URL=https://lucine.it
WIDGET_URL=https://your-widget-url.onrender.com
DASHBOARD_URL=https://your-dashboard-url.onrender.com

# CORS
CORS_ORIGINS=https://lucine.it,https://your-widget-url.onrender.com,https://your-dashboard-url.onrender.com

# Session & Chat
SESSION_TTL_HOURS=24
CHAT_TIMEOUT_MINUTES=5
OPERATOR_TIMEOUT_SECONDS=30

# Knowledge Base
KB_CONFIDENCE_THRESHOLD=0.7
KB_MAX_RESULTS=5
```

## Frontend Environment Variables

### Widget

**File:** `frontend-widget/.env`

```bash
VITE_API_URL=https://your-backend-url.onrender.com/api
VITE_SOCKET_URL=https://your-backend-url.onrender.com
```

### Dashboard

**File:** `frontend-dashboard/.env`

```bash
VITE_API_URL=https://your-backend-url.onrender.com/api
VITE_WS_URL=https://your-backend-url.onrender.com
```

## Testing Locally

For local development, create `backend/.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lucine_chatbot
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=7d

# Add your API keys here
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886

# Optional
EMAIL_FROM=noreply@lucine.it
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

SHOPIFY_SITE_URL=http://localhost:5173
WIDGET_URL=http://localhost:5173
DASHBOARD_URL=http://localhost:5174
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

SESSION_TTL_HOURS=24
CHAT_TIMEOUT_MINUTES=5
OPERATOR_TIMEOUT_SECONDS=30
KB_CONFIDENCE_THRESHOLD=0.7
KB_MAX_RESULTS=5
```

Widget `.env`:
```bash
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

Dashboard `.env`:
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

## Security Notes

1. Never commit `.env` files to git
2. Use different JWT_SECRET in production
3. Rotate API keys periodically
4. Keep Twilio auth token secret
5. Use app passwords for Gmail, not main password

## Required vs Optional

**Required:**
- DATABASE_URL
- OPENAI_API_KEY
- JWT_SECRET

**Optional but recommended:**
- TWILIO credentials (for WhatsApp notifications)
- SMTP credentials (for email notifications)

Without Twilio/SMTP, tickets will be created but no notifications sent.
