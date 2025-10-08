import { useState, useEffect, useCallback } from 'react';
import { chatAPI, ticketAPI } from '../services/api.service';
import socketService from '../services/socket.service';

const SESSION_STORAGE_KEY = 'lucine_chat_session_id';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function useChat() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('ACTIVE'); // ACTIVE, WAITING, WITH_OPERATOR, CLOSED
  const [operatorName, setOperatorName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Initialize chat session
   */
  const initializeSession = useCallback(async () => {
    try {
      // Check URL for resume token
      const urlParams = new URLSearchParams(window.location.search);
      const resumeToken = urlParams.get('token');

      if (resumeToken) {
        // Resume ticket
        const ticketData = await ticketAPI.resumeTicket(resumeToken);
        setSessionId(ticketData.sessionId);
        setMessages(JSON.parse(ticketData.chatHistory || '[]'));
        if (ticketData.operatorName) {
          setOperatorName(ticketData.operatorName);
          setStatus('WITH_OPERATOR');
        }
        return ticketData.sessionId;
      }

      // Check localStorage for existing session
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const { id, timestamp } = JSON.parse(stored);
          const age = Date.now() - timestamp;

          if (age < SESSION_TTL) {
            // Session still valid - restore it
            const session = await chatAPI.getSession(id);
            setSessionId(id);
            setMessages(JSON.parse(session.messages || '[]'));
            setStatus(session.status);
            if (session.operator) {
              setOperatorName(session.operator.name);
            }
            return id;
          }
        } catch (err) {
          console.error('Failed to restore session:', err);
        }
      }

      // Create new session
      const session = await chatAPI.createSession();
      setSessionId(session.id);

      // Save to localStorage
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          id: session.id,
          timestamp: Date.now(),
        })
      );

      // Add welcome message
      const welcomeMessage = {
        id: '1',
        type: 'ai',
        content: 'Ciao! Sono Lucy, il tuo assistente virtuale 👋 Come posso aiutarti?',
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);

      return session.id;
    } catch (err) {
      console.error('Initialize session error:', err);
      setError('Errore inizializzazione chat');
      return null;
    }
  }, []);

  /**
   * Send message with auto-retry
   */
  const sendMessage = useCallback(
    async (content, retryCount = 0) => {
      if (!sessionId || !content.trim()) return;

      setLoading(true);
      setError(null);

      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second

      try {
        // Optimistic update - add user message immediately
        const userMessage = {
          id: Date.now().toString(),
          type: 'user',
          content: content,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Send to API
        const result = await chatAPI.sendMessage(sessionId, content);

        // If there's an AI response, add it
        if (result.aiResponse) {
          setMessages((prev) => [...prev, result.aiResponse]);
        }
      } catch (err) {
        console.error('Send message error:', err);

        // Check if it's a network error
        const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK';

        if (isNetworkError && retryCount < MAX_RETRIES) {
          // Auto-retry after delay
          setError(`Tentativo ${retryCount + 1}/${MAX_RETRIES}... Riprovo...`);

          setTimeout(() => {
            sendMessage(content, retryCount + 1);
          }, RETRY_DELAY * (retryCount + 1)); // Exponential backoff
        } else {
          setError('Errore invio messaggio. Riprova manualmente.');
        }
      } finally {
        if (retryCount === 0 || retryCount >= MAX_RETRIES) {
          setLoading(false);
        }
      }
    },
    [sessionId]
  );

  /**
   * Request operator
   */
  const requestOperator = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const result = await chatAPI.requestOperator(sessionId);

      if (!result.operatorAvailable) {
        // No operators available - show ticket form
        return { noOperators: true };
      }

      // Operator assigned
      setStatus('WITH_OPERATOR');
      setOperatorName(result.operator.name);

      // Add system message
      const systemMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: `${result.operator.name} si è unito alla chat`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMessage]);

      return { operatorAvailable: true, operator: result.operator };
    } catch (err) {
      console.error('Request operator error:', err);
      setError('Errore richiesta operatore');
      return { error: true };
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  /**
   * Create ticket
   */
  const createTicket = useCallback(
    async (ticketData) => {
      if (!sessionId) return;

      setLoading(true);
      try {
        const ticket = await ticketAPI.createTicket({
          sessionId,
          ...ticketData,
        });

        setStatus('TICKET_CREATED');

        return ticket;
      } catch (err) {
        console.error('Create ticket error:', err);
        setError('Errore creazione ticket');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  /**
   * Setup WebSocket listeners
   */
  useEffect(() => {
    if (!sessionId) return;

    // Connect socket
    socketService.connect();
    socketService.joinChat(sessionId);

    // Listen for operator messages
    socketService.onOperatorMessage(({ message }) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for operator assigned
    socketService.onOperatorAssigned(({ operatorName: name }) => {
      setOperatorName(name);
      setStatus('WITH_OPERATOR');
    });

    // Listen for chat closed
    socketService.onChatClosed(() => {
      setStatus('CLOSED');
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, [sessionId]);

  return {
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
  };
}
