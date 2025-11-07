import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default widget strings
const DEFAULT_WIDGET_STRINGS = {
  // AI typing indicator
  'ai.typing': 'Lucy sta scrivendo',

  // Welcome messages
  'welcome.initial': '👋 Ciao! Sono Lucy, la tua assistente virtuale. Come posso aiutarti oggi?',
  'welcome.new_chat': '💬 Nuova chat avviata. Come posso aiutarti?',

  // Operator typing
  'operator.typing': '{operatorName} sta scrivendo',

  // Chat closure
  'closure.inactivity': 'Chat chiusa per inattività. Puoi riaprirla o iniziarne una nuova!',
  'closure.operator': 'La chat è stata chiusa. Grazie per averci contattato!',
  'closure.operator_inactivity': 'La chat è stata chiusa per inattività. Puoi iniziare una nuova conversazione quando vuoi!',
  'closure.ended': 'Chat chiusa',
  'closure.ended_inactivity': 'Chat chiusa per inattività',

  // Return to AI
  'return_to_ai.confirm_question': '⚠️ Vuoi tornare all\'assistente AI? L\'operatore verrà disconnesso dalla chat.',
  'return_to_ai.confirm_yes': 'Sì, torna ad AI',
  'return_to_ai.confirm_no': 'Annulla',
  'return_to_ai.success': '✅ Sei tornato all\'assistente AI. Come posso aiutarti?',
  'return_to_ai.error': '❌ Errore durante il ritorno all\'assistente AI. Riprova.',

  // End conversation
  'end_conversation.confirm_question': '⚠️ Vuoi terminare questa conversazione e iniziare da zero? Tutta la cronologia della chat verrà rimossa.',
  'end_conversation.confirm_yes': 'Sì, termina',
  'end_conversation.confirm_no': 'Annulla',
  'end_conversation.cancelled': '✅ Conversazione continuata.',
  'end_conversation.error': '❌ Errore durante la terminazione. La chat verrà comunque resettata.',

  // File upload
  'file_upload.too_large': '❌ File troppo grande. Dimensione massima: 10MB',
  'file_upload.no_session': '❌ Sessione non attiva. Riprova.',
  'file_upload.error': '❌ Errore durante l\'upload del file',

  // Operator request
  'operator_request.cancelled': 'Richiesta annullata. Puoi continuare con l\'assistente AI.',
  'operator_request.cancel_error': '❌ Errore durante l\'annullamento della richiesta.',

  // Fresh chat error
  'fresh_chat.operator_active': '⚠️ Non puoi iniziare una nuova chat mentre sei connesso con un operatore. L\'operatore deve chiudere la chat prima.',

  // Ratings
  'rating.ai_title': 'Come valuti l\'assistente AI?',
  'rating.ai_subtitle': 'L\'AI è stata utile? Il tuo feedback ci aiuta a migliorare',
  'rating.operator_title': 'Come valuti il supporto?',
  'rating.operator_subtitle': 'Il tuo feedback ci aiuta a migliorare',
  'rating.placeholder': 'Commento opzionale...',
  'rating.submit': 'Invia',
  'rating.submitting': 'Invio...',
  'rating.skip': 'Salta',
  'rating.thanks': 'Grazie per il feedback!',
  'rating.thanks_subtitle': 'Il tuo parere ci aiuta a migliorare',
  'rating.error': '❌ Errore durante l\'invio del rating. Riprova.',

  // Form validations
  'validation.ticket_required': '⚠️ Compila tutti i campi del ticket.',
  'validation.email_invalid': '⚠️ Inserisci un indirizzo email valido.',
  'validation.name_length': '⚠️ Inserisci un nome valido (2-50 caratteri).',
  'validation.name_chars': '⚠️ Il nome può contenere solo lettere e spazi.',
  'validation.name_save_error': '❌ Errore nel salvataggio del nome. Riprova.',

  // Reactivate AI chat
  'reactivate.no_session': '❌ Errore: nessuna sessione da riattivare.',
  'reactivate.loading': '🔄 Riattivazione chat in corso...',
  'reactivate.expired': '⏰ Chat chiusa da troppo tempo. Iniziamo una nuova conversazione!',
  'reactivate.new_chat_starting': '💬 Nuova chat avviata. Come posso aiutarti?',
  'reactivate.success': '✅ Chat riattivata! Continua pure la conversazione.',
  'reactivate.error': '❌ Errore durante la riattivazione. Riprova o inizia una nuova chat.'
};

/**
 * GET /api/config/widget-strings
 * Public endpoint - get all widget strings for the chatbot
 */
export const getWidgetStrings = async (req, res) => {
  try {
    // Get all widget string settings
    const settings = await prisma.systemSettings.findMany({
      where: {
        category: 'WIDGET_STRINGS'
      },
      select: {
        key: true,
        value: true
      }
    });

    // Convert to object
    const strings = {};
    settings.forEach(setting => {
      strings[setting.key] = setting.value;
    });

    // Return merged with defaults (in case some are missing)
    res.json({
      success: true,
      data: {
        strings: { ...DEFAULT_WIDGET_STRINGS, ...strings }
      }
    });
  } catch (error) {
    console.error('Get widget strings error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
};

/**
 * GET /api/settings/widget-strings
 * Protected endpoint - get all widget strings for admin dashboard
 */
export const getWidgetStringsForAdmin = async (req, res) => {
  try {
    // Get all widget string settings
    const settings = await prisma.systemSettings.findMany({
      where: {
        category: 'WIDGET_STRINGS'
      },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        updatedBy: true,
        updatedAt: true
      },
      orderBy: {
        key: 'asc'
      }
    });

    // Convert to object with defaults
    const strings = {};
    const customStrings = {};

    settings.forEach(setting => {
      customStrings[setting.key] = {
        value: setting.value,
        isDefault: false,
        ...setting
      };
    });

    // Add defaults for missing keys
    Object.entries(DEFAULT_WIDGET_STRINGS).forEach(([key, defaultValue]) => {
      if (!customStrings[key]) {
        strings[key] = {
          key,
          value: defaultValue,
          isDefault: true,
          description: null
        };
      } else {
        strings[key] = customStrings[key];
      }
    });

    res.json({
      success: true,
      data: {
        strings: Object.values(strings),
        defaults: DEFAULT_WIDGET_STRINGS
      }
    });
  } catch (error) {
    console.error('Get widget strings for admin error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
};

/**
 * PUT /api/settings/widget-strings
 * Protected endpoint - update widget strings
 */
export const updateWidgetStrings = async (req, res) => {
  try {
    const { strings } = req.body;
    const operatorId = req.operator.id;

    if (!strings || typeof strings !== 'object') {
      return res.status(400).json({
        error: { message: 'Invalid request: strings object required' }
      });
    }

    // Validate that all keys are valid
    const validKeys = Object.keys(DEFAULT_WIDGET_STRINGS);
    const invalidKeys = Object.keys(strings).filter(key => !validKeys.includes(key));

    if (invalidKeys.length > 0) {
      return res.status(400).json({
        error: {
          message: `Invalid string keys: ${invalidKeys.join(', ')}`,
          invalidKeys
        }
      });
    }

    // Update or create each setting
    const updates = Object.entries(strings).map(([key, value]) => {
      return prisma.systemSettings.upsert({
        where: {
          key: key
        },
        create: {
          key,
          value,
          category: 'WIDGET_STRINGS',
          description: `Widget string: ${key}`,
          updatedBy: operatorId
        },
        update: {
          value,
          updatedBy: operatorId
        }
      });
    });

    await Promise.all(updates);

    console.log(`✅ Widget strings updated by operator ${operatorId}`);

    res.json({
      success: true,
      data: {
        message: 'Widget strings updated successfully',
        updatedCount: updates.length
      }
    });
  } catch (error) {
    console.error('Update widget strings error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
};

/**
 * POST /api/settings/widget-strings/reset
 * Protected endpoint - reset all strings to defaults
 */
export const resetWidgetStrings = async (req, res) => {
  try {
    const operatorId = req.operator.id;

    // Delete all custom widget strings
    await prisma.systemSettings.deleteMany({
      where: {
        category: 'WIDGET_STRINGS'
      }
    });

    console.log(`✅ Widget strings reset to defaults by operator ${operatorId}`);

    res.json({
      success: true,
      data: {
        message: 'Widget strings reset to defaults',
        defaults: DEFAULT_WIDGET_STRINGS
      }
    });
  } catch (error) {
    console.error('Reset widget strings error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
};
