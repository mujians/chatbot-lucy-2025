import React, { useState, useEffect } from 'react';
import axios from '../lib/axios';


const CATEGORIES = [
  { value: 'ORARI', label: 'Orari' },
  { value: 'BIGLIETTI', label: 'Biglietti' },
  { value: 'PARCHEGGIO', label: 'Parcheggio' },
  { value: 'EVENTI', label: 'Eventi' },
  { value: 'SERVIZI', label: 'Servizi' },
  { value: 'ALTRO', label: 'Altro' },
];

const KnowledgeManager = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'ALTRO',
    isActive: true,
  });

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, categoryFilter]);

  const fetchKnowledgeBase = async () => {
    try {
      const response = await axios.get(`/api/knowledge`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setItems(response.data.data?.items || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = items;

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === categoryFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        question: item.question,
        answer: item.answer,
        category: item.category,
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setFormData({
        question: '',
        answer: '',
        category: 'ALTRO',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({
      question: '',
      answer: '',
      category: 'ALTRO',
      isActive: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      if (editingItem) {
        // Update existing item
        await axios.put(
          `/api/knowledge/${editingItem.id}`,
          formData
        );
      } else {
        // Create new item
        await axios.post(`/api/knowledge`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      fetchKnowledgeBase();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving knowledge item:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo elemento?')) return;

    try {
      await axios.delete(`/api/knowledge/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchKnowledgeBase();
    } catch (error) {
      console.error('Error deleting knowledge item:', error);
    }
  };

  const toggleActive = async (item) => {
    try {
      await axios.put(
        `/api/knowledge/${item.id}`,
        { ...item, isActive: !item.isActive }
      );

      fetchKnowledgeBase();
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      ORARI: 'bg-blue-100 text-blue-800',
      BIGLIETTI: 'bg-green-100 text-green-800',
      PARCHEGGIO: 'bg-purple-100 text-purple-800',
      EVENTI: 'bg-pink-100 text-pink-800',
      SERVIZI: 'bg-yellow-100 text-yellow-800',
      ALTRO: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.ALTRO;
  };

  const stats = {
    total: items.length,
    active: items.filter((i) => i.isActive).length,
    inactive: items.filter((i) => !i.isActive).length,
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter((line) => line.trim());

        // Skip header row, parse CSV (assuming format: category,question,answer)
        const items = lines.slice(1).map((line) => {
          // Simple CSV parsing (for complex CSV with quotes, use a library)
          const [category, question, answer] = line.split(',').map((s) => s.trim());
          return { category, question, answer };
        }).filter((item) => item.question && item.answer);

        if (items.length === 0) {
          alert('Nessun dato valido trovato nel CSV');
          return;
        }

        // Send to backend
        const response = await axios.post(
          `/api/knowledge/bulk`,
          { items }
        );

        alert(`Importate ${response.data.data.imported} domande su ${response.data.data.total}`);
        fetchKnowledge(); // Refresh list
        e.target.value = ''; // Reset file input
      } catch (error) {
        console.error('Error importing CSV:', error);
        alert('Errore durante l\'importazione del CSV');
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600">Gestisci domande e risposte per l'AI</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium cursor-pointer"
          >
            📤 Importa CSV
          </label>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-christmas-green text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            + Nuova Domanda
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="text-4xl">📚</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attive</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Disattivate</p>
              <p className="text-3xl font-bold text-gray-600">{stats.inactive}</p>
            </div>
            <div className="text-4xl">⚪</div>
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
              placeholder="Cerca domande o risposte..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
          >
            <option value="all">Tutte le categorie</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">📚</p>
            <p>Nessun elemento trovato</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium ${getCategoryColor(
                          item.category
                        )}`}
                      >
                        {item.category}
                      </span>
                      {item.isActive ? (
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                          Attiva
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                          Disattivata
                        </span>
                      )}
                      {item.timesUsed > 0 && (
                        <span className="text-xs text-gray-500">
                          Usata {item.timesUsed} volte
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {item.question}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {item.answer}
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => toggleActive(item)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={item.isActive ? 'Disattiva' : 'Attiva'}
                    >
                      {item.isActive ? '🔓' : '🔒'}
                    </button>
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
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
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Modifica Domanda' : 'Nuova Domanda'}
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
                  Categoria
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domanda
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) =>
                    setFormData({ ...formData, question: e.target.value })
                  }
                  required
                  placeholder="Quali sono gli orari?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risposta
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData({ ...formData, answer: e.target.value })
                  }
                  required
                  rows={6}
                  placeholder="Le Lucine di Natale sono aperte..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-christmas-green"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-christmas-green border-gray-300 rounded focus:ring-christmas-green"
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium text-gray-700"
                >
                  Attiva (visibile all'AI)
                </label>
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
                  {editingItem ? 'Salva Modifiche' : 'Crea Domanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeManager;
