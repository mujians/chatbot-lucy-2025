import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error('VITE_API_URL required');

const OperatorManager = () => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOperator, setEditingOperator] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'OPERATOR',
    whatsappNumber: '',
  });

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/api/operators`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOperators(response.data.data?.operators || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching operators:', error);
      setLoading(false);
    }
  };

  const handleOpenModal = (operator = null) => {
    if (operator) {
      setEditingOperator(operator);
      setFormData({
        email: operator.email,
        name: operator.name,
        password: '',
        role: operator.role,
        whatsappNumber: operator.whatsappNumber || '',
      });
    } else {
      setEditingOperator(null);
      setFormData({
        email: '',
        name: '',
        password: '',
        role: 'OPERATOR',
        whatsappNumber: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOperator(null);
    setFormData({
      email: '',
      name: '',
      password: '',
      role: 'OPERATOR',
      whatsappNumber: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('auth_token');
      const submitData = { ...formData };

      // Remove password if empty (for updates)
      if (editingOperator && !submitData.password) {
        delete submitData.password;
      }

      if (editingOperator) {
        await axios.put(
          `${API_URL}/api/operators/${editingOperator.id}`,
          submitData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(`${API_URL}/api/operators`, submitData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      fetchOperators();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving operator:', error);
      alert(error.response?.data?.error?.message || 'Errore nel salvataggio');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo operatore?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(`${API_URL}/api/operators/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchOperators();
    } catch (error) {
      console.error('Error deleting operator:', error);
      alert(error.response?.data?.error?.message || 'Errore nell\'eliminazione');
    }
  };

  const getRoleColor = (role) => {
    return role === 'ADMIN'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800';
  };

  const stats = {
    total: operators.length,
    admin: operators.filter((o) => o.role === 'ADMIN').length,
    operators: operators.filter((o) => o.role === 'OPERATOR').length,
    online: operators.filter((o) => o.isOnline).length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operatori</h1>
          <p className="text-gray-600">Gestisci gli operatori del sistema</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-christmas-green text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          + Nuovo Operatore
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-3xl font-bold text-green-600">{stats.online}</p>
            </div>
            <div className="text-4xl">🟢</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Admin</p>
              <p className="text-3xl font-bold text-purple-600">{stats.admin}</p>
            </div>
            <div className="text-4xl">👑</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Operatori</p>
              <p className="text-3xl font-bold text-blue-600">{stats.operators}</p>
            </div>
            <div className="text-4xl">💬</div>
          </div>
        </div>
      </div>

      {/* Operators List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">👥</p>
            <p>Nessun operatore trovato</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {operators.map((operator) => (
              <div
                key={operator.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {operator.name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium ${getRoleColor(
                          operator.role
                        )}`}
                      >
                        {operator.role}
                      </span>
                      {operator.isOnline && (
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                          🟢 Online
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mb-2">
                      📧 {operator.email}
                    </p>

                    {operator.whatsappNumber && (
                      <p className="text-gray-600 text-sm mb-2">
                        💬 {operator.whatsappNumber}
                      </p>
                    )}

                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>Chat gestite: {operator.totalChatsHandled || 0}</span>
                      <span>Tickets: {operator.totalTicketsHandled || 0}</span>
                      {operator.averageRating && (
                        <span>Rating: ⭐ {operator.averageRating.toFixed(1)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleOpenModal(operator)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(operator.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingOperator ? 'Modifica Operatore' : 'Nuovo Operatore'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingOperator && '(lascia vuoto per non modificare)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editingOperator}
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruolo *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                >
                  <option value="OPERATOR">Operatore</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp (opzionale)
                </label>
                <input
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsappNumber: e.target.value })
                  }
                  placeholder="+39 123 456 7890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-christmas-green text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  {editingOperator ? 'Salva Modifiche' : 'Crea Operatore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorManager;
