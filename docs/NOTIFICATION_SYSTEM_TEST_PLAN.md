# Notification System - Test Plan

**Data**: 30 Ottobre 2025
**Versione**: 1.0
**Status**: Ready for Testing

---

## 📋 Overview

This test plan covers the comprehensive notification system implemented for both the widget (user-facing) and dashboard (operator-facing) components of the Lucine Chatbot.

### Components Tested
1. **Widget Notifications** (User-Side)
   - Dynamic badge counter
   - Audio notifications
   - Browser push notifications

2. **Dashboard Notifications** (Operator-Side)
   - Operator notification preferences UI
   - Preference respect logic
   - Quiet hours functionality

---

## ✅ Implementation Summary

### Widget (lucine-minimal/snippets/chatbot-popup.liquid)
| Feature | Status | Lines |
|---------|--------|-------|
| Dynamic badge counter | ✅ Already Implemented | 803-817 |
| Audio notifications | ✅ Implemented | 805-836 |
| Browser notifications | ✅ Implemented | 838-900 |
| Integration on first message | ✅ Implemented | 1571-1575 |
| Integration on operator message | ✅ Implemented | 2299-2316 |

### Dashboard (lucine-production)
| Feature | Status | Files |
|---------|--------|-------|
| Settings UI | ✅ Implemented | SettingsPanel.jsx |
| Preference loading | ✅ Implemented | notification.service.ts |
| Quiet hours logic | ✅ Implemented | notification.service.ts |
| Audio respect logic | ✅ Implemented | notification.service.ts |
| InApp respect logic | ✅ Implemented | notification.service.ts |

---

## 🧪 Test Cases

### Test Suite 1: Widget Audio Notifications

#### TC1.1: Audio Unlock on First Message
**Preconditions**: User has not interacted with widget yet
**Steps**:
1. Open widget
2. Send first message to operator
3. Verify audio unlock is triggered

**Expected Result**:
- Console log: "🔓 Audio context unlocked"
- Audio is ready to play on subsequent notifications

**Status**: ⏳ Not Tested

---

#### TC1.2: Audio Plays on Operator Message
**Preconditions**: Widget popup is closed or window not focused
**Steps**:
1. Operator sends a message
2. Observe if audio notification plays

**Expected Result**:
- Console log: "🔔 Notification sound played"
- Audio beep sound is heard

**Status**: ⏳ Not Tested

---

#### TC1.3: Audio Doesn't Play if Widget is Open and Focused
**Preconditions**: Widget popup is open and window has focus
**Steps**:
1. Open widget popup
2. Operator sends message
3. Verify audio doesn't play (since user is watching)

**Expected Result**:
- No audio sound
- Console log: "👀 User is watching - skipping notification"

**Status**: ⏳ Not Tested

---

### Test Suite 2: Widget Browser Notifications

#### TC2.1: Permission Request After First Message
**Preconditions**: User has not granted notification permission
**Steps**:
1. Open widget
2. Send first message
3. Browser should request notification permission

**Expected Result**:
- Browser notification permission dialog appears
- Console log: "🔔 Notification permission: [granted/denied]"

**Status**: ⏳ Not Tested

---

#### TC2.2: Browser Notification Shows on Operator Message
**Preconditions**:
- Notification permission granted
- Widget popup is closed or window not focused

**Steps**:
1. Operator sends message: "Ciao! Come posso aiutarti?"
2. Observe browser notification

**Expected Result**:
- Browser notification appears with:
  - Title: "Operatore ha risposto" (or operator name)
  - Body: Message preview (max 50 chars)
  - Icon: Lucine logo
- Notification auto-closes after 5 seconds
- Clicking notification focuses window and opens widget

**Status**: ⏳ Not Tested

---

#### TC2.3: No Browser Notification if Widget is Open and Focused
**Preconditions**: Widget popup is open, window has focus
**Steps**:
1. Operator sends message
2. Verify no browser notification appears

**Expected Result**:
- No browser notification
- Console log: "👀 User is watching - skipping notification"

**Status**: ⏳ Not Tested

---

### Test Suite 3: Widget Badge Counter

#### TC3.1: Badge Increments on New Message
**Preconditions**: Widget popup is closed
**Steps**:
1. Close widget popup
2. Operator sends 3 messages
3. Observe badge counter

**Expected Result**:
- Badge shows "3"
- Badge is visible on widget button

**Status**: ⏳ Not Tested

---

#### TC3.2: Badge Shows "9+" for 10+ Messages
**Preconditions**: Widget popup is closed
**Steps**:
1. Operator sends 12 messages
2. Observe badge counter

**Expected Result**:
- Badge shows "9+"

**Status**: ⏳ Not Tested

---

#### TC3.3: Badge Resets When Widget Opens
**Preconditions**: Badge shows count > 0
**Steps**:
1. Click widget button to open popup
2. Observe badge counter

**Expected Result**:
- Badge resets to 0
- Badge disappears from widget button

**Status**: ⏳ Not Tested

---

### Test Suite 4: Dashboard Settings UI

#### TC4.1: Load Operator Preferences
**Preconditions**: Operator is logged in
**Steps**:
1. Navigate to Settings > Notifiche tab
2. Observe loaded preferences

**Expected Result**:
- All preference toggles show current state
- Quiet hours show current values
- No loading errors in console

**Status**: ⏳ Not Tested

---

#### TC4.2: Save Notification Preferences
**Preconditions**: In Settings > Notifiche tab
**Steps**:
1. Toggle "Audio > Nuova chat" OFF
2. Change quiet hours to "23:00" - "07:00"
3. Click "💾 Salva Preferenze"
4. Verify save success

**Expected Result**:
- Alert: "✅ Preferenze notifiche salvate con successo!"
- Console log: "✅ Preferences saved..."
- Backend receives PUT request to `/api/operators/{id}`

**Status**: ⏳ Not Tested

---

#### TC4.3: Preferences Persist After Reload
**Preconditions**: Preferences saved in TC4.2
**Steps**:
1. Refresh dashboard page
2. Navigate to Settings > Notifiche
3. Verify saved preferences are still applied

**Expected Result**:
- "Audio > Nuova chat" is still OFF
- Quiet hours still show "23:00" - "07:00"

**Status**: ⏳ Not Tested

---

### Test Suite 5: Dashboard Preference Respect

#### TC5.1: Audio Respects Toggle Settings
**Preconditions**:
- Operator has "Audio > Nuova chat" set to OFF
- Operator has "Audio > Messaggio in chat" set to ON

**Steps**:
1. New chat arrives (should NOT play sound)
2. User sends message in existing chat (should play sound)

**Expected Result**:
- No audio for new chat
- Audio plays for chat message

**Status**: ⏳ Not Tested

---

#### TC5.2: Quiet Hours Disable Audio and Browser Notifications
**Preconditions**:
- Current time is within quiet hours (e.g., 23:30, quiet hours 22:00-08:00)
- All audio/inApp preferences are ON

**Steps**:
1. New chat arrives
2. User sends message

**Expected Result**:
- No audio notifications
- No browser notifications
- Email/WhatsApp still work (if enabled)

**Status**: ⏳ Not Tested

---

#### TC5.3: Quiet Hours Respect Midnight Crossover
**Preconditions**: Quiet hours set to "22:00" - "08:00"
**Steps**:
1. Test at 21:59 (before quiet hours)
2. Test at 22:01 (during quiet hours)
3. Test at 00:30 (during quiet hours, after midnight)
4. Test at 08:01 (after quiet hours)

**Expected Result**:
- 21:59: Audio and notifications work
- 22:01: Audio and notifications blocked
- 00:30: Audio and notifications blocked
- 08:01: Audio and notifications work

**Status**: ⏳ Not Tested

---

#### TC5.4: InApp Toggle Respects Per-Event Settings
**Preconditions**:
- "InApp > Nuova chat" = OFF
- "InApp > Messaggio in chat" = ON

**Steps**:
1. New chat arrives (should NOT show browser notification)
2. User sends message (should show browser notification)

**Expected Result**:
- No browser notification for new chat
- Browser notification for chat message

**Status**: ⏳ Not Tested

---

### Test Suite 6: Integration Tests

#### TC6.1: End-to-End Notification Flow
**Preconditions**: Clean state
**Steps**:
1. User opens widget, sends first message
2. Audio unlocks, permission requested
3. Operator joins chat
4. Operator sends message with widget closed
5. User opens widget (badge resets)
6. User sends reply with widget open
7. Operator receives notifications based on preferences

**Expected Result**:
- All steps work smoothly
- No console errors
- Notifications respect preferences at each step

**Status**: ⏳ Not Tested

---

#### TC6.2: Preference Changes Apply Immediately
**Preconditions**: Dashboard open in one tab, test widget in another
**Steps**:
1. Save preference change (e.g., disable audio for new chat)
2. Trigger new chat event
3. Verify audio doesn't play

**Expected Result**:
- Preferences load on next notification
- New behavior applies immediately

**Status**: ⏳ Not Tested

---

## 🐛 Known Issues / Limitations

### Limitation 1: Preference Reload Timing
**Issue**: Notification service loads preferences on construction only. Changes saved in Settings will apply on:
- Next page reload
- Next notification event (preferences re-checked per event)

**Workaround**: Preferences are checked per-event, so they apply correctly. Just no immediate feedback in console.

**Priority**: Low (works correctly, just delayed logging)

---

### Limitation 2: Widget Audio Autoplay Policy
**Issue**: Browsers block audio autoplay until user interaction
**Solution**: Implemented audio unlock on first message send
**Status**: Working as designed

---

## 📊 Test Execution Summary

| Test Suite | Total | Passed | Failed | Blocked | Not Tested |
|------------|-------|--------|--------|---------|------------|
| Widget Audio | 3 | 0 | 0 | 0 | 3 |
| Widget Browser | 3 | 0 | 0 | 0 | 3 |
| Widget Badge | 3 | 0 | 0 | 0 | 3 |
| Settings UI | 3 | 0 | 0 | 0 | 3 |
| Preference Respect | 4 | 0 | 0 | 0 | 4 |
| Integration | 2 | 0 | 0 | 0 | 2 |
| **TOTAL** | **18** | **0** | **0** | **0** | **18** |

**Overall Status**: ⏳ Ready for Testing

---

## 🚀 Test Environment Setup

### Prerequisites
1. Backend running: `https://chatbot-lucy-2025.onrender.com`
2. Widget deployed: `https://lucine-di-natale.myshopify.com`
3. Dashboard running: `http://localhost:5173` (or deployed URL)
4. Test operator account with known ID
5. Test browser with notification permissions enabled

### Test Data
- **Test Operator**: Use existing operator account
- **Operator ID**: Available in localStorage after login
- **Default Preferences**: Should load from backend

### Tools
- Browser DevTools Console (for logs)
- Network tab (for API requests)
- Application tab (for localStorage inspection)

---

## 📝 Test Execution Notes

### How to Run Tests

#### For Widget Tests:
1. Open Shopify store in browser
2. Open DevTools console
3. Follow test case steps
4. Observe console logs and behavior
5. Document results

#### For Dashboard Tests:
1. Login to dashboard
2. Open DevTools console
3. Navigate to Settings > Notifiche
4. Follow test case steps
5. Verify API calls in Network tab
6. Document results

#### For Integration Tests:
1. Open widget in one browser tab
2. Open dashboard in another tab
3. Position windows side-by-side
4. Follow test case steps
5. Observe behavior in both windows
6. Document results

---

## ✅ Acceptance Criteria

### Widget Acceptance
- [ ] Audio plays on operator message (when popup closed)
- [ ] Browser notifications show (when popup closed)
- [ ] Badge counter updates correctly
- [ ] No notifications when widget is open and focused
- [ ] Audio unlocks after first user interaction

### Dashboard Acceptance
- [ ] Settings UI loads preferences correctly
- [ ] Settings save successfully
- [ ] Preferences persist after reload
- [ ] Audio respects per-event toggles
- [ ] Browser notifications respect per-event toggles
- [ ] Quiet hours block audio and notifications correctly
- [ ] Quiet hours respect midnight crossover

### Overall Acceptance
- [ ] No console errors in any test
- [ ] All 18 test cases pass
- [ ] System is stable under normal use
- [ ] Performance is acceptable (no lag)

---

## 🔄 Regression Testing

After fixes or changes, re-run:
1. All failed test cases
2. Related test cases
3. Integration tests (TC6.1, TC6.2)

---

## 📞 Issues & Support

**If tests fail**:
1. Document exact steps to reproduce
2. Capture console logs
3. Capture network requests
4. Note browser/OS version
5. Report to development team

**Test Owner**: Development Team
**Last Updated**: 30 Ottobre 2025
**Next Review**: After first test execution

---

**Status Legend**:
- ✅ Passed
- ❌ Failed
- ⏸️ Blocked
- ⏳ Not Tested
- 🔄 Retest Required
