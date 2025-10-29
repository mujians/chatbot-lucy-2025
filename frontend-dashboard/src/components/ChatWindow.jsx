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
  const messagesEndRef = useRef(null);

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

      // Filter out current operator and offline operators
      const currentOperatorId = chat.operatorId;
      const available = response.data.data?.operators?.filter(
        (op) => op.id !== currentOperatorId && op.isOnline && op.isAvailable
      ) || [];

      setAvailableOperators(available);
      setShowTransferModal(true);
    } catch (error) {
      console.error('Error loading operators:', error);
      alert('Errore durante il caricamento degli operatori');
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

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2 justify-end max-w-4xl mx-auto">
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
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
    </div>
  );
};

export default ChatWindow;
