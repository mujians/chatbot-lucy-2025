import React, { useState, useEffect, useRef } from 'react';
import axios from '../lib/axios';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL;
if (!WS_URL) throw new Error('VITE_WS_URL required');

const ChatWindow = ({ chat, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [userIsTyping, setUserIsTyping] = useState(false); // P0.5: Typing indicator
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertFormData, setConvertFormData] = useState({
    contactMethod: 'WHATSAPP',
    whatsappNumber: '',
    email: '',
    operatorNotes: '',
  });
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [availableOperators, setAvailableOperators] = useState([]);
  const [transferData, setTransferData] = useState({
    toOperatorId: '',
    reason: '',
  });
  // P1.8: Priority and Tags
  const [priority, setPriority] = useState(chat?.priority || 'NORMAL');
  const [tags, setTags] = useState(chat?.tags ? JSON.parse(chat.tags) : []);
  const [newTag, setNewTag] = useState('');

  // P0.3: Internal Notes
  const [internalNotes, setInternalNotes] = useState(
    chat?.internalNotes ? JSON.parse(chat.internalNotes) : []
  );
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null); // P0.5: For debouncing typing indicator

  // P0.5: Handle operator typing with debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (!socket) return;

    // Emit typing started
    socket.emit('operator_typing', {
      sessionId: chat.id,
      operatorName: localStorage.getItem('operator_name') || 'Operatore',
      isTyping: true,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('operator_typing', {
        sessionId: chat.id,
        operatorName: localStorage.getItem('operator_name') || 'Operatore',
        isTyping: false,
      });
    }, 1000);
  };

  useEffect(() => {
    if (!chat) return;

    // Load chat messages
    if (chat.messages && Array.isArray(chat.messages)) {
      setMessages(chat.messages);
    }

    // P13: Mark messages as read when opening chat
    const markAsRead = async () => {
      try {
        await axios.post(`/api/chat/session/${chat.id}/mark-read`);
        console.log('✅ Messages marked as read');
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };
    markAsRead();

    // Initialize WebSocket
    const newSocket = io(WS_URL, {
      auth: { token: localStorage.getItem('auth_token') },
    });

    // Join operator room and chat session room
    const operatorId = localStorage.getItem('operator_id');
    if (operatorId) {
      newSocket.emit('operator_join', { operatorId: operatorId });
    }
    newSocket.emit('join_chat', { sessionId: chat.id });

    // Listen for user messages (P12 fix)
    newSocket.on('user_message', (data) => {
      console.log('📨 Received user_message:', data);
      if (data.sessionId === chat.id && data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    });

    // Listen for operator messages sent by other operators
    newSocket.on('operator_message', (data) => {
      console.log('📨 Received operator_message:', data);
      if (data.sessionId === chat.id && data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    });

    // P0.5: Listen for user typing indicator
    newSocket.on('user_typing', (data) => {
      if (data.sessionId === chat.id) {
        setUserIsTyping(data.isTyping);
        // Auto-hide after 3 seconds
        if (data.isTyping) {
          setTimeout(() => setUserIsTyping(false), 3000);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      const operatorId = localStorage.getItem('operator_id');
      if (operatorId) {
        newSocket.emit('operator_leave', { operatorId: operatorId });
      }
      newSocket.emit('leave_chat', { sessionId: chat.id });
      newSocket.disconnect();
    };
  }, [chat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const message = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      const response = await axios.post(
        `/api/chat/session/${chat.id}/operator-message`,
        { message }
      );

      // Add message to local state immediately
      if (response.data.success && response.data.data.message) {
        setMessages((prev) => [...prev, response.data.data.message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Errore durante l\'invio del messaggio');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseChat = async () => {
    if (!confirm('Sei sicuro di voler chiudere questa chat?')) return;

    try {
      await axios.post(
        `/api/chat/session/${chat.id}/close`,
        {}
      );
      onClose?.();
    } catch (error) {
      console.error('Error closing chat:', error);
    }
  };

  const handleConvertToTicket = async () => {
    try {
      await axios.post(
        `/api/chat/session/${chat.id}/convert-to-ticket`,
        convertFormData
      );

      alert('Chat convertita in ticket con successo!');
      setShowConvertModal(false);
      onClose?.();
    } catch (error) {
      console.error('Error converting to ticket:', error);
      alert('Errore durante la conversione in ticket');
    }
  };

  const handleOpenTransferModal = async () => {
    try {
      // axios instance already adds Authorization header via interceptor
      const response = await axios.get(`/api/operators`);

      // Filter out current operator and unavailable operators
      const currentOperatorId = chat.operatorId;
      const available = response.data.data?.operators?.filter(
        (op) => op.id !== currentOperatorId && op.isAvailable
      ) || [];

      setAvailableOperators(available);
      setShowTransferModal(true);
    } catch (error) {
      console.error('Error loading operators:', error);
      alert('Errore durante il caricamento degli operatori');
    }
  };

  // P1.8: Update priority
  const handlePriorityChange = async (newPriority) => {
    try {
      await axios.put(`/api/chat/sessions/${chat.id}/priority`, {
        priority: newPriority,
      });
      setPriority(newPriority);
      console.log('✅ Priority updated');
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Errore aggiornamento priorità');
    }
  };

  // P1.8: Add tag
  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const updatedTags = [...tags, newTag.trim()];
    try {
      await axios.put(`/api/chat/sessions/${chat.id}/tags`, {
        tags: updatedTags,
      });
      setTags(updatedTags);
      setNewTag('');
      console.log('✅ Tag added');
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Errore aggiunta tag');
    }
  };

  // P1.8: Remove tag
  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    try {
      await axios.put(`/api/chat/sessions/${chat.id}/tags`, {
        tags: updatedTags,
      });
      setTags(updatedTags);
      console.log('✅ Tag removed');
    } catch (error) {
      console.error('Error removing tag:', error);
      alert('Errore rimozione tag');
    }
  };

  // P0.3: Add internal note
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const response = await axios.post(`/api/chat/sessions/${chat.id}/notes`, {
        content: newNote.trim(),
      });
      setInternalNotes((prev) => [...prev, response.data.data.note]);
      setNewNote('');
      console.log('✅ Internal note added');
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Errore aggiunta nota');
    }
  };

  // P0.3: Start editing note
  const handleStartEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  // P0.3: Save edited note
  const handleSaveEditNote = async (noteId) => {
    if (!editingNoteContent.trim()) return;
    try {
      const response = await axios.put(`/api/chat/sessions/${chat.id}/notes/${noteId}`, {
        content: editingNoteContent.trim(),
      });
      setInternalNotes((prev) =>
        prev.map((note) => (note.id === noteId ? response.data.data.note : note))
      );
      setEditingNoteId(null);
      setEditingNoteContent('');
      console.log('✅ Internal note updated');
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Errore aggiornamento nota');
    }
  };

  // P0.3: Cancel editing
  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  // P0.3: Delete internal note
  const handleDeleteNote = async (noteId) => {
    if (!confirm('Sei sicuro di voler eliminare questa nota?')) return;
    try {
      await axios.delete(`/api/chat/sessions/${chat.id}/notes/${noteId}`);
      setInternalNotes((prev) => prev.filter((note) => note.id !== noteId));
      console.log('✅ Internal note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Errore eliminazione nota');
    }
  };

  // P0.2: User History state and handlers
  const [userHistory, setUserHistory] = useState(null);
  const [showUserHistory, setShowUserHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // P0.1: File Upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File troppo grande. Dimensione massima: 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `/api/chat/sessions/${chat.id}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Message will be added via WebSocket
      console.log('✅ P0.1: File uploaded successfully');

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error.response?.data?.error?.message || 'Errore caricamento file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleLoadUserHistory = async () => {
    if (!chat.userId) {
      alert('Nessun utente registrato associato a questa chat');
      return;
    }

    setLoadingHistory(true);
    try {
      const response = await axios.get(`/api/chat/users/${chat.userId}/history`);
      setUserHistory(response.data.data);
      setShowUserHistory(true);
      console.log('✅ P0.2: User history loaded');
    } catch (error) {
      console.error('Error loading user history:', error);
      alert('Errore caricamento storico utente');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTransferChat = async () => {
    if (!transferData.toOperatorId) {
      alert('Seleziona un operatore');
      return;
    }

    try {
      await axios.post(
        `/api/chat/sessions/${chat.id}/transfer`,
        transferData
      );

      alert('Chat trasferita con successo!');
      setShowTransferModal(false);
      setTransferData({ toOperatorId: '', reason: '' });
      onClose?.();
    } catch (error) {
      console.error('Error transferring chat:', error);
      alert(error.response?.data?.error?.message || 'Errore durante il trasferimento');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'operator':
        return 'bg-blue-500 text-white ml-auto';
      case 'user':
        return 'bg-gray-100 text-gray-900';
      case 'ai':
      case 'system':
        return 'bg-gray-50 text-gray-700 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-4xl mb-4">💬</p>
          <p className="text-lg">Seleziona una chat per iniziare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg text-gray-900">
              {chat.userName || 'Utente Anonimo'}
            </h2>
            <p className="text-sm text-gray-500">
              Session ID: {chat.id.substring(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                chat.status === 'WITH_OPERATOR'
                  ? 'bg-green-100 text-green-800'
                  : chat.status === 'WAITING'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {chat.status}
            </span>
            {chat.aiConfidence && (
              <span className="text-sm text-gray-500">
                AI: {Math.round(chat.aiConfidence * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* P1.8: Priority and Tags */}
        <div className="mt-3 flex items-center gap-4">
          {/* Priority Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Priorità:</span>
            <select
              value={priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="LOW">🟢 Bassa</option>
              <option value="NORMAL">🔵 Normale</option>
              <option value="HIGH">🟠 Alta</option>
              <option value="URGENT">🔴 Urgente</option>
            </select>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <span className="text-sm text-gray-600">Tags:</span>
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Aggiungi tag"
                className="px-2 py-1 text-sm border border-gray-300 rounded w-32 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={handleAddTag}
                className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`flex ${
                message.type === 'operator' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${getMessageStyle(
                  message.type
                )}`}
              >
                {/* P0.1: File Attachment Display */}
                {message.attachment && (
                  <div className="mb-2">
                    {message.attachment.resourceType === 'image' ? (
                      <a
                        href={message.attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={message.attachment.url}
                          alt={message.attachment.originalName}
                          className="max-w-full h-auto rounded-lg max-h-64 object-contain"
                        />
                      </a>
                    ) : (
                      <a
                        href={message.attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                          message.type === 'operator'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        <span className="text-2xl">
                          {message.attachment.mimetype?.includes('pdf')
                            ? '📄'
                            : message.attachment.mimetype?.includes('word')
                            ? '📝'
                            : message.attachment.mimetype?.includes('excel') ||
                              message.attachment.mimetype?.includes('spreadsheet')
                            ? '📊'
                            : message.attachment.mimetype?.includes('zip') ||
                              message.attachment.mimetype?.includes('rar')
                            ? '📦'
                            : '📎'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              message.type === 'operator' ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {message.attachment.originalName}
                          </p>
                          <p
                            className={`text-xs ${
                              message.type === 'operator' ? 'text-white/70' : 'text-gray-500'
                            }`}
                          >
                            {(message.attachment.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <span className={message.type === 'operator' ? 'text-white' : 'text-gray-600'}>
                          ⬇
                        </span>
                      </a>
                    )}
                  </div>
                )}

                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
                <span
                  className={`text-xs mt-1 block ${
                    message.type === 'operator'
                      ? 'text-white/70'
                      : 'text-gray-500'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white px-4 py-3 rounded-2xl rounded-br-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}

          {/* P0.5: User typing indicator */}
          {userIsTyping && (
            <div className="flex items-start gap-3 max-w-4xl mx-auto animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm flex-shrink-0">
                👤
              </div>
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600">Utente sta scrivendo</span>
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2 justify-end max-w-4xl mx-auto">
          {/* P0.2: User History Button */}
          {chat.userId && (
            <button
              onClick={handleLoadUserHistory}
              disabled={loadingHistory}
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingHistory ? '⏳ Caricamento...' : '👤 Storico Utente'}
            </button>
          )}
          <button
            onClick={handleOpenTransferModal}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          >
            🔄 Trasferisci Chat
          </button>
          <button
            onClick={() => setShowConvertModal(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🎫 Converti in Ticket
          </button>
          <button
            onClick={handleCloseChat}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ✕ Chiudi Chat
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form
          onSubmit={handleSendMessage}
          className="flex gap-2 max-w-4xl mx-auto"
        >
          {/* P0.1: Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
          />

          {/* P0.1: Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile || loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Carica file"
          >
            {uploadingFile ? '⏳' : '📎'}
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Scrivi un messaggio..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📤 Invia
          </button>
        </form>
      </div>

      {/* P0.3: Internal Notes Section */}
      <div className="border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => setShowNotesPanel(!showNotesPanel)}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              📝 Note Interne Operatore
            </span>
            {internalNotes.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                {internalNotes.length}
              </span>
            )}
          </div>
          <span className="text-gray-400">
            {showNotesPanel ? '▼' : '▶'}
          </span>
        </button>

        {showNotesPanel && (
          <div className="px-6 pb-4 max-w-4xl mx-auto">
            {/* Add New Note */}
            <div className="mb-4">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  placeholder="Aggiungi una nota privata (visibile solo agli operatori)..."
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-2 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Aggiungi
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Le note interne sono visibili solo agli operatori, non agli utenti
              </p>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {internalNotes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessuna nota interna. Aggiungi note per condividere informazioni con altri operatori.
                </p>
              ) : (
                internalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                  >
                    {editingNoteId === note.id ? (
                      // Edit Mode
                      <div className="space-y-2">
                        <textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEditNote(note.id)}
                            className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                          >
                            Salva
                          </button>
                          <button
                            onClick={handleCancelEditNote}
                            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {note.operatorName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(note.createdAt).toLocaleString('it-IT')}
                              </span>
                              {note.updatedAt && (
                                <span className="text-xs text-gray-400 italic">
                                  (modificato)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStartEditNote(note)}
                              className="p-1 text-gray-600 hover:text-yellow-600 transition-colors"
                              title="Modifica nota"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                              title="Elimina nota"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Convert to Ticket Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Converti Chat in Ticket
            </h3>

            <div className="space-y-4">
              {/* Contact Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metodo di Contatto
                </label>
                <select
                  value={convertFormData.contactMethod}
                  onChange={(e) =>
                    setConvertFormData({
                      ...convertFormData,
                      contactMethod: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>

              {/* WhatsApp Number */}
              {convertFormData.contactMethod === 'WHATSAPP' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numero WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={convertFormData.whatsappNumber}
                    onChange={(e) =>
                      setConvertFormData({
                        ...convertFormData,
                        whatsappNumber: e.target.value,
                      })
                    }
                    placeholder="+39 123 456 7890"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* Email */}
              {convertFormData.contactMethod === 'EMAIL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={convertFormData.email}
                    onChange={(e) =>
                      setConvertFormData({
                        ...convertFormData,
                        email: e.target.value,
                      })
                    }
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* Operator Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note Operatore (opzionale)
                </label>
                <textarea
                  value={convertFormData.operatorNotes}
                  onChange={(e) =>
                    setConvertFormData({
                      ...convertFormData,
                      operatorNotes: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Aggiungi note per gli altri operatori..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowConvertModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleConvertToTicket}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Converti in Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Chat Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Trasferisci Chat
            </h3>

            {availableOperators.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-500 mb-4">
                  Nessun operatore disponibile per il trasferimento
                </p>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {/* Operator Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleziona Operatore
                    </label>
                    <select
                      value={transferData.toOperatorId}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          toOperatorId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">-- Seleziona un operatore --</option>
                      {availableOperators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name} ({op.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transfer Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo del Trasferimento (opzionale)
                    </label>
                    <textarea
                      value={transferData.reason}
                      onChange={(e) =>
                        setTransferData({
                          ...transferData,
                          reason: e.target.value,
                        })
                      }
                      rows={3}
                      placeholder="Es: Cliente richiede supporto tecnico avanzato"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferData({ toOperatorId: '', reason: '' });
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleTransferChat}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Trasferisci
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* P0.2: User History Modal */}
      {showUserHistory && userHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-purple-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    👤 Storico Utente
                  </h3>
                  <p className="text-purple-100 text-sm mt-1">
                    {userHistory.user.name || userHistory.user.email}
                  </p>
                </div>
                <button
                  onClick={() => setShowUserHistory(false)}
                  className="text-white hover:bg-purple-700 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* User Profile Summary */}
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900">
                    {userHistory.user.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Telefono</p>
                  <p className="text-sm font-medium text-gray-900">
                    {userHistory.user.phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Totale Chat</p>
                  <p className="text-sm font-medium text-gray-900">
                    {userHistory.user.totalChats}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Cliente dal</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(userHistory.user.firstSeenAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Sessions List */}
            <div className="flex-1 overflow-y-auto p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">
                Conversazioni Precedenti ({userHistory.sessions.length})
              </h4>

              {userHistory.sessions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nessuna conversazione precedente
                </p>
              ) : (
                <div className="space-y-4">
                  {userHistory.sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                        session.id === chat.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* Session Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                session.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : session.status === 'CLOSED'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {session.status}
                            </span>
                            {session.id === chat.id && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                CORRENTE
                              </span>
                            )}
                            {/* Priority Badge */}
                            {session.priority && session.priority !== 'NORMAL' && (
                              <span className="text-xs">
                                {session.priority === 'URGENT'
                                  ? '🔴'
                                  : session.priority === 'HIGH'
                                  ? '🟠'
                                  : session.priority === 'LOW'
                                  ? '🟢'
                                  : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(session.createdAt).toLocaleString('it-IT')}
                            {session.closedAt && (
                              <span className="text-gray-400">
                                {' '}
                                → {new Date(session.closedAt).toLocaleString('it-IT')}
                              </span>
                            )}
                          </p>
                          {session.operator && (
                            <p className="text-xs text-gray-500 mt-1">
                              Operatore: {session.operator.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {session.messageCount} messaggi
                          </p>
                          {session.aiConfidence && (
                            <p className="text-xs text-gray-400">
                              AI: {Math.round(session.aiConfidence * 100)}%
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {session.tags && JSON.parse(session.tags).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {JSON.parse(session.tags).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Messages Preview */}
                      <div className="mt-3 space-y-2 max-h-40 overflow-y-auto border-t pt-2">
                        {session.messages.slice(0, 5).map((msg, idx) => (
                          <div
                            key={idx}
                            className={`text-xs ${
                              msg.type === 'user'
                                ? 'text-gray-700'
                                : msg.type === 'operator'
                                ? 'text-blue-700'
                                : 'text-gray-500'
                            }`}
                          >
                            <span className="font-medium">
                              {msg.type === 'user'
                                ? 'Utente'
                                : msg.type === 'operator'
                                ? msg.operatorName || 'Operatore'
                                : 'Sistema'}
                              :
                            </span>{' '}
                            {msg.content.substring(0, 100)}
                            {msg.content.length > 100 && '...'}
                          </div>
                        ))}
                        {session.messages.length > 5 && (
                          <p className="text-xs text-gray-400 italic">
                            + altri {session.messages.length - 5} messaggi
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowUserHistory(false)}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
