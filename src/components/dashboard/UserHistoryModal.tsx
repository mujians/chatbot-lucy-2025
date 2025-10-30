import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, User, Calendar, Clock } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  type: string;
  content: string;
  operatorName?: string;
  createdAt: string;
}

interface HistorySession {
  id: string;
  status: string;
  createdAt: string;
  closedAt?: string;
  lastMessageAt: string;
  operator?: {
    name: string;
  };
  messagesNew: Message[];
}

interface UserHistoryModalProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserHistoryModal({
  userId,
  userName,
  open,
  onOpenChange,
}: UserHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && userId) {
      loadUserHistory();
    }
  }, [open, userId]);

  const loadUserHistory = async () => {
    setLoading(true);
    try {
      const response = await chatApi.getUserHistory(userId);
      const data = response.data || response;
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load user history:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      CLOSED: 'bg-gray-100 text-gray-800',
      WITH_OPERATOR: 'bg-blue-100 text-blue-800',
      ACTIVE: 'bg-green-100 text-green-800',
      WAITING: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-xs font-medium',
          styles[status] || 'bg-gray-100 text-gray-800'
        )}
      >
        {status}
      </span>
    );
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'operator':
        return 'bg-primary text-primary-foreground';
      case 'ai':
        return 'bg-blue-100 text-blue-900';
      case 'system':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Storico Conversazioni - {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nessuna conversazione precedente</p>
            <p className="text-xs mt-1">Questa è la prima interazione con questo utente</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {sessions.map((session) => {
                const isExpanded = expandedSessions.has(session.id);
                const messageCount = session.messagesNew?.length || 0;

                return (
                  <div
                    key={session.id}
                    className="border rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    {/* Session Header */}
                    <button
                      onClick={() => toggleSession(session.id)}
                      className="w-full p-4 text-left flex items-start gap-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="mt-1">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              Session #{session.id.slice(0, 8)}
                            </span>
                            {getStatusBadge(session.status)}
                          </div>
                          <span className="text-xs text-gray-500">
                            {messageCount} {messageCount === 1 ? 'messaggio' : 'messaggi'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(session.createdAt), 'dd MMM yyyy', { locale: it })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(session.createdAt), 'HH:mm', { locale: it })}
                          </div>
                          {session.operator && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {session.operator.name}
                            </div>
                          )}
                        </div>

                        {session.closedAt && (
                          <p className="text-xs text-gray-500">
                            Chiusa:{' '}
                            {format(new Date(session.closedAt), 'dd MMM yyyy HH:mm', { locale: it })}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Session Messages (Expanded) */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-4 space-y-2">
                        {session.messagesNew && session.messagesNew.length > 0 ? (
                          session.messagesNew.map((msg) => (
                            <div
                              key={msg.id}
                              className={cn(
                                'p-3 rounded-lg text-sm',
                                getMessageTypeColor(msg.type)
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="flex-1 whitespace-pre-wrap">{msg.content}</p>
                                <span
                                  className={cn(
                                    'text-xs',
                                    msg.type === 'operator'
                                      ? 'text-primary-foreground/70'
                                      : 'text-gray-500'
                                  )}
                                >
                                  {format(new Date(msg.createdAt), 'HH:mm', { locale: it })}
                                </span>
                              </div>
                              {msg.type === 'operator' && msg.operatorName && (
                                <p className="text-xs mt-1 text-primary-foreground/70">
                                  {msg.operatorName}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-500 text-center py-2">
                            Nessun messaggio in questa sessione
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
