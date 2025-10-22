import { useState, useEffect } from 'react';
import axios from '../lib/axios';


const CannedResponsesManager = () => {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    shortcut: '',
    isGlobal: false,
  });

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/canned-responses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResponses(response.data.data || []);
    } catch (error) {
      console.error('Error loading canned responses:', error);
      alert('Errore nel caricamento delle risposte');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      title: '',
      content: '',
      shortcut: '',
      isGlobal: false,
    });
    setShowModal(true);
  };

  const handleEdit = (response) => {
    setEditingId(response.id);
    setFormData({
      title: response.title,
      content: response.content,
      shortcut: response.shortcut || '',
      isGlobal: response.isGlobal,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {

      if (editingId) {
        // Update existing
        await axios.put(
          `/api/canned-responses/${editingId}`,
          formData
        );
      } else {
        // Create new
        await axios.post(`/api/canned-responses`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setShowModal(false);
      loadResponses();
    } catch (error) {
      console.error('Error saving canned response:', error);
      alert(
        error.response?.data?.error?.message ||
          'Errore nel salvataggio della risposta'
      );
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa risposta?')) return;

    try {
      await axios.delete(`/api/canned-responses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      loadResponses();
    } catch (error) {
      console.error('Error deleting canned response:', error);
      alert('Errore nell\'eliminazione della risposta');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Risposte Predefinite
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestisci le tue risposte veloci per le chat
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            + Nuova Risposta
          </button>
        </div>
      </div>

      {/* Responses List */}
      <div className="flex-1 overflow-y-auto p-6">
        {responses.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg mb-2">Nessuna risposta predefinita</p>
            <p className="text-sm">Crea la tua prima risposta rapida!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {responses.map((response) => (
              <div
                key={response.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {response.title}
                      </h3>
                      {response.isGlobal && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          Globale
                        </span>
                      )}
                    </div>
                    {response.shortcut && (
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {response.shortcut}
                      </code>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(response)}
                      className="text-blue-500 hover:text-blue-700 text-sm"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(response.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap mb-2">
                  {response.content}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Creato da: {response.creator.name}</span>
                  <span>Usato: {response.timesUsed} volte</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingId ? 'Modifica Risposta' : 'Nuova Risposta'}
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titolo *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Es: Orari apertura"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenuto *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={6}
                  placeholder="Es: Siamo aperti tutti i giorni dalle 9:00 alle 18:00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              {/* Shortcut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scorciatoia (opzionale)
                </label>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) =>
                    setFormData({ ...formData, shortcut: e.target.value })
                  }
                  placeholder="Es: /orari"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usa scorciatoie come /orari per inserire velocemente la risposta
                </p>
              </div>

              {/* Is Global */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isGlobal"
                  checked={formData.isGlobal}
                  onChange={(e) =>
                    setFormData({ ...formData, isGlobal: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isGlobal" className="text-sm text-gray-700">
                  Rendi globale (disponibile a tutti gli operatori)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
              >
                {editingId ? 'Salva Modifiche' : 'Crea Risposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CannedResponsesManager;
