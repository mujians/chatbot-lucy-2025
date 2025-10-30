# Deployment Workflow - Lucine Chatbot

**Ultimo aggiornamento**: 30 Ottobre 2025
**Tipo**: Auto-deploy via GitHub integration

---

## 🎯 OVERVIEW

Il progetto Lucine Chatbot utilizza **auto-deploy automatico** da GitHub:
- **Backend**: Render auto-deploy
- **Widget (Shopify)**: GitHub auto-sync

**Nessuna azione manuale richiesta** - basta pushare su `main`.

---

## 🚀 BACKEND DEPLOYMENT (Render)

### **Repository**
- **Nome**: `lucine-production`
- **URL**: https://github.com/mujians/chatbot-lucy-2025
- **Branch**: `main`

### **Service Render**
- **URL**: https://chatbot-lucy-2025.onrender.com
- **Tipo**: Web Service
- **Region**: Frankfurt (Europe)
- **Instance**: Free tier

### **Workflow**

```bash
# 1. Make changes to backend code
cd /Users/brnobtt/Desktop/lucine-production/backend
# Edit files...

# 2. Commit changes
git add .
git commit -m "fix: description of change"

# 3. Push to GitHub
git push origin main

# 4. Render auto-deploy triggers automatically:
# ✅ Detects push to main branch
# ✅ Pulls latest code
# ✅ Runs: npm install (if package.json changed)
# ✅ Runs: npx prisma generate
# ✅ Runs: npm run deploy (our custom script)
#    └─> node scripts/fix-migration.cjs
#    └─> npx prisma migrate deploy
#    └─> node src/server.js
# ✅ Service live in ~2 minutes
```

### **Build Command** (Render Settings)
```bash
npm install && npx prisma generate
```

### **Start Command** (Render Settings)
```bash
npm run deploy
```

**Note**: `npm run deploy` esegue:
```json
"scripts": {
  "deploy": "node scripts/fix-migration.cjs && npx prisma migrate deploy && node src/server.js"
}
```

### **Environment Variables**
Configurate su Render Dashboard:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Token signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `CLOUDINARY_*` - Cloudinary credentials
- `SMTP_*` - Email service config
- `TWILIO_*` - WhatsApp service config

### **Auto-Deploy Triggers**
- ✅ Push to `main` branch
- ✅ Manual deploy from Render Dashboard
- ✅ Redeploy after settings change

### **Deployment Logs**
Visibili in tempo reale:
1. Vai su https://dashboard.render.com
2. Seleziona `chatbot-lucy-2025`
3. Tab "Logs" per vedere output in real-time

---

## 🎨 WIDGET DEPLOYMENT (Shopify)

### **Repository**
- **Nome**: `lucine-minimal`
- **URL**: https://github.com/mujians/lucine25minimal
- **Branch**: `main`

### **Shopify Store**
- **URL**: https://lucine-di-natale.myshopify.com
- **Theme**: Dawn (customized)
- **Admin**: https://admin.shopify.com/store/lucine-di-natale

### **Workflow**

```bash
# 1. Make changes to widget code
cd /Users/brnobtt/Desktop/lucine-minimal
# Edit snippets/chatbot-popup.liquid

# 2. Commit changes
git add snippets/chatbot-popup.liquid
git commit -m "fix: description of change"

# 3. Push to GitHub
git push origin main

# 4. Shopify auto-sync (GitHub integration):
# ✅ Detects push to main branch
# ✅ Syncs theme files automatically
# ✅ Widget updated live in ~30 seconds
# ✅ No downtime
```

### **GitHub Integration Setup**
La sincronizzazione automatica è configurata tramite:
1. Shopify Admin → Online Store → Themes
2. Theme Actions → "Connect to GitHub"
3. Repository: `mujians/lucine25minimal`
4. Branch: `main`

**Comportamento**:
- ✅ **Auto-pull**: Shopify scarica automaticamente i cambiamenti da GitHub
- ✅ **Instant sync**: Aggiornamenti visibili in 30 secondi
- ✅ **No manual action**: Non serve accedere all'editor Shopify

### **File Widget**
```
lucine-minimal/
├── snippets/
│   └── chatbot-popup.liquid   # Widget principale (~3000 righe)
├── layout/
│   └── theme.liquid            # Include {% render 'chatbot-popup' %}
└── assets/
    └── chatbot-styles.css      # (se esistono stili separati)
```

### **Widget Include**
Il widget è incluso automaticamente in tutte le pagine:
```liquid
<!-- In layout/theme.liquid -->
{% render 'chatbot-popup' %}
```

### **Testing Changes**
Dopo il push:
1. Apri: https://lucine-di-natale.myshopify.com
2. Apri console browser (F12)
3. Cerca: `🤖 Chatbot v4.1` (o numero versione)
4. Verifica log per confermare nuovo codice

---

## 🔄 MIGRATION WORKFLOW

### **Backend Database Migrations**

#### **Create Migration**
```bash
# Local development
cd backend
npx prisma migrate dev --name description_of_change

# Questo crea:
# backend/prisma/migrations/YYYYMMDD_description/migration.sql
```

#### **Deploy Migration**
```bash
# Commit migration file
git add backend/prisma/migrations/
git commit -m "feat: add new migration"
git push origin main

# Render auto-deploy will run:
# npx prisma migrate deploy
# (applies pending migrations automatically)
```

#### **Migration Script** (per failed migrations)
Il nostro script custom gestisce migration fallite:
```javascript
// backend/scripts/fix-migration.cjs
// Runs BEFORE migrate deploy
// Marks failed migrations as rolled back
// Allows re-application of fixed migration
```

### **Widget Schema Changes**
No migrations needed - è solo codice JavaScript/Liquid.

---

## 🐛 TROUBLESHOOTING

### **Backend Deployment Fails**

**Problema**: Build fallisce su Render
**Soluzione**:
1. Controlla Render Logs
2. Verifica syntax errors nel codice
3. Verifica package.json dependencies
4. Controlla environment variables

**Problema**: Migration fallisce
**Soluzione**:
```bash
# Il fix-migration.cjs script dovrebbe gestirlo automaticamente
# Se persiste, rollback manuale via Render Shell:
npx prisma migrate resolve --rolled-back "migration_name"
```

**Problema**: Server crashes dopo deploy
**Soluzione**:
1. Render Logs → cerca stack trace
2. Rollback deploy da Render Dashboard
3. Fix code locally
4. Re-push quando fixato

---

### **Widget Deployment Issues**

**Problema**: Modifiche non visibili
**Soluzione 1 - Cache Browser**:
```bash
# Clear cache + hard reload
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Soluzione 2 - Verifica Sync**:
1. Shopify Admin → Themes
2. Actions → "View on GitHub"
3. Verifica ultimo commit corrisponde
4. Se non synced, click "Sync from GitHub"

**Problema**: Syntax error in Liquid
**Soluzione**:
1. Shopify mostra errore nel theme editor
2. Fix syntax error locally
3. Re-push to GitHub

---

## 📊 DEPLOYMENT MONITORING

### **Backend Health Checks**

**Endpoint**: `GET /api/health`
```bash
curl https://chatbot-lucy-2025.onrender.com/api/health
# Response: { "status": "ok", "timestamp": "..." }
```

**Render Dashboard**:
- CPU usage
- Memory usage
- Response times
- Error rates

### **Widget Health Checks**

**Console Logs**:
```javascript
// Look for these in browser console:
console.log('🤖 Chatbot v4.1 - Dynamic Settings + Socket.IO');
console.log('🔌 Connecting to Socket.IO:', SOCKET_URL);
console.log('✅ Socket.IO connected');
```

**Errori comuni**:
- `Failed to load resource` → Backend down
- `CORS error` → Backend CORS config issue
- `WebSocket connection failed` → Socket.IO issue

---

## 🔐 SECURITY NOTES

### **Backend**
- ✅ Environment variables on Render (not in code)
- ✅ JWT_SECRET not exposed
- ✅ DATABASE_URL encrypted
- ✅ HTTPS only (Render provides SSL)

### **Widget**
- ✅ BACKEND_URL hardcoded (public endpoint)
- ✅ No secrets in widget code
- ✅ Session tokens in localStorage (secure)
- ❌ Shopify theme code is public (by design)

---

## 📝 DEPLOYMENT CHECKLIST

### **Before Push**
- [ ] Code tested locally
- [ ] No syntax errors
- [ ] Dependencies up to date
- [ ] Migration tested (if applicable)
- [ ] Environment variables configured

### **After Push**
- [ ] GitHub push successful
- [ ] Auto-deploy triggered
- [ ] Deployment logs checked
- [ ] Health check passed
- [ ] Features tested in production

### **Rollback Plan**
```bash
# Backend - Render Dashboard
1. Go to Render Dashboard
2. Select service → "Manual Deploy"
3. Select previous commit from dropdown
4. Click "Deploy"

# Widget - Git revert
git revert HEAD
git push origin main
# Shopify auto-syncs the revert
```

---

## 🎯 BEST PRACTICES

### **Git Workflow**
```bash
# 1. Always pull before making changes
git pull origin main

# 2. Make focused changes
# One feature/fix per commit

# 3. Test locally before push
npm run dev  # Backend
# (Widget test in Shopify preview)

# 4. Descriptive commit messages
git commit -m "fix: validate session on restore (widget #10)"

# 5. Push to trigger deploy
git push origin main

# 6. Monitor deployment
# Watch Render logs or Shopify sync
```

### **Deployment Timing**
- ✅ **Low traffic hours**: 02:00-06:00 CET
- ✅ **Not during events**: Avoid when tickets on sale
- ✅ **After business hours**: Not 18:00-22:00
- ✅ **With monitoring**: Watch first 15 minutes

### **Rollback Speed**
- Backend: ~2 minutes (manual deploy)
- Widget: ~30 seconds (git revert + push)

---

## 📚 RELATED DOCS

- **Architecture**: `SYSTEM_ARCHITECTURE_MAP.md`
- **Fixes Deployed**: `AUDIT_FIXES_DEPLOYED.md`
- **Render Setup**: `RENDER_DEPLOYMENT.md`
- **Current Status**: `CURRENT_STATUS.md`

---

**Last Updated**: 30 Ottobre 2025, 03:45
**Maintained By**: Development team
**Questions**: Check GitHub issues or docs
