import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LoggingService {
  constructor() {
    // Create logs directory if it doesn't exist
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Create separate log files for different categories
    this.logFiles = {
      user: path.join(this.logsDir, 'user-actions.log'),
      operator: path.join(this.logsDir, 'operator-actions.log'),
      system: path.join(this.logsDir, 'system-events.log'),
      websocket: path.join(this.logsDir, 'websocket-events.log'),
      database: path.join(this.logsDir, 'database-operations.log'),
      all: path.join(this.logsDir, 'all-events.log'),
    };

    console.log('📊 Logging Service initialized');
    console.log(`📁 Logs directory: ${this.logsDir}`);
  }

  /**
   * Format log entry with timestamp and context
   */
  formatLogEntry(category, action, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      category,
      action,
      ...data,
    };

    // Create readable format
    const formattedEntry = `[${timestamp}] [${category.toUpperCase()}] ${action}`;
    const details = JSON.stringify(data, null, 2);

    return {
      raw: logEntry,
      formatted: `${formattedEntry}\n${details}\n${'='.repeat(80)}\n`,
    };
  }

  /**
   * Write log entry to file and console
   */
  writeLog(category, action, data) {
    const { formatted, raw } = this.formatLogEntry(category, action, data);

    // Console output with emoji for visibility
    const emoji = this.getCategoryEmoji(category);
    console.log(`${emoji} ${action}`, raw);

    // Write to category-specific log file
    if (this.logFiles[category]) {
      fs.appendFileSync(this.logFiles[category], formatted);
    }

    // Write to all-events log
    fs.appendFileSync(this.logFiles.all, formatted);
  }

  /**
   * Get emoji for category
   */
  getCategoryEmoji(category) {
    const emojis = {
      user: '👤',
      operator: '👨‍💼',
      system: '⚙️',
      websocket: '🔌',
      database: '💾',
    };
    return emojis[category] || '📝';
  }

  // ============================================================================
  // USER ACTIONS
  // ============================================================================

  logUserAction(action, sessionId, data = {}) {
    this.writeLog('user', action, {
      sessionId,
      ...data,
    });
  }

  logUserMessageSent(sessionId, messageId, content, attachments = null) {
    this.logUserAction('USER_MESSAGE_SENT', sessionId, {
      messageId,
      contentLength: content?.length,
      contentPreview: content?.substring(0, 100),
      hasAttachments: !!attachments,
      attachmentCount: attachments?.length || 0,
    });
  }

  logUserOperatorRequested(sessionId, userId) {
    this.logUserAction('OPERATOR_REQUESTED', sessionId, {
      userId,
      requestTime: new Date().toISOString(),
    });
  }

  logUserOperatorCancelled(sessionId, userId) {
    this.logUserAction('OPERATOR_REQUEST_CANCELLED', sessionId, {
      userId,
      cancelTime: new Date().toISOString(),
    });
  }

  logUserNameSet(sessionId, userName) {
    this.logUserAction('USER_NAME_SET', sessionId, {
      userName,
    });
  }

  logUserNameSkipped(sessionId) {
    this.logUserAction('USER_NAME_SKIPPED', sessionId, {
      skippedAt: new Date().toISOString(),
    });
  }

  logUserReturnToAI(sessionId) {
    this.logUserAction('USER_RETURN_TO_AI', sessionId, {
      returnedAt: new Date().toISOString(),
    });
  }

  logUserEndConversation(sessionId) {
    this.logUserAction('USER_END_CONVERSATION', sessionId, {
      endedAt: new Date().toISOString(),
    });
  }

  logUserFileUpload(sessionId, fileInfo) {
    this.logUserAction('USER_FILE_UPLOAD', sessionId, {
      fileName: fileInfo.fileName,
      fileSize: fileInfo.fileSize,
      mimeType: fileInfo.mimeType,
      resourceType: fileInfo.resourceType,
    });
  }

  logUserRatingSubmitted(sessionId, rating, feedback) {
    this.logUserAction('USER_RATING_SUBMITTED', sessionId, {
      rating,
      hasFeedback: !!feedback,
      feedbackLength: feedback?.length || 0,
    });
  }

  // ============================================================================
  // OPERATOR ACTIONS
  // ============================================================================

  logOperatorAction(action, sessionId, operatorId, operatorName, data = {}) {
    this.writeLog('operator', action, {
      sessionId,
      operatorId,
      operatorName,
      ...data,
    });
  }

  logOperatorAcceptedChat(sessionId, operatorId, operatorName) {
    this.logOperatorAction('OPERATOR_ACCEPTED_CHAT', sessionId, operatorId, operatorName, {
      acceptedAt: new Date().toISOString(),
    });
  }

  logOperatorIntervened(sessionId, operatorId, operatorName) {
    this.logOperatorAction('OPERATOR_INTERVENED', sessionId, operatorId, operatorName, {
      intervenedAt: new Date().toISOString(),
    });
  }

  logOperatorMessageSent(sessionId, operatorId, operatorName, messageId, content) {
    this.logOperatorAction('OPERATOR_MESSAGE_SENT', sessionId, operatorId, operatorName, {
      messageId,
      contentLength: content?.length,
      contentPreview: content?.substring(0, 100),
    });
  }

  logOperatorClosedChat(sessionId, operatorId, operatorName) {
    this.logOperatorAction('OPERATOR_CLOSED_CHAT', sessionId, operatorId, operatorName, {
      closedAt: new Date().toISOString(),
    });
  }

  logOperatorTransferredChat(sessionId, fromOperatorId, toOperatorId) {
    this.logOperatorAction('OPERATOR_TRANSFERRED_CHAT', sessionId, fromOperatorId, 'Operator', {
      toOperatorId,
      transferredAt: new Date().toISOString(),
    });
  }

  logOperatorMarkedRead(sessionId, operatorId, messageCount) {
    this.logOperatorAction('OPERATOR_MARKED_READ', sessionId, operatorId, 'Operator', {
      messageCount,
      markedAt: new Date().toISOString(),
    });
  }

  logOperatorAddedNote(sessionId, operatorId, noteId, noteLength) {
    this.logOperatorAction('OPERATOR_ADDED_NOTE', sessionId, operatorId, 'Operator', {
      noteId,
      noteLength,
    });
  }

  logOperatorConvertedToTicket(sessionId, operatorId, ticketId) {
    this.logOperatorAction('OPERATOR_CONVERTED_TO_TICKET', sessionId, operatorId, 'Operator', {
      ticketId,
      convertedAt: new Date().toISOString(),
    });
  }

  // ============================================================================
  // SYSTEM EVENTS
  // ============================================================================

  logSystemEvent(action, data = {}) {
    this.writeLog('system', action, data);
  }

  logSessionCreated(sessionId, userId, sessionData) {
    this.logSystemEvent('SESSION_CREATED', {
      sessionId,
      userId,
      status: sessionData.status,
      createdAt: sessionData.createdAt,
    });
  }

  logAIResponseGenerated(sessionId, messageId, responseTime, tokenCount) {
    this.logSystemEvent('AI_RESPONSE_GENERATED', {
      sessionId,
      messageId,
      responseTime,
      tokenCount,
    });
  }

  logSessionStatusChanged(sessionId, fromStatus, toStatus, reason) {
    this.logSystemEvent('SESSION_STATUS_CHANGED', {
      sessionId,
      fromStatus,
      toStatus,
      reason,
      changedAt: new Date().toISOString(),
    });
  }

  logNameCaptureAttempt(sessionId, detectedName, confidence) {
    this.logSystemEvent('NAME_CAPTURE_ATTEMPT', {
      sessionId,
      detectedName,
      confidence,
      capturedAt: new Date().toISOString(),
    });
  }

  logUserNameCaptured(sessionId, userName) {
    this.logSystemEvent('USER_NAME_CAPTURED', {
      sessionId,
      userName,
      capturedAt: new Date().toISOString(),
    });
  }

  // ============================================================================
  // WEBSOCKET EVENTS
  // ============================================================================

  logWebSocketEvent(action, data = {}) {
    this.writeLog('websocket', action, data);
  }

  logWebSocketEmission(event, room, data) {
    this.logWebSocketEvent('WS_EMIT', {
      event,
      room,
      dataKeys: Object.keys(data || {}),
      emittedAt: new Date().toISOString(),
    });
  }

  logWebSocketConnection(socketId, userId, userType) {
    this.logWebSocketEvent('WS_CONNECTION', {
      socketId,
      userId,
      userType,
      connectedAt: new Date().toISOString(),
    });
  }

  logWebSocketDisconnection(socketId, userId, userType) {
    this.logWebSocketEvent('WS_DISCONNECTION', {
      socketId,
      userId,
      userType,
      disconnectedAt: new Date().toISOString(),
    });
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  logDatabaseOperation(action, entity, data = {}) {
    this.writeLog('database', action, {
      entity,
      ...data,
    });
  }

  logMessageSaved(messageId, sessionId, type, hasAttachment) {
    this.logDatabaseOperation('MESSAGE_SAVED', 'Message', {
      messageId,
      sessionId,
      type,
      hasAttachment,
      savedAt: new Date().toISOString(),
    });
  }

  logSessionUpdated(sessionId, updatedFields) {
    this.logDatabaseOperation('SESSION_UPDATED', 'ChatSession', {
      sessionId,
      updatedFields: Object.keys(updatedFields),
      updatedAt: new Date().toISOString(),
    });
  }

  logSessionDeleted(sessionId, deletedBy) {
    this.logDatabaseOperation('SESSION_DELETED', 'ChatSession', {
      sessionId,
      deletedBy,
      deletedAt: new Date().toISOString(),
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get log file path for a specific category
   */
  getLogFilePath(category = 'all') {
    return this.logFiles[category] || this.logFiles.all;
  }

  /**
   * Read logs from file
   */
  readLogs(category = 'all', lines = 100) {
    const filePath = this.getLogFilePath(category);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());

    // Return last N lines
    return allLines.slice(-lines);
  }

  /**
   * Clear logs for a category
   */
  clearLogs(category = 'all') {
    if (category === 'all') {
      Object.values(this.logFiles).forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } else if (this.logFiles[category]) {
      const filePath = this.logFiles[category];
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    console.log(`🗑️  Logs cleared for category: ${category}`);
  }
}

// Export singleton instance
export const loggingService = new LoggingService();
