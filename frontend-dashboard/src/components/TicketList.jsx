import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Clock, User, AlertCircle, Mail, MessageSquare } from 'lucide-react';
import axios from '../lib/axios';


const statusColors = {
  PENDING: 'bg-warning/10 text-warning border-warning/20',
  ASSIGNED: 'bg-primary/10 text-primary border-primary/20',
  OPEN: 'bg-primary/10 text-primary border-primary/20',
  RESOLVED: 'bg-success/10 text-success border-success/20',
};

const priorityColors = {
  LOW: 'bg-muted text-muted-foreground border-border',
  NORMAL: 'bg-primary/10 text-primary border-primary/20',
  HIGH: 'bg-warning/10 text-warning border-warning/20',
};

const TicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`/api/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(response.data.data?.tickets || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setLoading(false);
    }
  };

  const handleAssignTicket = async (ticketId) => {
    try {
      await axios.post(`/api/tickets/${ticketId}/assign`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTickets();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      alert('Errore durante l\'assegnazione del ticket');
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      await axios.post(`/api/tickets/${ticketId}/resolve`, {
        resolutionNotes: '',
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTickets();
    } catch (error) {
      console.error('Error resolving ticket:', error);
      alert('Errore durante la risoluzione del ticket');
    }
  };

  const handleCloseTicket = async (ticketId) => {
    try {
      await axios.patch(`/api/tickets/${ticketId}`, {
        status: 'CLOSED',
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTickets();
    } catch (error) {
      console.error('Error closing ticket:', error);
      alert('Errore durante la chiusura del ticket');
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.initialMessage?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: tickets.filter((t) => t.status === 'PENDING').length,
    open: tickets.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED').length,
    resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
    high: tickets.filter((t) => t.priority === 'HIGH').length,
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Tickets</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestisci e monitora tutti i ticket di supporto
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" />
              Nuovo Ticket
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-muted-foreground">Aperti</p>
              <div className="text-2xl font-bold text-foreground mt-1">
                {stats.pending}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-muted-foreground">In Corso</p>
              <div className="text-2xl font-bold text-foreground mt-1">
                {stats.open}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-muted-foreground">Risolti</p>
              <div className="text-2xl font-bold text-foreground mt-1">
                {stats.resolved}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-muted-foreground">Urgenti</p>
              <div className="text-2xl font-bold text-destructive mt-1">
                {stats.high}
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Cerca per ID, titolo o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tutti gli status</option>
              <option value="PENDING">Aperti</option>
              <option value="OPEN">In corso</option>
              <option value="RESOLVED">Risolti</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Caricamento...</div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-2" />
              <p>Nessun ticket trovato</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Titolo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Priorità</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Aggiornato</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">{ticket.id.substring(0, 8)}</td>
                      <td className="px-6 py-4 text-sm">{ticket.initialMessage.substring(0, 50)}...</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${statusColors[ticket.status] || 'bg-muted text-muted-foreground border-border'}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${priorityColors[ticket.priority] || 'bg-muted text-muted-foreground border-border'}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          {ticket.contactMethod === 'WHATSAPP' ? (
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          )}
                          {ticket.userName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {formatDate(ticket.updatedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {ticket.status === 'PENDING' && (
                          <button
                            onClick={() => handleAssignTicket(ticket.id)}
                            className="text-sm text-primary hover:text-primary/80 font-medium"
                          >
                            Assegna
                          </button>
                        )}
                        {(ticket.status === 'ASSIGNED' || ticket.status === 'OPEN') && (
                          <button
                            onClick={() => handleResolveTicket(ticket.id)}
                            className="text-sm text-success hover:text-success/80 font-medium"
                          >
                            Risolvi
                          </button>
                        )}
                        {ticket.status === 'RESOLVED' && (
                          <button
                            onClick={() => handleCloseTicket(ticket.id)}
                            className="text-sm text-muted-foreground hover:text-foreground font-medium"
                          >
                            Chiudi
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketList;
