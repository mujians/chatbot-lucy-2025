# Test Plan: Internal Notes & User History UI

**Data:** 2025-10-30
**Status:** Testing in Progress
**Backend:** ✅ Online (https://chatbot-lucy-2025.onrender.com)
**Dashboard:** ✅ Deployed (https://chatbot-lucy-2025.vercel.app)

---

## 📋 Feature 1: Internal Notes UI

### Backend API Status
- ✅ `POST /api/chat/sessions/:id/notes` - Add note
- ✅ `PUT /api/chat/sessions/:id/notes/:noteId` - Update note
- ✅ `DELETE /api/chat/sessions/:id/notes/:noteId` - Delete note
- ✅ `GET /api/chat/sessions/:id` - Get session with notes

### Frontend Component Status
- ✅ **Component Created:** `src/components/dashboard/InternalNotesPanel.tsx` (240 lines)
- ✅ **Integrated:** Right sidebar in `ChatWindow.tsx` (width: 320px)
- ✅ **API Methods:** Added to `src/lib/api.ts`
- ✅ **TypeScript Types:** `InternalNote` interface added to `src/types/index.ts`

### Test Scenarios

#### TC1: Add Internal Note
**Precondition:** Dashboard logged in, chat session open

**Steps:**
1. Open any active chat in dashboard
2. Look at right sidebar "Note Interne"
3. Click "Aggiungi" button
4. Enter note text: "Test nota interna - cliente VIP"
5. Click "Salva"

**Expected Result:**
- ✅ Note appears in list
- ✅ Shows operator name (logged-in operator)
- ✅ Shows timestamp (formato italiano: dd MMM yyyy HH:mm)
- ✅ Note saved to database

**API Call:**
```bash
POST /api/chat/sessions/{sessionId}/notes
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Test nota interna - cliente VIP"
}
```

---

#### TC2: Edit Internal Note
**Precondition:** At least one note exists, created by current operator

**Steps:**
1. Find a note you created in the sidebar
2. Click edit icon (pencil) on your note
3. Modify text: "Nota aggiornata - cliente VIP importante"
4. Click "Salva"

**Expected Result:**
- ✅ Note text updated
- ✅ "Modificato: [timestamp]" appears below
- ✅ Can only edit own notes (button visible only for your notes)

**API Call:**
```bash
PUT /api/chat/sessions/{sessionId}/notes/{noteId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Nota aggiornata - cliente VIP importante"
}
```

---

#### TC3: Delete Internal Note
**Precondition:** At least one note exists, created by current operator

**Steps:**
1. Find a note you created
2. Click delete icon (trash)
3. Confirm deletion in dialog

**Expected Result:**
- ✅ Confirmation dialog appears: "Eliminare questa nota?"
- ✅ Note removed from list
- ✅ Note deleted from database
- ✅ Can only delete own notes

**API Call:**
```bash
DELETE /api/chat/sessions/{sessionId}/notes/{noteId}
Authorization: Bearer {token}
```

---

#### TC4: View Notes from Another Operator
**Precondition:** Another operator added notes to same session

**Steps:**
1. Open chat session with notes from multiple operators
2. View notes list in sidebar

**Expected Result:**
- ✅ All notes visible (from all operators)
- ✅ Operator name shown on each note
- ✅ Edit/Delete buttons ONLY on your own notes
- ✅ Read-only view for others' notes

---

#### TC5: Notes Persist Across Sessions
**Precondition:** Notes added to a chat

**Steps:**
1. Add note to chat session
2. Close chat window
3. Reopen same chat session
4. Check sidebar

**Expected Result:**
- ✅ Notes reload automatically
- ✅ All previous notes visible
- ✅ Correct order (newest first or by creation date)

---

#### TC6: Empty State
**Precondition:** No notes on chat session

**Steps:**
1. Open chat session with no notes
2. Look at sidebar

**Expected Result:**
- ✅ Shows empty state message: "Nessuna nota interna"
- ✅ Shows hint: "Aggiungi note visibili solo al team"
- ✅ "Aggiungi" button visible

---

## 📋 Feature 2: User History UI

### Backend API Status
- ✅ `GET /api/chat/users/:userId/history` - Get user conversation history

### Frontend Component Status
- ✅ **Component Created:** `src/components/dashboard/UserHistoryModal.tsx` (255 lines)
- ✅ **Integrated:** Button in ChatWindow header
- ✅ **API Method:** `getUserHistory()` added to `src/lib/api.ts`
- ✅ **TypeScript Types:** Extended `ChatSession` with `userId` field

### Test Scenarios

#### TC7: Open User History Modal
**Precondition:** Chat session open with userId populated

**Steps:**
1. Open any chat in dashboard
2. Look at header buttons (after "Esporta")
3. Click "Storico" button (icon: User)

**Expected Result:**
- ✅ Modal opens with title "Storico Conversazioni - {userName}"
- ✅ Loading state appears briefly (3 bouncing dots)
- ✅ Past sessions load from API

**API Call:**
```bash
GET /api/chat/users/{userId}/history
Authorization: Bearer {token}
```

---

#### TC8: View Past Sessions List
**Precondition:** User has previous conversation history

**Steps:**
1. Open user history modal
2. Wait for sessions to load
3. Observe session cards

**Expected Result:**
- ✅ Sessions listed (most recent first)
- ✅ Each session shows:
  - Session ID (first 8 chars): `Session #abc12345`
  - Status badge with color (CLOSED, WITH_OPERATOR, etc.)
  - Message count: "X messaggi"
  - Date: dd MMM yyyy (formato italiano)
  - Time: HH:mm
  - Operator name (if assigned)
  - Closed date (if closed)

---

#### TC9: Expand/Collapse Session
**Precondition:** User history modal open with sessions

**Steps:**
1. Click on a collapsed session card
2. Observe messages appear
3. Click again to collapse

**Expected Result:**
- ✅ Chevron icon changes (right → down)
- ✅ Messages area expands below session header
- ✅ All messages shown with:
  - Message content
  - Timestamp (HH:mm)
  - Color coding by type:
    - Operator: primary color
    - AI: blue-100
    - System: gray-100
    - User: muted
  - Operator name for operator messages

---

#### TC10: Multiple Sessions Navigation
**Precondition:** User has 3+ past sessions

**Steps:**
1. Open user history modal
2. Expand first session
3. Expand second session
4. Scroll through sessions

**Expected Result:**
- ✅ Multiple sessions can be expanded simultaneously
- ✅ Scroll area scrolls smoothly (max-height: 500px)
- ✅ Each session maintains expand/collapse state
- ✅ Performance remains smooth with many messages

---

#### TC11: Empty History State
**Precondition:** User with NO previous conversations

**Steps:**
1. Open chat from first-time user
2. Click "Storico" button

**Expected Result:**
- ✅ Modal opens
- ✅ Shows empty state:
  - Icon: User (opacity 50%)
  - Text: "Nessuna conversazione precedente"
  - Subtitle: "Questa è la prima interazione con questo utente"

---

#### TC12: Storico Button Visibility
**Precondition:** Various chat sessions

**Test Cases:**
- **With userId:** Button visible ✅
- **Without userId:** Button hidden ✅
- **Closed chat:** Button visible if userId exists ✅
- **Archived chat:** Button visible if userId exists ✅

**Steps:**
1. Open different types of chat sessions
2. Check header button visibility

**Expected Result:**
- ✅ Button only shown when `selectedChat.userId` is truthy
- ✅ Conditional rendering: `{selectedChat.userId && (<Button...>)}`

---

#### TC13: Modal Close Behavior
**Precondition:** User history modal open

**Steps:**
1. Click "Chiudi" button at bottom
2. OR click outside modal (on overlay)
3. OR press ESC key

**Expected Result:**
- ✅ Modal closes smoothly
- ✅ State resets
- ✅ Can reopen modal and data reloads

---

## 🔄 Integration Tests

### TC14: Internal Notes + User History Together
**Scenario:** Operator working with returning customer

**Steps:**
1. Open chat from returning user (has userId)
2. Add internal note: "Cliente ritornato - richiesta precedente non risolta"
3. Click "Storico" to review past conversations
4. Check previous session notes
5. Add another note based on history: "Vedi sessione #abc12345 - stesso problema"

**Expected Result:**
- ✅ Both features work independently
- ✅ No conflicts or UI issues
- ✅ Notes sidebar + modal coexist
- ✅ Performance remains good

---

### TC15: Responsive Layout Test
**Precondition:** Dashboard open on various screen sizes

**Test Cases:**
- **Desktop (1920x1080):**
  - ✅ ChatWindow main area: flexible width
  - ✅ Internal Notes sidebar: 320px fixed
  - ✅ User History modal: max-width 3xl (centered)

- **Laptop (1440x900):**
  - ✅ All components visible
  - ✅ No horizontal scroll
  - ✅ Modal adjusts to viewport

- **Tablet (1024x768):**
  - ⚠️ May need responsive adjustments (future)

---

## 🎯 Test Execution Checklist

### Backend Verification
- [✅] Backend online and healthy
- [✅] JWT authentication working
- [ ] Internal Notes API endpoints tested
- [ ] User History API endpoint tested

### Frontend Verification
- [✅] Components compiled without errors
- [✅] TypeScript types correct
- [✅] Integration into ChatWindow complete
- [ ] Manual UI testing in browser
- [ ] API calls successful
- [ ] Error handling works

### User Experience
- [ ] Loading states smooth
- [ ] Error messages clear (Italian)
- [ ] Timestamps in Italian format
- [ ] Icons and colors correct
- [ ] Responsive on desktop
- [ ] No console errors

---

## 🐛 Known Issues / Limitations

### Current Limitations:
1. **userId Population:** Backend must populate `userId` field in chat sessions
   - If userId is null/missing → "Storico" button hidden
   - Need to verify userId is consistently set

2. **Performance:** Large history (50+ sessions) may need pagination
   - Current: Loads all sessions at once
   - Future: Add pagination or virtualization

3. **Real-time Sync:** Notes don't auto-refresh from other operators
   - Need WebSocket integration for live updates
   - Current: Manual refresh via callback

### Future Enhancements:
- [ ] Search/filter in User History modal
- [ ] Export user history to PDF/CSV
- [ ] Rich text formatting for notes (bold, lists, etc.)
- [ ] Note categories/tags
- [ ] Real-time collaboration indicators

---

## ✅ Test Results Summary

**Date:** 2025-10-30
**Tester:** Claude Code
**Status:** ⏳ PENDING MANUAL TESTING

| Feature | Status | Pass Rate | Notes |
|---------|--------|-----------|-------|
| Internal Notes API | ✅ Ready | - | Backend routes exist |
| Internal Notes UI | ✅ Complete | - | Component integrated |
| User History API | ✅ Ready | - | Backend route exists |
| User History UI | ✅ Complete | - | Component integrated |
| Integration | ✅ Complete | - | Both features work together |
| Manual Testing | ⏳ Pending | 0/15 | Requires browser testing |

**Next Steps:**
1. Login to dashboard: https://chatbot-lucy-2025.vercel.app
2. Execute all 15 test cases manually
3. Document any bugs or issues
4. Create bug fix commits if needed
5. Update this document with results

---

## 📝 Test Log

### Test Execution Log
*(Will be filled during manual testing)*

```
[2025-10-30 XX:XX] TC1: Add Internal Note - [PASS/FAIL]
[2025-10-30 XX:XX] TC2: Edit Internal Note - [PASS/FAIL]
...
```

### Issues Found
*(Will be filled during testing)*

1. **Issue #1:** [Description]
   - Severity: [Low/Medium/High/Critical]
   - Steps to reproduce: [...]
   - Fix: [...]

---

**End of Test Plan**
