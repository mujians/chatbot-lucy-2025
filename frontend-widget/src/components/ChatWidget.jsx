import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import ChatMessage from './ChatMessage';
import TicketForm from './TicketForm';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [shouldShowWidget, setShouldShowWidget] = useState(false);
  const messagesEndRef = useRef(null);

  // Check URL parameters to show widget
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatbot = params.get('chatbot');
    const pb = params.get('pb');
    const token = params.get('token'); // Resume token from ticket link

    // Show widget if:
    // 1. URL has ?chatbot=test&pb=0 (test mode)
    // 2. URL has ?token=xxx (resume from ticket link)
    const showWidget = (chatbot === 'test' && pb === '0') || !!token;
    setShouldShowWidget(showWidget);
  }, []);

  const {
    sessionId,
    messages,
    status,
    operatorName,
    loading,
    error,
    initializeSession,
    sendMessage,
    requestOperator,
    createTicket,
  } = useChat();

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setShowTicketForm(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputValue.trim() || loading) return;

    const message = inputValue.trim();
    setInputValue('');

    await sendMessage(message);
  };

  const handleRequestOperator = async () => {
    const result = await requestOperator();

    if (result?.noOperators) {
      setShowTicketForm(true);
    }
  };

  const handleTicketSubmit = async (ticketData) => {
    const ticket = await createTicket(ticketData);

    if (ticket) {
      setShowTicketForm(false);

      // Show success message
      alert(
        `✅ Richiesta inviata! Ti abbiamo inviato un messaggio ${
          ticketData.contactMethod === 'WHATSAPP' ? 'WhatsApp' : 'Email'
        }.`
      );

      // Close widget after 3 seconds
      setTimeout(() => {
        setIsOpen(false);
      }, 3000);
    }
  };

  const getHeaderStyle = () => {
    switch (status) {
      case 'WITH_OPERATOR':
        return 'from-christmas-green to-green-700';
      case 'WAITING':
        return 'from-yellow-500 to-orange-600';
      default:
        return 'from-christmas-red to-red-700';
    }
  };

  const getHeaderText = () => {
    switch (status) {
      case 'WITH_OPERATOR':
        return `CHAT CON ${operatorName?.toUpperCase() || 'OPERATORE'}`;
      case 'WAITING':
        return 'IN ATTESA OPERATORE';
      case 'CLOSED':
        return 'CHAT CHIUSA';
      default:
        return 'LUCINE DI NATALE';
    }
  };

  const shouldShowAIActions = () => {
    const lastMessage = messages[messages.length - 1];
    return (
      status === 'ACTIVE' &&
      lastMessage?.type === 'ai' &&
      lastMessage?.suggestOperator
    );
  };

  const isInputDisabled = status === 'CLOSED' || status === 'TICKET_CREATED';

  // Don't render widget if URL params are not correct
  if (!shouldShowWidget) {
    return null;
  }

  return (
    <div className="chat-widget-container">
      {/* Chat Bubble Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="chat-bubble-button fixed bottom-5 right-5 w-16 h-16 rounded-full bg-gradient-to-br from-christmas-red to-red-700 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center text-white text-2xl animate-fadeIn z-50"
          aria-label="Apri chat"
        >
          💬
        </button>
      )}

      {/* Chat Popup */}
      {isOpen && (
        <div className="chat-popup fixed bottom-5 right-5 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col animate-fadeIn z-50">
          {/* Header */}
          <div
            className={`chat-header bg-gradient-to-r ${getHeaderStyle()} text-white px-6 py-4 rounded-t-2xl flex justify-between items-center transition-all duration-500`}
          >
            <div>
              <h3 className="font-bold text-lg uppercase tracking-wide">
                {getHeaderText()}
              </h3>
              <p className="text-xs opacity-90">
                {status === 'WITH_OPERATOR'
                  ? 'Online'
                  : status === 'WAITING'
                  ? 'Connessione in corso...'
                  : 'Chat con Lucy'}
              </p>
            </div>
            <button
              onClick={toggleChat}
              className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              aria-label="Chiudi chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="chat-messages flex-1 overflow-y-auto p-4 bg-gray-50">
            {showTicketForm ? (
              <TicketForm
                onSubmit={handleTicketSubmit}
                onCancel={() => setShowTicketForm(false)}
                loading={loading}
              />
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    operatorName={message.operatorName || operatorName}
                  />
                ))}

                {/* Smart Actions */}
                {shouldShowAIActions() && (
                  <div className="my-4 space-y-2 animate-slideUp">
                    <button
                      onClick={handleRequestOperator}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-christmas-green to-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md disabled:opacity-50"
                    >
                      💬 PARLA CON OPERATORE
                    </button>
                    <button
                      onClick={() => {
                        /* Continue with AI */
                      }}
                      className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                    >
                      🤖 CONTINUA CON AI
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-start my-3">
                    <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm my-2">
                    {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          {!showTicketForm && (
            <div className="chat-input border-t border-gray-200 p-4 bg-white rounded-b-2xl">
              {isInputDisabled ? (
                <div className="text-center text-sm text-gray-500 py-2">
                  {status === 'CLOSED'
                    ? 'Chat terminata'
                    : 'Richiesta inviata. Riceverai una notifica.'}
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Scrivi un messaggio..."
                    disabled={loading}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-christmas-green transition-colors disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    className="bg-christmas-green text-white px-4 py-2 rounded-full hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Invia messaggio"
                  >
                    📤
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
