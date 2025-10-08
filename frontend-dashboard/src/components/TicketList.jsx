import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error('VITE_API_URL required');

const TicketList = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/api/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTickets(response.data.data?.tickets || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (ticket) =>
          ticket.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.id.includes(searchQuery) ||
          ticket.initialMessage?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTickets(filtered);
  };

  const handleAssignTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/tickets/${ticketId}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTickets();
    } catch (error) {
      console.error('Error assigning ticket:', error);
    }
  };

  const handleResolveTicket = async (ticketId, resolutionNotes = '') => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/tickets/${ticketId}/resolve`,
        { resolutionNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTickets();
    } catch (error) {
      console.error('Error resolving ticket:', error);
    }
  };

  const handleCloseTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/tickets/${ticketId}`,
        { status: 'CLOSED' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTickets();
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  const getContactMethodIcon = (method) => {
    return method === 'WHATSAPP' ? '💬' : '📧';
  };

  const stats = {
    pending: tickets.filter((t) => t.status === 'PENDING').length,
    inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
    closed: tickets.filter((t) => t.status === 'CLOSED').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <p className="text-gray-600">Gestisci e monitora tutti i ticket di supporto</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="text-4xl">⏳</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <div className="text-4xl">🔧</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolved</p>
              <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Closed</p>
              <p className="text-3xl font-bold text-gray-600">{stats.closed}</p>
            </div>
            <div className="text-4xl">🔒</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Cerca tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutti gli stati</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">🎫</p>
            <p>Nessun ticket trovato</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messaggio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contatto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ticket.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.userName || 'Anonimo'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {ticket.initialMessage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {getContactMethodIcon(ticket.contactMethod)}{' '}
                      {ticket.contactMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getStatusColor(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {ticket.status === 'PENDING' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignTicket(ticket.id);
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Assegna
                        </button>
                      )}
                      {(ticket.status === 'ASSIGNED' || ticket.status === 'OPEN') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolveTicket(ticket.id);
                          }}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Risolvi
                        </button>
                      )}
                      {ticket.status === 'RESOLVED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTicket(ticket.id);
                          }}
                          className="text-gray-600 hover:text-gray-900 font-medium"
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

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Dettagli Ticket
              </h2>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">ID Ticket</p>
                <p className="font-medium">{selectedTicket.id}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Utente</p>
                <p className="font-medium">{selectedTicket.userName || 'Anonimo'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Messaggio Iniziale</p>
                <p className="font-medium">{selectedTicket.initialMessage}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Metodo Contatto</p>
                  <p className="font-medium">
                    {getContactMethodIcon(selectedTicket.contactMethod)}{' '}
                    {selectedTicket.contactMethod}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Stato</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getStatusColor(
                      selectedTicket.status
                    )}`}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Creato il</p>
                <p className="font-medium">{formatDate(selectedTicket.createdAt)}</p>
              </div>

              {selectedTicket.operator && (
                <div>
                  <p className="text-sm text-gray-600">Assegnato a</p>
                  <p className="font-medium">{selectedTicket.operator.name}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              {selectedTicket.status === 'PENDING' && (
                <button
                  onClick={() => {
                    handleAssignTicket(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Assegna a me
                </button>
              )}
              {(selectedTicket.status === 'ASSIGNED' ||
                selectedTicket.status === 'OPEN') && (
                <button
                  onClick={() => {
                    handleResolveTicket(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  ✅ Risolvi Ticket
                </button>
              )}
              {selectedTicket.status === 'RESOLVED' && (
                <button
                  onClick={() => {
                    handleCloseTicket(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  🔒 Chiudi Ticket
                </button>
              )}
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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

export default TicketList;
