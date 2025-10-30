import { useState, useEffect } from 'react';
import { Trash2, Edit2, Save, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { chatApi } from '@/lib/api';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface InternalNote {
  id: string;
  content: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
  updatedAt: string;
}

interface InternalNotesPanelProps {
  sessionId: string;
  notes: InternalNote[];
  onNotesChange: () => void;
}

export function InternalNotesPanel({ sessionId, notes, onNotesChange }: InternalNotesPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { operator } = useAuth();

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    setLoading(true);
    try {
      await chatApi.addInternalNote(sessionId, newNoteContent.trim());
      setNewNoteContent('');
      setIsAdding(false);
      onNotesChange(); // Refresh notes
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Errore nell\'aggiunta della nota');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim()) return;

    setLoading(true);
    try {
      await chatApi.updateInternalNote(sessionId, noteId, editingContent.trim());
      setEditingNoteId(null);
      setEditingContent('');
      onNotesChange(); // Refresh notes
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Errore nell\'aggiornamento della nota');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Eliminare questa nota?')) return;

    setLoading(true);
    try {
      await chatApi.deleteInternalNote(sessionId, noteId);
      onNotesChange(); // Refresh notes
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Errore nell\'eliminazione della nota');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (note: InternalNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Note Interne</h3>
          {!isAdding && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAdding(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Visibili solo agli operatori
        </p>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Add Note Form */}
        {isAdding && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Scrivi una nota interna..."
              className="min-h-[80px] mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={loading || !newNoteContent.trim()}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-1" />
                Salva
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewNoteContent('');
                }}
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Existing Notes */}
        {notes.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Nessuna nota interna</p>
            <p className="text-xs mt-1">Aggiungi note visibili solo al team</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
            >
              {editingNoteId === note.id ? (
                // Edit Mode
                <>
                  <Textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="min-h-[80px] mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={loading || !editingContent.trim()}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Salva
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                // View Mode
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                    {note.operatorId === operator?.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(note)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifica"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium">{note.operatorName}</span>
                    <span>
                      {format(new Date(note.createdAt), 'dd MMM yyyy HH:mm', { locale: it })}
                    </span>
                  </div>
                  {note.updatedAt !== note.createdAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Modificato: {format(new Date(note.updatedAt), 'dd MMM yyyy HH:mm', { locale: it })}
                    </p>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
