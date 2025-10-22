import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Home,
  MessageSquare,
  Ticket,
  BookOpen,
  Users,
  Settings,
  Bell,
  LogOut,
  Clock,
  CheckCircle,
  AlertCircle,
  Archive,
  Flag,
  Activity,
  Timer,
  TrendingUp,
  MessageCircle
} from 'lucide-react';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import TicketList from '../components/TicketList';
import KnowledgeManager from '../components/KnowledgeManager';
import CannedResponsesManager from '../components/CannedResponsesManager';
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
  CANNED_RESPONSES: 'canned-responses',
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
  const [stats, setStats] = useState({
    waitingChats: 0,
    myChats: 0,
    pendingTickets: 0,
    closedToday: 0,
  });
  const [dashboardAnalytics, setDashboardAnalytics] = useState(null);

  useEffect(() => {
    const storedOperator = localStorage.getItem('operator');
    if (storedOperator) {
      setOperator(JSON.parse(storedOperator));
    }
  }, []);

  useEffect(() => {
    if (operator) {
      fetchDashboardStats();
      const interval = setInterval(fetchDashboardStats, 30000);
      return () => clearInterval(interval);
    }
  }, [operator]);

  useEffect(() => {
    if (!operator) return;

    const token = localStorage.getItem('auth_token');
    const newSocket = io(WS_URL, {
      auth: { token },
    });

    newSocket.on('connect', () => {
      newSocket.emit('operator_join', { operatorId: operator.id });
    });

    newSocket.on('new_chat_request', (data) => {
      addNotification(
        `Nuova richiesta chat da ${data.userName || 'Utente'}`,
        'info'
      );
      fetchDashboardStats();
    });

    newSocket.on('new_ticket_created', (data) => {
      addNotification(
        `Nuovo ticket da ${data.userName} (${data.contactMethod})`,
        'warning'
      );
      fetchDashboardStats();
    });

    newSocket.on('ticket_resumed', (data) => {
      addNotification(`Ticket ripreso da ${data.userName}`, 'info');
    });

    newSocket.on('chat_assigned', (data) => {
      if (data.operatorId === operator.id) {
        addNotification('Chat assegnata a te', 'success');
        fetchDashboardStats();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [operator]);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      const [chatsRes, ticketsRes, analyticsRes] = await Promise.all([
        axios.get(`${API_URL}/chats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/tickets`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/analytics/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const chats = chatsRes.data.data?.chats || [];
      const tickets = ticketsRes.data.data?.tickets || [];
      const analytics = analyticsRes.data.data || null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setStats({
        waitingChats: chats.filter((c) => c.status === 'WAITING').length,
        myChats: chats.filter((c) => c.operatorId === operator?.id && c.status === 'WITH_OPERATOR').length,
        pendingTickets: tickets.filter((t) => t.status === 'PENDING').length,
        closedToday: chats.filter((c) => {
          const closedAt = new Date(c.closedAt);
          return c.status === 'CLOSED' && closedAt >= today;
        }).length,
      });

      setDashboardAnalytics(analytics);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('operator');
    navigate('/login');
  };

  const toggleAvailability = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await axios.post(
        `${API_URL}/operators/me/toggle-availability`,
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

      case TABS.CANNED_RESPONSES:
        return <CannedResponsesManager />;

      case TABS.OPERATORS:
        return operator?.role === 'ADMIN' ? (
          <OperatorManager />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p>Accesso riservato agli amministratori</p>
            </div>
          </div>
        );

      case TABS.SETTINGS:
        return operator?.role === 'ADMIN' ? (
          <SettingsPanel />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p>Accesso riservato agli amministratori</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-6 overflow-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
              <p className="text-muted-foreground">Benvenuto, {operator?.name}</p>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Coda</p>
                    <p className="text-3xl font-bold text-warning">{stats.waitingChats}</p>
                  </div>
                  <Clock className="h-10 w-10 text-warning" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Le Mie Chat</p>
                    <p className="text-3xl font-bold text-success">{stats.myChats}</p>
                  </div>
                  <MessageSquare className="h-10 w-10 text-success" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Pending</p>
                    <p className="text-3xl font-bold text-destructive">{stats.pendingTickets}</p>
                  </div>
                  <Ticket className="h-10 w-10 text-destructive" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Chiuse Oggi</p>
                    <p className="text-3xl font-bold text-muted-foreground">{stats.closedToday}</p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Analytics Section */}
            {dashboardAnalytics && (
              <>
                {/* Chat Analytics */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Statistiche Chat
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Totali</p>
                      <p className="text-2xl font-bold">{dashboardAnalytics.chats.total}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Attive</p>
                      <p className="text-2xl font-bold text-green-500">{dashboardAnalytics.chats.active}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">In Coda</p>
                      <p className="text-2xl font-bold text-yellow-500">{dashboardAnalytics.chats.waiting}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Con Operatore</p>
                      <p className="text-2xl font-bold text-blue-500">{dashboardAnalytics.chats.withOperator}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Chiuse</p>
                      <p className="text-2xl font-bold text-gray-500">{dashboardAnalytics.chats.closed}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Archive className="h-3 w-3" />
                        Archiviate
                      </p>
                      <p className="text-2xl font-bold text-purple-500">{dashboardAnalytics.chats.archived}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        Segnalate
                      </p>
                      <p className="text-2xl font-bold text-orange-500">{dashboardAnalytics.chats.flagged}</p>
                    </div>
                  </div>
                </div>

                {/* Tickets & Operators Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Ticket Stats */}
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      Statistiche Ticket
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Totali</p>
                        <p className="text-3xl font-bold">{dashboardAnalytics.tickets.total}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Pending</p>
                        <p className="text-3xl font-bold text-yellow-500">{dashboardAnalytics.tickets.pending}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Aperti</p>
                        <p className="text-3xl font-bold text-blue-500">{dashboardAnalytics.tickets.open}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Risolti</p>
                        <p className="text-3xl font-bold text-green-500">{dashboardAnalytics.tickets.resolved}</p>
                      </div>
                    </div>
                  </div>

                  {/* Operator Stats */}
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Statistiche Operatori
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Totali</p>
                        <p className="text-3xl font-bold">{dashboardAnalytics.operators.total}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Online</p>
                        <p className="text-3xl font-bold text-green-500">{dashboardAnalytics.operators.online}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Disponibili</p>
                        <p className="text-3xl font-bold text-blue-500">{dashboardAnalytics.operators.available}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Metriche Prestazioni
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Tempo Risposta Medio</span>
                        </div>
                        <span className="text-2xl font-bold text-blue-500">
                          {dashboardAnalytics.performance.avgResponseTimeMinutes !== null
                            ? `${dashboardAnalytics.performance.avgResponseTimeMinutes} min`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Tempo Risoluzione Medio</span>
                        </div>
                        <span className="text-2xl font-bold text-purple-500">
                          {dashboardAnalytics.performance.avgResolutionTimeHours !== null
                            ? `${dashboardAnalytics.performance.avgResolutionTimeHours} ore`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Performers */}
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Top Operatori</h3>
                    <div className="space-y-2">
                      {dashboardAnalytics.operators.topPerformers.slice(0, 5).map((op, idx) => (
                        <div key={op.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                            <span className="text-sm font-medium">{op.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">
                              <MessageSquare className="h-3 w-3 inline mr-1" />
                              {op.totalChatsHandled}
                            </span>
                            <span className="text-muted-foreground">
                              <Ticket className="h-3 w-3 inline mr-1" />
                              {op.totalTicketsHandled}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Quick Actions & System Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Azioni Rapide</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab(TABS.CHATS)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-left font-medium"
                  >
                    <MessageSquare className="h-5 w-5" />
                    Gestisci Chat
                  </button>
                  <button
                    onClick={() => setActiveTab(TABS.TICKETS)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors text-left font-medium"
                  >
                    <Ticket className="h-5 w-5" />
                    Gestisci Tickets
                  </button>
                  <button
                    onClick={() => setActiveTab(TABS.KNOWLEDGE)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors text-left font-medium"
                  >
                    <BookOpen className="h-5 w-5" />
                    Gestisci Knowledge Base
                  </button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Stato Sistema</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Chat in attesa</span>
                    <span className="font-medium text-warning">{stats.waitingChats}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Le tue chat attive</span>
                    <span className="font-medium text-success">{stats.myChats}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ticket da assegnare</span>
                    <span className="font-medium text-destructive">{stats.pendingTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Il tuo stato</span>
                    <span className={`font-medium ${isOnline ? 'text-success' : 'text-muted-foreground'}`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="bg-primary text-primary-foreground px-6 py-4 shadow-lg border-b border-border">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold">LUCINE CHATBOT</h1>
            <div className="flex gap-2">
              {[
                { id: TABS.DASHBOARD, label: 'Dashboard', icon: Home },
                { id: TABS.CHATS, label: 'Chat', icon: MessageSquare },
                { id: TABS.TICKETS, label: 'Tickets', icon: Ticket },
                { id: TABS.KNOWLEDGE, label: 'KB', icon: BookOpen },
                { id: TABS.CANNED_RESPONSES, label: 'Risposte', icon: MessageCircle },
                ...(operator?.role === 'ADMIN'
                  ? [
                      { id: TABS.OPERATORS, label: 'Operatori', icon: Users },
                      { id: TABS.SETTINGS, label: 'Impostazioni', icon: Settings },
                    ]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-foreground/20'
                      : 'hover:bg-primary-foreground/10'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-lg">
              <button
                onClick={toggleAvailability}
                className={`w-12 h-6 rounded-full transition-colors ${
                  isOnline ? 'bg-success' : 'bg-muted'
                } relative`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isOnline ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium">
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <button className="relative hover:bg-primary-foreground/10 p-2 rounded-full transition-colors">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-medium text-sm">{operator?.name || 'Operatore'}</p>
                <p className="text-xs opacity-80">{operator?.role || 'OPERATOR'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 bg-primary-foreground/10 hover:bg-primary-foreground/20 px-3 py-2 rounded transition-colors text-sm"
              >
                <LogOut className="h-4 w-4" />
                Esci
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>

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
