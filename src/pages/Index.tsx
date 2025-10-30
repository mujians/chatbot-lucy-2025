import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/dashboard/TopBar';
import { OperatorSidebar } from '@/components/dashboard/OperatorSidebar';
import { ChatListPanel } from '@/components/dashboard/ChatListPanel';
import { ChatWindow } from '@/components/dashboard/ChatWindow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Archive, Flag, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { chatApi } from '@/lib/api';
import type { ChatSession } from '@/types';
import { notificationService } from '@/services/notification.service';
import { exportChatsToCSV, exportChatsToJSON } from '@/lib/export';

export default function Index() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const { socket, connected } = useSocket();
  const { operator, logout } = useAuth();
  const navigate = useNavigate();

  // Richiedi permesso notifiche al mount
  useEffect(() => {
    notificationService.requestPermission();
  }, []);

  // Load initial chats
  useEffect(() => {
    loadChats();
  }, [searchQuery, showArchived, showOnlyFlagged]);

  // Listen to WebSocket events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_chat_request', (data) => {
      console.log('📢 New chat request:', data);
      loadChats();

      // Notifica nuova chat
      notificationService.notifyNewChat(
        data.sessionId,
        data.userName || 'Utente sconosciuto'
      );

      // Incrementa unread count
      setUnreadCount(prev => prev + 1);
      notificationService.updateBadgeCount(unreadCount + 1);
    });

    socket.on('user_message', (data) => {
      console.log('💬 User message:', data);
      updateChatMessages(data.sessionId, data.message);

      // Notifica solo se non è la chat attualmente selezionata
      if (selectedChat?.id !== data.sessionId) {
        notificationService.notifyNewMessage(
          data.sessionId,
          data.userName || 'Utente',
          data.message.content
        );

        // Incrementa unread count
        setUnreadCount(prev => prev + 1);
        notificationService.updateBadgeCount(unreadCount + 1);
      } else {
        // P2.8: Solo suono se è la chat selezionata (rispetta preferenze)
        notificationService.playSound('chatMessage');
      }
    });

    socket.on('chat_closed', (data) => {
      console.log('🔒 Chat closed:', data);
      loadChats();
      if (selectedChat?.id === data.sessionId) {
        setSelectedChat(null);
      }
    });

    socket.on('chat_assigned', (data) => {
      console.log('✅ Chat assigned:', data);
      loadChats();

      // Notifica chat assegnata
      if (data.operatorId === operator?.id) {
        notificationService.notifyNewChat(
          data.sessionId,
          data.userName || 'Utente sconosciuto'
        );

        setUnreadCount(prev => prev + 1);
        notificationService.updateBadgeCount(unreadCount + 1);
      }
    });

    socket.on('message_received', (data) => {
      console.log('📨 Message received:', data);
      updateChatMessages(data.sessionId, data.message);
    });

    return () => {
      socket.off('new_chat_request');
      socket.off('user_message');
      socket.off('chat_closed');
      socket.off('chat_assigned');
      socket.off('message_received');
    };
  }, [socket, selectedChat, unreadCount, operator]);

  const loadChats = async () => {
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (showArchived) params.isArchived = true;
      if (showOnlyFlagged) params.isFlagged = true;

      const response = await chatApi.getSessions(params);

      // Backend returns { success: true, data: sessions }
      const sessionsData = response.data || response;

      // Parse messages JSON string and add computed lastMessage
      const parsedChats = sessionsData.map((session: any) => {
        // Parse messages if it's a JSON string
        const messages = typeof session.messages === 'string'
          ? JSON.parse(session.messages)
          : Array.isArray(session.messages)
          ? session.messages
          : [];

        return {
          ...session,
          messages,
          lastMessage: messages.length > 0 ? messages[messages.length - 1] : undefined,
        };
      });

      setChats(parsedChats);
    } catch (error) {
      console.error('❌ Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateChatMessages = (sessionId: string, newMessage: any) => {
    setChats(prev => prev.map(chat =>
      chat.id === sessionId
        ? {
            ...chat,
            messages: [...(chat.messages || []), newMessage],
            lastMessage: newMessage,
            lastMessageAt: newMessage.timestamp,
          }
        : chat
    ));

    // Update selected chat if it's the one receiving the message
    if (selectedChat?.id === sessionId) {
      setSelectedChat(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), newMessage],
      } : null);
    }
  };

  const handleSelectChat = (chat: ChatSession) => {
    setSelectedChat(chat);

    // Decrementa unread count quando si apre una chat
    if (unreadCount > 0) {
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      notificationService.updateBadgeCount(newCount);
    }

    // Notify backend that operator joined this chat
    if (socket && operator) {
      socket.emit('join_chat_as_operator', {
        sessionId: chat.id,
        operatorId: operator.id,
      });
    }
  };

  const handleSendMessage = (message: string) => {
    if (!selectedChat || !socket || !operator) return;

    socket.emit('operator_message', {
      sessionId: selectedChat.id,
      message,
      operatorId: operator.id,
    });

    // Optimistically add message to UI
    const newMessage = {
      id: Date.now().toString(),
      type: 'operator' as const,
      content: message,
      timestamp: new Date().toISOString(),
      operatorName: operator.name,
    };

    updateChatMessages(selectedChat.id, newMessage);
  };

  const handleCloseChat = () => {
    if (!selectedChat || !socket || !operator) return;

    socket.emit('close_chat', {
      sessionId: selectedChat.id,
      operatorId: operator.id,
    });

    setSelectedChat(null);
  };

  const handleDeleteChat = async (chat: ChatSession) => {
    if (!confirm(`Eliminare definitivamente la chat #${chat.id.slice(0, 8)}?`)) return;

    try {
      await chatApi.deleteSession(chat.id);
      loadChats();
      if (selectedChat?.id === chat.id) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('Errore durante l\'eliminazione della chat');
    }
  };

  const handleArchiveChat = async (chat: ChatSession) => {
    try {
      if (chat.isArchived) {
        await chatApi.unarchiveSession(chat.id);
      } else {
        await chatApi.archiveSession(chat.id);
      }
      loadChats();
    } catch (error) {
      console.error('Failed to archive/unarchive chat:', error);
      alert('Errore durante l\'archiviazione della chat');
    }
  };

  const handleFlagChat = async (chat: ChatSession) => {
    try {
      if (chat.isFlagged) {
        await chatApi.unflagSession(chat.id);
      } else {
        const reason = prompt('Motivo della segnalazione:');
        if (!reason) return;
        await chatApi.flagSession(chat.id, reason);
      }
      loadChats();
    } catch (error) {
      console.error('Failed to flag/unflag chat:', error);
      alert('Errore durante la segnalazione della chat');
    }
  };

  const handleArchiveChatById = async (chatId: string) => {
    try {
      await chatApi.archiveSession(chatId);
      loadChats();
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error('Failed to archive chat:', error);
      throw error;
    }
  };

  const handleFlagChatById = async (chatId: string, reason: string) => {
    try {
      await chatApi.flagSession(chatId, reason);
      loadChats();
    } catch (error) {
      console.error('Failed to flag chat:', error);
      throw error;
    }
  };

  const handleCloseChatSession = async (chatId: string) => {
    try {
      await chatApi.closeSession(chatId);
      loadChats();
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error('Failed to close chat session:', error);
      throw error;
    }
  };

  const handleToggleChatSelection = (chatId: string) => {
    setSelectedChatIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  const handleSelectAllChats = () => {
    setSelectedChatIds(new Set(chats.map(chat => chat.id)));
  };

  const handleDeselectAllChats = () => {
    setSelectedChatIds(new Set());
  };

  const handleBulkArchive = async () => {
    if (selectedChatIds.size === 0 || !confirm(`Archiviare ${selectedChatIds.size} chat?`)) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedChatIds).map(id => chatApi.archiveSession(id))
      );
      loadChats();
      setSelectedChatIds(new Set());
    } catch (error) {
      console.error('Bulk archive error:', error);
      alert('Errore durante l\'archiviazione multipla');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedChatIds.size === 0 || !confirm(`Eliminare DEFINITIVAMENTE ${selectedChatIds.size} chat?`)) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedChatIds).map(id => chatApi.deleteSession(id))
      );
      loadChats();
      setSelectedChatIds(new Set());
      if (selectedChat && selectedChatIds.has(selectedChat.id)) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Errore durante l\'eliminazione multipla');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkClose = async () => {
    if (selectedChatIds.size === 0 || !confirm(`Chiudere ${selectedChatIds.size} chat?`)) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedChatIds).map(id => chatApi.closeSession(id))
      );
      loadChats();
      setSelectedChatIds(new Set());
      if (selectedChat && selectedChatIds.has(selectedChat.id)) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error('Bulk close error:', error);
      alert('Errore durante la chiusura multipla');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar
        operatorName={operator?.name || 'Operatore'}
        onLogout={handleLogout}
        unreadCount={unreadCount}
      />
      <div className="flex flex-1 overflow-hidden">
        <OperatorSidebar />

        {/* Search & Filters Panel */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b space-y-3">
            <h2 className="font-semibold text-lg">Conversazioni</h2>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showArchived ? 'default' : 'outline'}
                onClick={() => setShowArchived(!showArchived)}
                className="flex-1"
              >
                <Archive className="h-4 w-4 mr-1" />
                Archiviate
              </Button>
              <Button
                size="sm"
                variant={showOnlyFlagged ? 'default' : 'outline'}
                onClick={() => setShowOnlyFlagged(!showOnlyFlagged)}
                className="flex-1"
              >
                <Flag className="h-4 w-4 mr-1" />
                Segnalate
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">{chats.length} chat</p>
          </div>

          {/* Bulk actions bar */}
          {selectedChatIds.size > 0 && (
            <div className="p-3 border-b bg-accent/50">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {selectedChatIds.size} selezionate
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAllChats}
                    disabled={bulkActionLoading}
                  >
                    Tutte
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeselectAllChats}
                    disabled={bulkActionLoading}
                  >
                    Nessuna
                  </Button>
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkActionLoading}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Esporta
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      const selectedChats = chats.filter(c => selectedChatIds.has(c.id));
                      exportChatsToCSV(selectedChats);
                    }}>
                      Esporta CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const selectedChats = chats.filter(c => selectedChatIds.has(c.id));
                      exportChatsToJSON(selectedChats);
                    }}>
                      Esporta JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkClose}
                  disabled={bulkActionLoading}
                  className="flex-1"
                >
                  Chiudi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkArchive}
                  disabled={bulkActionLoading}
                  className="flex-1"
                >
                  Archivia
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="flex-1"
                >
                  Elimina
                </Button>
              </div>
            </div>
          )}

          <ChatListPanel
            chats={chats}
            selectedChatId={selectedChat?.id}
            selectedChatIds={selectedChatIds}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onArchiveChat={handleArchiveChat}
            onFlagChat={handleFlagChat}
            onToggleChatSelection={handleToggleChatSelection}
          />
        </div>

        <ChatWindow
          selectedChat={selectedChat}
          onSendMessage={handleSendMessage}
          onCloseChat={handleCloseChat}
          onTransferComplete={() => {
            loadChats();
            setSelectedChat(null);
          }}
          onArchiveChat={handleArchiveChatById}
          onFlagChat={handleFlagChatById}
          onCloseChatSession={handleCloseChatSession}
        />
      </div>

      {/* WebSocket connection indicator */}
      {!connected && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-lg">
          ⚠️ WebSocket disconnesso
        </div>
      )}
    </div>
  );
}
