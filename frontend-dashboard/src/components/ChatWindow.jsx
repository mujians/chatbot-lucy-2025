import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;
if (!API_URL) throw new Error('VITE_API_URL required');
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
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!chat) return;

    // Load chat messages
    if (chat.messages && Array.isArray(chat.messages)) {
      setMessages(chat.messages);
    }

    // Initialize WebSocket
    const newSocket = io(WS_URL, {
      auth: { token: localStorage.getItem('auth_token') },
    });

    newSocket.emit('operator_join', { sessionId: chat.id });

    newSocket.on('new_message', (message) => {
      if (message.sessionId === chat.id) {
        setMessages((prev) => [...prev, message]);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('operator_leave', { sessionId: chat.id });
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
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/chat/session/${chat.id}/message`,
        { message, sender: 'operator' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseChat = async () => {
    if (!confirm('Sei sicuro di voler chiudere questa chat?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/chat/session/${chat.id}/close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onClose?.();
    } catch (error) {
      console.error('Error closing chat:', error);
    }
  };

  const handleConvertToTicket = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/chat/session/${chat.id}/convert-to-ticket`,
        convertFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Chat convertita in ticket con successo!');
      setShowConvertModal(false);
      onClose?.();
    } catch (error) {
      console.error('Error converting to ticket:', error);
      alert('Errore durante la conversione in ticket');
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
            onClick={handleCloseChat}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ✕ Chiudi Chat
          </button>
          <button
            onClick={() => setShowConvertModal(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🎫 Converti in Ticket
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
    </div>
  );
};

export default ChatWindow;
