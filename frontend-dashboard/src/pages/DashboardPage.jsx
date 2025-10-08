import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import TicketList from '../components/TicketList';
import KnowledgeManager from '../components/KnowledgeManager';
import OperatorManager from '../components/OperatorManager';
import SettingsPanel from '../components/SettingsPanel';
import ToastNotification from '../components/ToastNotification';

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;
if (!API_URL) throw new Error('VITE_API_URL required');
if (!WS_URL) throw new Error('VITE_WS_URL required');

const TABS = {
  DASHBOARD: 'dashboard',
  CHATS: 'chats',
  TICKETS: 'tickets',
  KNOWLEDGE: 'knowledge',
  OPERATORS: 'operators',
  SETTINGS: 'settings',
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [operator, setOperator] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [selectedChat, setSelectedChat] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Load operator from localStorage
    const storedOperator = localStorage.getItem('operator');
    if (storedOperator) {
      setOperator(JSON.parse(storedOperator));
    }
  }, []);

  // WebSocket setup for real-time notifications
  useEffect(() => {
    if (!operator) return;

    const token = localStorage.getItem('auth_token');
    const newSocket = io(WS_URL, {
      auth: { token },
    });

    newSocket.on('connect', () => {
      console.log('Dashboard WebSocket connected');
      newSocket.emit('operator_join', { operatorId: operator.id });
    });

    // Listen for new chat requests
    newSocket.on('new_chat_request', (data) => {
      addNotification(
        `Nuova richiesta chat da ${data.userName || 'Utente'}`,
        'info'
      );
      playNotificationSound();
    });

    // Listen for new tickets
    newSocket.on('new_ticket_created', (data) => {
      addNotification(
        `Nuovo ticket da ${data.userName} (${data.contactMethod})`,
        'warning'
      );
      playNotificationSound();
    });

    // Listen for ticket resumed
    newSocket.on('ticket_resumed', (data) => {
      addNotification(`Ticket ripreso da ${data.userName}`, 'info');
    });

    // Listen for chat assigned
    newSocket.on('chat_assigned', (data) => {
      if (data.operatorId === operator.id) {
        addNotification('Chat assegnata a te', 'success');
        playNotificationSound();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [operator]);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const playNotificationSound = () => {
    // Simple notification sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('operator');
    navigate('/login');
  };

  const toggleAvailability = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const newStatus = !isOnline;

      const response = await axios.post(
        `${API_URL}/api/operators/me/toggle-availability`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsOnline(response.data.data.isOnline);
    } catch (error) {
      console.error('Error toggling availability:', error);
      alert('Errore durante il cambio di disponibilità');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.CHATS:
        return (
          <div className="flex h-full">
            <div className="w-96">
              <ChatList onSelectChat={setSelectedChat} />
            </div>
            <div className="flex-1">
              <ChatWindow chat={selectedChat} onClose={() => setSelectedChat(null)} />
            </div>
          </div>
        );

      case TABS.TICKETS:
        return <TicketList />;

      case TABS.KNOWLEDGE:
        return <KnowledgeManager />;

      case TABS.OPERATORS:
        return operator?.role === 'ADMIN' ? (
          <OperatorManager />
        ) : (
          <div className="p-6 text-center text-gray-500">
            <p className="text-3xl mb-2">🔒</p>
            <p>Accesso riservato agli amministratori</p>
          </div>
        );

      case TABS.SETTINGS:
        return operator?.role === 'ADMIN' ? (
          <SettingsPanel />
        ) : (
          <div className="p-6 text-center text-gray-500">
            <p className="text-3xl mb-2">🔒</p>
            <p>Accesso riservato agli amministratori</p>
          </div>
        );

      default:
        // Dashboard Home
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
              <p className="text-gray-600">Benvenuto, {operator?.name}!</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">In Coda</p>
                    <p className="text-3xl font-bold text-yellow-600">3</p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Le Mie Chat</p>
                    <p className="text-3xl font-bold text-christmas-green">5</p>
                  </div>
                  <div className="text-4xl">💬</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ticket Pending</p>
                    <p className="text-3xl font-bold text-red-600">7</p>
                  </div>
                  <div className="text-4xl">🎫</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Chiuse Oggi</p>
                    <p className="text-3xl font-bold text-gray-600">12</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Azioni Rapide</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab(TABS.CHATS)}
                    className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-left font-medium"
                  >
                    💬 Gestisci Chat
                  </button>
                  <button
                    onClick={() => setActiveTab(TABS.TICKETS)}
                    className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-left font-medium"
                  >
                    🎫 Gestisci Tickets
                  </button>
                  <button
                    onClick={() => setActiveTab(TABS.KNOWLEDGE)}
                    className="w-full px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-left font-medium"
                  >
                    📚 Gestisci Knowledge Base
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Attività Recente</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-gray-600">
                    <span>💬</span>
                    <div>
                      <p>Chat assegnata da Mario Rossi</p>
                      <p className="text-xs text-gray-400">5 minuti fa</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-gray-600">
                    <span>🎫</span>
                    <div>
                      <p>Nuovo ticket creato</p>
                      <p className="text-xs text-gray-400">12 minuti fa</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-gray-600">
                    <span>✅</span>
                    <div>
                      <p>Chat chiusa con successo</p>
                      <p className="text-xs text-gray-400">25 minuti fa</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-christmas-red text-white px-6 py-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold">🎄 LUCINE</h1>
            <div className="flex gap-2">
              {[
                { id: TABS.DASHBOARD, label: 'Dashboard', icon: '🏠' },
                { id: TABS.CHATS, label: 'Chat', icon: '💬' },
                { id: TABS.TICKETS, label: 'Tickets', icon: '🎫' },
                { id: TABS.KNOWLEDGE, label: 'KB', icon: '📚' },
                ...(operator?.role === 'ADMIN'
                  ? [
                      { id: TABS.OPERATORS, label: 'Operatori', icon: '👥' },
                      { id: TABS.SETTINGS, label: 'Impostazioni', icon: '⚙️' },
                    ]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white/30'
                      : 'hover:bg-white/20'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Availability Toggle */}
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
              <button
                onClick={toggleAvailability}
                className={`w-12 h-6 rounded-full transition-colors ${
                  isOnline ? 'bg-christmas-green' : 'bg-gray-400'
                } relative`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isOnline ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium">
                {isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
              </span>
            </div>

            {/* Notifications */}
            <button className="relative hover:bg-white/20 p-2 rounded-full transition-colors">
              🔔
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                3
              </span>
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-medium">{operator?.name || 'Operatore'}</p>
                <p className="text-xs opacity-80">{operator?.role || 'OPERATOR'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded transition-colors text-sm"
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>

      {/* Toast Notifications */}
      {notifications.map((notification) => (
        <ToastNotification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

export default DashboardPage;
