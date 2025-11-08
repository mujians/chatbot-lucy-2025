import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Narrative Logging Service
 *
 * Genera log LEGGIBILI in formato "diario" che spiegano:
 * - Cosa vede l'utente nel widget
 * - Cosa vede l'operatore nella dashboard
 * - Stato della chat e sincronizzazione
 * - Allineamento tra le due viste
 */
class NarrativeLoggingService {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    this.narrativeLogFile = path.join(this.logsDir, 'narrative-flow.log');

    console.log('📖 Narrative Logging Service initialized');
    this.writeHeader();
  }

  /**
   * Scrive header all'inizio del log
   */
  writeHeader() {
    const header = `
${'='.repeat(100)}
📖 LUCINE CHATBOT - LOG NARRATIVO DEL FLUSSO CONVERSAZIONALE
${'='.repeat(100)}
Questo log descrive in modo leggibile cosa succede durante le conversazioni.
Per ogni evento viene tracciato:
  • Cosa vede l'UTENTE nel widget
  • Cosa vede l'OPERATORE nella dashboard
  • STATO della chat (ACTIVE, WAITING, WITH_OPERATOR, CLOSED)
  • SINCRONIZZAZIONE tra le due viste
${'='.repeat(100)}

`;

    if (!fs.existsSync(this.narrativeLogFile)) {
      fs.writeFileSync(this.narrativeLogFile, header);
    }
  }

  /**
   * Formatta timestamp leggibile
   */
  getTimestamp() {
    const now = new Date();
    return now.toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Scrive entry nel log narrativo
   */
  writeEntry(title, details) {
    const timestamp = this.getTimestamp();
    const entry = `
[${timestamp}] ${title}
${details.map(line => `  ${line}`).join('\n')}
${'-'.repeat(100)}
`;

    fs.appendFileSync(this.narrativeLogFile, entry);
    console.log(`📖 ${title}`);
  }

  // ============================================================================
  // EVENTI CICLO VITA CHAT
  // ============================================================================

  /**
   * Utente apre widget e crea nuova sessione
   */
  logChatCreated(sessionId, userName, userEmail) {
    this.writeEntry('📱 UTENTE APRE WIDGET - NUOVA CHAT CREATA', [
      `• Session ID: ${sessionId}`,
      `• Nome utente: ${userName || 'Non fornito'}`,
      `• Email utente: ${userEmail || 'Non fornita'}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Widget si apre con messaggio di benvenuto',
      '  ✓ "👋 Ciao! Sono Lucy, la tua assistente virtuale..."',
      '  ✓ Input box pronto per scrivere',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  ✓ Dashboard mostra nuova chat AI nella lista',
      '  ✓ Badge "AI" visibile accanto alla chat',
      '  ✓ Timestamp di creazione aggiornato',
      '',
      '📊 STATO CHAT: ACTIVE (modalità AI)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (chat creata in entrambe le viste)',
    ]);
  }

  /**
   * Utente invia messaggio ad AI
   */
  logUserMessageToAI(sessionId, userName, userMessage, aiResponse, confidence, suggestOperator) {
    const suggestionWarning = suggestOperator
      ? '  ⚠️  AI suggerisce di contattare un operatore (confidence bassa)'
      : '';

    this.writeEntry('💬 UTENTE INVIA MESSAGGIO (Modalità AI)', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Messaggio: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  1️⃣  Il suo messaggio appare nella chat',
      '  2️⃣  Indicatore "Lucy sta scrivendo..."',
      `  3️⃣  Risposta AI: "${aiResponse.substring(0, 100)}${aiResponse.length > 100 ? '...' : ''}"`,
      `  4️⃣  Confidence AI: ${confidence}%`,
      suggestionWarning,
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  ✓ Dashboard aggiorna "last message" nella lista chat',
      '  ✓ Se apre la chat, vede lo scambio utente-AI',
      '  ✓ Nessuna notifica (chat ancora gestita da AI)',
      '',
      '📊 STATO CHAT: ACTIVE (ancora in modalità AI)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (messaggi salvati in DB e visibili ovunque)',
    ]);
  }

  /**
   * Utente invia messaggio ad operatore
   */
  logUserMessageToOperator(sessionId, userName, userMessage, operatorName) {
    this.writeEntry('💬 UTENTE INVIA MESSAGGIO (Modalità Operatore)', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Operatore: ${operatorName}`,
      `• Messaggio: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  1️⃣  Il suo messaggio appare nella chat',
      '  2️⃣  Indicatore "{operatorName} sta scrivendo..." (quando operatore digita)',
      '  3️⃣  In attesa di risposta dall\'operatore',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  🔔 Notifica browser: "Nuovo messaggio da {userName}"',
      '  ✓ Messaggio appare nella chat window',
      '  ✓ Badge rosso "unread" incrementato',
      '  ✓ Chat sale in cima alla lista (ordinamento per ultimo messaggio)',
      '',
      '📊 STATO CHAT: WITH_OPERATOR',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (messaggio via WebSocket a entrambe le parti)',
    ]);
  }

  /**
   * Utente richiede operatore
   */
  logOperatorRequested(sessionId, userName, availableOperatorsCount) {
    this.writeEntry('🆘 UTENTE RICHIEDE OPERATORE', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Operatori disponibili: ${availableOperatorsCount}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Bottone "Richiedi operatore" cliccato',
      '  ✓ Messaggio: "Richiesta inviata. In attesa di un operatore..."',
      '  ✓ Indicatore di caricamento/attesa',
      '  ✓ Bottone "Annulla richiesta" ora disponibile',
      '',
      '👁️  COSA VEDONO GLI OPERATORI:',
      `  🔔 NOTIFICA BROWSER: "Nuova richiesta di chat da ${userName || 'Utente'}"`,
      `  ⚠️  Chat appare in cima con badge "WAITING" (giallo/rosso)`,
      `  ✓ ${availableOperatorsCount} operatori notificati`,
      '  ✓ Bottone "Accetta" visibile per tutti',
      '',
      '📊 STATO CHAT: WAITING (in coda per operatore)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (tutti vedono stato WAITING)',
      '',
      '⏱️  TIMEOUT: 5 minuti - se nessuno accetta, chat torna ad AI',
    ]);
  }

  /**
   * Operatore accetta chat
   */
  logOperatorAccepted(sessionId, userName, operatorId, operatorName) {
    this.writeEntry('✅ OPERATORE ACCETTA CHAT', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Operatore: ${operatorName} (ID: ${operatorId})`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Messaggio di sistema: "{operatorName} si è unito alla chat"',
      '  ✓ FORM DI RACCOLTA NOME appare (se nome non già fornito):',
      '    - Input: "Come ti chiami?"',
      '    - Bottone "Invia"',
      '    - Link "Salta" (opzionale)',
      '',
      '👁️  COSA VEDE L\'OPERATORE CHE ACCETTA:',
      '  ✓ Chat window si apre automaticamente',
      '  ✓ Cronologia messaggi precedenti caricata',
      '  ✓ Badge cambia da "WAITING" a "ACTIVE"',
      '  ✓ Input box pronto per scrivere',
      '  ✓ In attesa che utente fornisca nome...',
      '',
      '👁️  COSA VEDONO GLI ALTRI OPERATORI:',
      '  ❌ Chat SCOMPARE dalla loro lista (già presa)',
      `  ℹ️  Notifica: "Chat accettata da ${operatorName}"`,
      '',
      '📊 STATO CHAT: WITH_OPERATOR',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata',
      '',
      '⏭️  PROSSIMO PASSO: Utente fornirà il nome (o lo salterà)',
    ]);
  }

  /**
   * Utente fornisce nome
   */
  logUserNameProvided(sessionId, userName, operatorName, viaForm) {
    const method = viaForm ? 'tramite FORM' : 'automaticamente catturato';

    this.writeEntry('👤 UTENTE FORNISCE IL NOME', [
      `• Session ID: ${sessionId}`,
      `• Nome utente: ${userName}`,
      `• Operatore: ${operatorName}`,
      `• Metodo: ${method}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Form scompare (se era visibile)',
      `  ✓ Messaggio operatore: "✅ Perfetto, ${userName}! Come posso aiutarti?"`,
      '  ✓ Chat ora mostra il nome personalizzato',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      `  🔔 NOTIFICA: "Nome utente catturato: ${userName}"`,
      `  ✓ Titolo chat aggiornato: "${userName}" (invece di "Utente #...")`,
      `  ✓ Messaggio di conferma appare nella chat`,
      '  ✓ Può iniziare conversazione personalizzata',
      '',
      '📊 STATO CHAT: WITH_OPERATOR (conversazione attiva)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (nome aggiornato in DB e tutte le viste)',
    ]);
  }

  /**
   * Utente salta inserimento nome
   */
  logUserNameSkipped(sessionId, operatorName) {
    this.writeEntry('⏭️  UTENTE SALTA INSERIMENTO NOME', [
      `• Session ID: ${sessionId}`,
      `• Operatore: ${operatorName}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Clic su "Salta"',
      '  ✓ Form scompare',
      '  ✓ Messaggio operatore: "Nessun problema! Come posso aiutarti?"',
      '  ✓ Conversazione inizia senza nome personalizzato',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  ℹ️  Utente ha saltato il nome',
      '  ✓ Chat mantiene titolo "Utente #..." (senza nome)',
      '  ✓ Messaggio di saluto generico appare',
      '  ✓ Può comunque iniziare conversazione',
      '',
      '📊 STATO CHAT: WITH_OPERATOR (conversazione attiva)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata',
    ]);
  }

  /**
   * Operatore invia messaggio
   */
  logOperatorMessage(sessionId, userName, operatorName, message) {
    this.writeEntry('💼 OPERATORE INVIA MESSAGGIO', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Operatore: ${operatorName}`,
      `• Messaggio: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      `  ✓ Messaggio di ${operatorName} appare nella chat`,
      '  ✓ Avatar/indicatore operatore visibile',
      '  ✓ Timestamp del messaggio',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  ✓ Il suo messaggio appare nella chat window',
      '  ✓ Timestamp di invio',
      '  ✓ Indicatore "consegnato" (se implementato)',
      '',
      '📊 STATO CHAT: WITH_OPERATOR',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (messaggio via WebSocket)',
    ]);
  }

  /**
   * Utente torna all'AI
   */
  logUserReturnToAI(sessionId, userName, operatorName) {
    this.writeEntry('🔄 UTENTE TORNA ALL\'ASSISTENTE AI', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Operatore disconnesso: ${operatorName}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Conferma richiesta: "⚠️ Vuoi tornare all\'AI? L\'operatore verrà disconnesso"',
      '  ✓ Clic su "Sì, torna ad AI"',
      '  ✓ Messaggio: "✅ Sei tornato all\'assistente AI. Come posso aiutarti?"',
      '  ✓ Ora risponde Lucy (AI) invece dell\'operatore',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      `  🔔 NOTIFICA: "L'utente ${userName || 'Utente'} è tornato all'AI"`,
      '  ✓ Chat SCOMPARE dalla sua lista active chats',
      '  ✓ Badge "AI" appare se visualizza cronologia',
      '',
      '📊 STATO CHAT: ACTIVE (ritorno modalità AI)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata',
      '',
      '⚠️  NOTA: Chat riattivata ma senza operatore assegnato',
    ]);
  }

  /**
   * Utente termina conversazione
   */
  logConversationEnded(sessionId, userName, wasWithOperator, operatorName) {
    const operatorInfo = wasWithOperator
      ? [`• Operatore disconnesso: ${operatorName}`, '']
      : [];

    this.writeEntry('🛑 UTENTE TERMINA CONVERSAZIONE', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      ...operatorInfo,
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Conferma: "⚠️ Vuoi terminare? Cronologia sarà rimossa"',
      '  ✓ Clic su "Sì, termina"',
      '  ✓ Chat si CHIUDE completamente',
      '  ✓ Widget ritorna allo stato iniziale',
      '  ✓ Può iniziare nuova conversazione (fresh)',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      wasWithOperator
        ? `  🔔 NOTIFICA: "${userName || 'Utente'} ha terminato la conversazione"`
        : '  ℹ️  Nessuna notifica (era in modalità AI)',
      '  ✓ Chat passa a stato CLOSED',
      '  ✓ Appare in "Chat Chiuse" invece che active',
      '',
      '📊 STATO CHAT: CLOSED (utente ha terminato)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata',
    ]);
  }

  /**
   * Operatore chiude chat
   */
  logChatClosedByOperator(sessionId, userName, operatorName) {
    this.writeEntry('🔒 OPERATORE CHIUDE LA CHAT', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Operatore: ${operatorName}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Messaggio di sistema: "La chat è stata chiusa dall\'operatore"',
      '  ✓ Messaggio: "Grazie per averci contattato!"',
      '  ✓ Form di RATING appare (se abilitato)',
      '  ✓ Input box DISABILITATO',
      '  ✓ Bottone "Inizia nuova conversazione"',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  ✓ Chat SCOMPARE da "Chat Active"',
      '  ✓ Chat appare in "Chat Chiuse"',
      '  ✓ Input box disabilitato',
      '  ✓ Badge "CLOSED" visibile',
      '',
      '📊 STATO CHAT: CLOSED (chiusa da operatore)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata',
      '',
      '📧 Se email fornita: Transcript inviato via email',
    ]);
  }

  /**
   * Chat chiusa per inattività
   */
  logChatClosedInactivity(sessionId, userName, inactivityType, wasWithOperator) {
    const typeDescriptions = {
      'USER_INACTIVE': 'Utente non ha risposto per 10 minuti',
      'OPERATOR_INACTIVE': 'Operatore non ha risposto per 5 minuti',
      'AI_INACTIVE': 'Nessuna attività per 15 minuti (modalità AI)',
    };

    this.writeEntry('⏰ CHAT CHIUSA PER INATTIVITÀ', [
      `• Session ID: ${sessionId}`,
      `• Utente: ${userName || 'Anonimo'}`,
      `• Motivo: ${typeDescriptions[inactivityType] || inactivityType}`,
      `• Era con operatore: ${wasWithOperator ? 'SÌ' : 'NO'}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ⏰ Warning dopo 5 min (se WITH_OPERATOR): "Sei ancora lì?"',
      '  ✓ Messaggio: "Chat chiusa per inattività"',
      '  ✓ Può RIAPRIRE la chat (se entro 30 min)',
      '  ✓ Bottone "Riattiva chat" o "Nuova conversazione"',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      wasWithOperator
        ? '  🔔 NOTIFICA: "Chat chiusa per inattività utente"'
        : '  ℹ️  Chat AI chiusa automaticamente',
      '  ✓ Chat in "Chat Chiuse"',
      '  ✓ Badge mostra motivo chiusura',
      '',
      '📊 STATO CHAT: CLOSED (inattività)',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata',
      '',
      '⏱️  FINESTRA RIATTIVAZIONE: 30 minuti',
    ]);
  }

  /**
   * Utente carica file
   */
  logFileUploaded(sessionId, userName, fileName, fileSize, mimeType, isOperator) {
    const sender = isOperator ? 'Operatore' : 'Utente';

    this.writeEntry(`📎 ${sender.toUpperCase()} CARICA FILE`, [
      `• Session ID: ${sessionId}`,
      `• ${sender}: ${userName || 'Anonimo'}`,
      `• File: ${fileName}`,
      `• Dimensione: ${(fileSize / 1024).toFixed(2)} KB`,
      `• Tipo: ${mimeType}`,
      '',
      '👁️  COSA VEDE L\'UTENTE:',
      '  ✓ Progress bar upload',
      '  ✓ File appare come messaggio con icona',
      '  ✓ Nome file cliccabile per download',
      '  ✓ Preview immagine (se è immagine)',
      '',
      '👁️  COSA VEDE L\'OPERATORE:',
      '  ✓ File appare nella chat',
      '  ✓ Icona basata su tipo file',
      '  ✓ Può aprire/scaricare',
      '  ✓ Preview se immagine',
      '',
      '📊 STATO CHAT: Invariato',
      '🔄 SINCRONIZZAZIONE: ✅ Allineata (file salvato su Cloudinary)',
      '',
      '☁️  File salvato su: Cloudinary CDN',
    ]);
  }

  /**
   * PROBLEMA DI SINCRONIZZAZIONE RILEVATO
   */
  logSyncIssue(sessionId, issue, userView, operatorView) {
    this.writeEntry('⚠️  ⚠️  ⚠️  PROBLEMA DI SINCRONIZZAZIONE ⚠️  ⚠️  ⚠️', [
      `• Session ID: ${sessionId}`,
      `• Problema: ${issue}`,
      '',
      '❌ DISALLINEAMENTO RILEVATO:',
      '',
      '👁️  VISTA UTENTE:',
      ...userView.map(line => `  ${line}`),
      '',
      '👁️  VISTA OPERATORE:',
      ...operatorView.map(line => `  ${line}`),
      '',
      '🔧 AZIONE RICHIESTA: Investigare e correggere',
    ]);
  }
}

// Export singleton
export const narrativeLogger = new NarrativeLoggingService();
