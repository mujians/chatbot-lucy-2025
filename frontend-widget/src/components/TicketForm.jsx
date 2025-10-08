import React, { useState } from 'react';

const TicketForm = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    userName: '',
    initialMessage: '',
    contactMethod: 'WHATSAPP',
    whatsappNumber: '',
    email: '',
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.userName.trim()) {
      newErrors.userName = 'Nome richiesto';
    }

    if (!formData.initialMessage.trim()) {
      newErrors.initialMessage = 'Messaggio richiesto';
    }

    if (formData.contactMethod === 'WHATSAPP') {
      if (!formData.whatsappNumber.trim()) {
        newErrors.whatsappNumber = 'Numero WhatsApp richiesto';
      } else if (!/^\+?[0-9]{10,15}$/.test(formData.whatsappNumber.replace(/\s/g, ''))) {
        newErrors.whatsappNumber = 'Numero non valido';
      }
    }

    if (formData.contactMethod === 'EMAIL') {
      if (!formData.email.trim()) {
        newErrors.email = 'Email richiesta';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Email non valida';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSubmit(formData);
  };

  return (
    <div className="ticket-form-container bg-white p-6 rounded-lg animate-slideUp">
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        Lascia i tuoi contatti
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Nessun operatore disponibile. Ti ricontatteremo!
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <input
            type="text"
            placeholder="Il tuo nome"
            value={formData.userName}
            onChange={(e) =>
              setFormData({ ...formData, userName: e.target.value })
            }
            className={`w-full px-4 py-2 border ${
              errors.userName ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:ring-2 focus:ring-christmas-green focus:border-transparent`}
          />
          {errors.userName && (
            <p className="text-xs text-red-500 mt-1">{errors.userName}</p>
          )}
        </div>

        {/* Messaggio */}
        <div>
          <textarea
            placeholder="Messaggio"
            value={formData.initialMessage}
            onChange={(e) =>
              setFormData({ ...formData, initialMessage: e.target.value })
            }
            rows={3}
            className={`w-full px-4 py-2 border ${
              errors.initialMessage ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:ring-2 focus:ring-christmas-green focus:border-transparent resize-none`}
          />
          {errors.initialMessage && (
            <p className="text-xs text-red-500 mt-1">{errors.initialMessage}</p>
          )}
        </div>

        {/* Contact Method Selector */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Come preferisci essere ricontattato?
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-christmas-green transition-colors">
              <input
                type="radio"
                name="contactMethod"
                value="WHATSAPP"
                checked={formData.contactMethod === 'WHATSAPP'}
                onChange={(e) =>
                  setFormData({ ...formData, contactMethod: e.target.value })
                }
                className="w-4 h-4 text-christmas-green"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">WhatsApp</span>
                  <span className="text-xs text-gray-500">(risposta più veloce)</span>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-christmas-green transition-colors">
              <input
                type="radio"
                name="contactMethod"
                value="EMAIL"
                checked={formData.contactMethod === 'EMAIL'}
                onChange={(e) =>
                  setFormData({ ...formData, contactMethod: e.target.value })
                }
                className="w-4 h-4 text-christmas-green"
              />
              <div className="flex-1">
                <span className="font-medium">Email</span>
              </div>
            </label>
          </div>
        </div>

        {/* Contact Field (conditional) */}
        {formData.contactMethod === 'WHATSAPP' ? (
          <div>
            <input
              type="tel"
              placeholder="+39 333 1234567"
              value={formData.whatsappNumber}
              onChange={(e) =>
                setFormData({ ...formData, whatsappNumber: e.target.value })
              }
              className={`w-full px-4 py-2 border ${
                errors.whatsappNumber ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-christmas-green focus:border-transparent`}
            />
            {errors.whatsappNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.whatsappNumber}</p>
            )}
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="tua@email.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className={`w-full px-4 py-2 border ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-christmas-green focus:border-transparent`}
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email}</p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-christmas-green text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Invio...' : 'INVIA RICHIESTA'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketForm;
