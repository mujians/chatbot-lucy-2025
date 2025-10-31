# 🗂️ LUCINE PROJECT STRUCTURE - DEFINITIVE GUIDE

**Created**: 1 Novembre 2025
**Purpose**: Crystal clear documentation of repository structure to prevent confusion and wasted work
**Critical**: Read this BEFORE making any code changes!

---

## 🚨 **CRITICAL: WHICH FILES ARE REAL?**

### ✅ **PRODUCTION CODE (Actually Deployed)**

```
/Users/brnobtt/Desktop/lucine-frontend/
└── src/                              ← ✅ REAL DASHBOARD (TypeScript)
    ├── components/
    │   ├── dashboard/
    │   │   ├── ChatWindow.tsx        ← ✅ EDIT THIS
    │   │   ├── ChatListPanel.tsx     ← ✅ EDIT THIS
    │   │   ├── OperatorSidebar.tsx   ← ✅ EDIT THIS
    │   │   └── TopBar.tsx            ← ✅ EDIT THIS
    │   └── ui/                       ← shadcn/ui components
    ├── pages/
    │   └── Index.tsx                 ← ✅ MAIN DASHBOARD LOGIC
    ├── contexts/
    │   ├── SocketContext.tsx         ← WebSocket setup
    │   └── AuthContext.tsx           ← Authentication
    └── lib/
        ├── api.ts                    ← API calls
        └── axios.ts                  ← Axios config

/Users/brnobtt/Desktop/lucine-backend/
└── src/                              ← ✅ REAL BACKEND (Node.js)
    ├── server.js                     ← ✅ Main entry point
    ├── controllers/                  ← ✅ API route handlers
    │   ├── chat.controller.js
    │   ├── ticket.controller.js
    │   └── analytics.controller.js
    ├── services/
    │   └── websocket.service.js      ← ✅ WebSocket handlers
    └── routes/                       ← ✅ API routes

/Users/brnobtt/Desktop/lucine-minimal/
└── snippets/
    └── chatbot-popup.liquid          ← ✅ WIDGET (Vanilla JS)
```

### ❌ **DEAD CODE (NOT Deployed - DELETE LATER)**

```
/Users/brnobtt/Desktop/lucine-backend/
└── frontend-dashboard/               ❌ IGNORE - Dead code!
    └── src/
        └── components/
            └── ChatWindow.jsx        ❌ DON'T EDIT - JSX version not used!

/Users/brnobtt/Desktop/lucine-frontend/
├── backend/                          ❌ IGNORE - Duplicate
├── frontend-dashboard/               ❌ IGNORE - Duplicate
└── frontend-dashboard-ARCHIVE/       ❌ IGNORE - Old version
```

**⚠️ WARNING**: If you edit files in the "DEAD CODE" folders, your changes will NOT appear in production!

---

## 🏗️ **REPOSITORY ARCHITECTURE**

### **3 Separate GitHub Repositories**

| Local Folder | GitHub Repo | Deployed By | Purpose |
|-------------|-------------|-------------|---------|
| `lucine-frontend` | `mujians/lucine-chatbot` | Render (Vite build) | Dashboard React TypeScript |
| `lucine-backend` | `mujians/chatbot-lucy-2025` | Render (Node.js) | API + WebSocket + Database |
| `lucine-minimal` | `mujians/lucine25minimal` | Shopify Auto-sync | Widget Liquid + Vanilla JS |

---

## 🚀 **DEPLOYMENT PIPELINE**

### **1. Dashboard (lucine-frontend)**

```
Local Edit          Git Push              Render Build           Live
─────────────────────────────────────────────────────────────────────
src/pages/Index.tsx
        │
        ├─> git add src/
        ├─> git commit
        └─> git push origin main
                    │
                    └─> GitHub: mujians/lucine-chatbot
                                    │
                                    └─> Render detects push
                                            │
                                            ├─> npm install
                                            ├─> npm run build (Vite)
                                            │   └─> Builds ONLY src/ folder
                                            │       (Vite config ignores other folders)
                                            └─> Deploy dist/ folder
                                                    │
                                                    └─> Live at dashboard URL
```

**Key Points**:
- Vite builds ONLY `src/` folder (configured in `vite.config.ts`)
- `frontend-dashboard/` folder is IGNORED by Vite
- `backend/` folder is IGNORED by Vite
- Only TypeScript files in `src/` are deployed

**Vite Config**:
```typescript
// vite.config.ts
export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
  },
  // Only src/ is built - other folders ignored!
})
```

### **2. Backend (lucine-backend)**

```
Local Edit          Git Push              Render Start           Live
─────────────────────────────────────────────────────────────────────
src/server.js
        │
        ├─> git add src/
        ├─> git commit
        └─> git push origin main
                    │
                    └─> GitHub: mujians/chatbot-lucy-2025
                                    │
                                    └─> Render detects push
                                            │
                                            ├─> npm install
                                            ├─> npx prisma migrate deploy
                                            ├─> npx prisma generate
                                            └─> npm start
                                                    │
                                                    └─> Runs src/server.js
                                                            │
                                                            └─> Live API + WebSocket
```

**Key Points**:
- Backend runs `npm start` → executes `src/server.js`
- `frontend-dashboard/` folder is NEVER used by backend
- PostgreSQL database on Render

### **3. Widget (lucine-minimal)**

```
Local Edit          Git Push              Shopify Sync           Live
─────────────────────────────────────────────────────────────────────
snippets/chatbot-popup.liquid
        │
        ├─> git add snippets/
        ├─> git commit
        └─> git push origin main
                    │
                    └─> GitHub: mujians/lucine25minimal
                                    │
                                    └─> Shopify Auto-sync
                                            │
                                            └─> Live on store
```

**Key Points**:
- Shopify theme file (Liquid template + vanilla JS)
- No build process - deployed as-is
- Auto-synced to Shopify store

---

## 📂 **CORRECT FILE MAPPING**

### **When Fixing Dashboard Bugs**

| Component | ❌ WRONG FILE (JSX) | ✅ CORRECT FILE (TypeScript) |
|-----------|---------------------|------------------------------|
| Chat Window | `lucine-backend/frontend-dashboard/src/components/ChatWindow.jsx` | `lucine-frontend/src/components/dashboard/ChatWindow.tsx` |
| Chat List | `lucine-backend/frontend-dashboard/src/components/ChatList.jsx` | `lucine-frontend/src/components/dashboard/ChatListPanel.tsx` |
| Main Page | `lucine-backend/frontend-dashboard/src/pages/DashboardPage.jsx` | `lucine-frontend/src/pages/Index.tsx` |
| Sidebar | `lucine-backend/frontend-dashboard/src/components/OperatorManager.jsx` | `lucine-frontend/src/components/dashboard/OperatorSidebar.tsx` |
| WebSocket | `lucine-backend/frontend-dashboard/src/lib/socket.js` | `lucine-frontend/src/contexts/SocketContext.tsx` |

### **When Fixing Backend Issues**

| Component | File Path |
|-----------|-----------|
| WebSocket handlers | `lucine-backend/src/services/websocket.service.js` |
| Chat API | `lucine-backend/src/controllers/chat.controller.js` |
| Ticket API | `lucine-backend/src/controllers/ticket.controller.js` |
| Database schema | `lucine-backend/prisma/schema.prisma` |
| Server setup | `lucine-backend/src/server.js` |

### **When Fixing Widget Issues**

| Component | File Path |
|-----------|-----------|
| Widget UI + Logic | `lucine-minimal/snippets/chatbot-popup.liquid` |
| Widget CSS | `lucine-minimal/assets/chatbot-styles.css` |

---

## 🧪 **HOW TO VERIFY CORRECT FILES**

### **Test 1: Check Vite Build**

```bash
cd /Users/brnobtt/Desktop/lucine-frontend
cat vite.config.ts
# Look for "root" and "build.outDir" - should point to src/
```

### **Test 2: Check Git Remote**

```bash
cd /Users/brnobtt/Desktop/lucine-frontend
git remote get-url origin
# Should be: https://github.com/mujians/lucine-chatbot.git
```

### **Test 3: Check Render Build Logs**

1. Go to Render dashboard
2. Open lucine-chatbot service
3. Check "Logs" tab
4. Look for: `vite build` command
5. Verify it builds `src/` folder

---

## 🗑️ **FOLDERS TO DELETE (After Backup)**

**⚠️ IMPORTANT**: Verify production works BEFORE deleting!

### **In lucine-backend/**
```bash
# These folders serve no purpose and confuse developers:
rm -rf frontend-dashboard/
```

### **In lucine-frontend/**
```bash
# These are duplicates/archives not used by Vite:
rm -rf backend/
rm -rf frontend-dashboard/
rm -rf frontend-dashboard-ARCHIVE/
```

**Safety Procedure**:
1. ✅ Verify dashboard works in production
2. ✅ Create backup: `git tag backup-before-cleanup`
3. ✅ Remove folders locally
4. ✅ Test build: `npm run build`
5. ✅ Commit: `git commit -m "chore: Remove dead code folders"`
6. ✅ Push: `git push origin main`
7. ✅ Verify Render build succeeds
8. ✅ Verify dashboard still works

---

## 🔍 **COMMON MISTAKES TO AVOID**

### ❌ **Mistake 1**: Editing JSX files in `lucine-backend/frontend-dashboard/`
**Why wrong**: These files are not deployed by Render
**Correct**: Edit TypeScript files in `lucine-frontend/src/`

### ❌ **Mistake 2**: Assuming `npm run build` in lucine-backend builds dashboard
**Why wrong**: lucine-backend builds backend only
**Correct**: Dashboard builds from lucine-frontend via Vite

### ❌ **Mistake 3**: Pushing to wrong GitHub repo
**Why wrong**: Each local folder has separate GitHub remote
**Correct**: Check `git remote -v` before pushing

### ❌ **Mistake 4**: Editing files without checking if they're actually used
**Why wrong**: Wasted work on dead code
**Correct**: Check this document FIRST to find correct file

---

## 📋 **QUICK REFERENCE: "I NEED TO FIX..."**

| What to Fix | Which File | Which Repo |
|-------------|------------|------------|
| Operator messages not showing | `lucine-frontend/src/pages/Index.tsx` | lucine-chatbot |
| Chat window UI/layout | `lucine-frontend/src/components/dashboard/ChatWindow.tsx` | lucine-chatbot |
| Widget button appearance | `lucine-minimal/snippets/chatbot-popup.liquid` | lucine25minimal |
| WebSocket events not firing | `lucine-backend/src/services/websocket.service.js` | chatbot-lucy-2025 |
| API endpoints returning errors | `lucine-backend/src/controllers/*.controller.js` | chatbot-lucy-2025 |
| Database schema changes | `lucine-backend/prisma/schema.prisma` | chatbot-lucy-2025 |
| Ticket creation logic | `lucine-backend/src/controllers/ticket.controller.js` | chatbot-lucy-2025 |
| User sees wrong message | `lucine-minimal/snippets/chatbot-popup.liquid` | lucine25minimal |
| Dashboard login/auth | `lucine-frontend/src/contexts/AuthContext.tsx` | lucine-chatbot |
| Sidebar menu items | `lucine-frontend/src/components/dashboard/OperatorSidebar.tsx` | lucine-chatbot |

---

## 🎯 **GOLDEN RULES**

1. **ALWAYS** check this document before editing any file
2. **NEVER** edit files in `lucine-backend/frontend-dashboard/` (dead code)
3. **ALWAYS** edit TypeScript files in `lucine-frontend/src/` for dashboard
4. **VERIFY** git remote before pushing: `git remote -v`
5. **TEST** build locally before pushing: `npm run build`
6. **CHECK** Render logs after deploy to confirm success

---

## 📞 **WHEN IN DOUBT**

Ask yourself:
1. Is this file in `lucine-frontend/src/`? → ✅ Correct for dashboard
2. Is this file in `lucine-backend/src/`? → ✅ Correct for backend
3. Is this file in `lucine-minimal/snippets/`? → ✅ Correct for widget
4. Is this file in `frontend-dashboard/`? → ❌ WRONG - Dead code!

**If confused**: Check `git log --oneline -5` to see recent commits and verify you're in the right repo.

---

**Last Updated**: 1 Novembre 2025, 01:15
**Verified**: Production dashboard uses TypeScript files from lucine-frontend/src/
**Status**: All fixes ported to correct files (commit 44466b4)
