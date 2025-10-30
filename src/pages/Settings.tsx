import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { settingsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

interface SettingsState {
  // AI Settings
  openaiApiKey: string;
  openaiModel: string;
  openaiTemperature: number;
  aiConfidenceThreshold: number;
  aiSystemPrompt: string;

  // WhatsApp Settings
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;

  // Email Settings
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;

  // Cloudinary Settings (P0.1 - File Upload)
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;

  // Widget Colors
  widgetHeaderColor: string;
  widgetUserBalloonColor: string;
  widgetOperatorBalloonColor: string;
  widgetAiBalloonColor: string;
  widgetSendButtonColor: string;
  widgetBackgroundColor: string;
  widgetInputBackgroundColor: string;
  widgetTextColor: string;

  // Widget Layout
  widgetPosition: string;
  widgetTitle: string;

  // Widget Messages - Initial
  widgetGreeting: string;
  widgetPlaceholder: string;

  // Widget Messages - System
  widgetOperatorJoined: string;
  widgetOperatorLeft: string;
  widgetChatClosed: string;
  widgetTypingIndicator: string;

  // Widget Messages - Actions
  widgetRequestOperatorPrompt: string;
  widgetNoOperatorAvailable: string;
  widgetTicketCreated: string;

  // Widget Messages - Ticket Form
  widgetTicketFormTitle: string;
  widgetTicketFormDescription: string;
  widgetTicketContactMethodLabel: string;
  widgetTicketWhatsappLabel: string;
  widgetTicketEmailLabel: string;
  widgetTicketMessageLabel: string;
  widgetTicketSubmitButton: string;
  widgetTicketCancelButton: string;
}

const defaultSettings: SettingsState = {
  // AI Settings
  openaiApiKey: '',
  openaiModel: 'gpt-4-turbo-preview',
  openaiTemperature: 0.7,
  aiConfidenceThreshold: 0.7,
  aiSystemPrompt: 'Sei Lucy, l\'assistente virtuale di Lucine di Natale. Rispondi in modo cortese e professionale alle domande degli utenti. Se non sei sicuro di una risposta, suggerisci di parlare con un operatore umano.',

  // WhatsApp Settings
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioWhatsappNumber: '',

  // Email Settings
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  emailFrom: '',

  // Cloudinary Settings (P0.1 - File Upload)
  cloudinaryCloudName: '',
  cloudinaryApiKey: '',
  cloudinaryApiSecret: '',

  // Widget Colors
  widgetHeaderColor: '#dc2626',
  widgetUserBalloonColor: '#059669',
  widgetOperatorBalloonColor: '#10B981',
  widgetAiBalloonColor: '#059669',
  widgetSendButtonColor: '#dc2626',
  widgetBackgroundColor: '#1a1a1a',
  widgetInputBackgroundColor: '#2d2d2d',
  widgetTextColor: '#ffffff',

  // Widget Layout
  widgetPosition: 'bottom-right',
  widgetTitle: 'LUCY - ASSISTENTE VIRTUALE',

  // Widget Messages - Initial
  widgetGreeting: 'Ciao! Sono Lucy, il tuo assistente virtuale. Come posso aiutarti?',
  widgetPlaceholder: 'Scrivi un messaggio...',

  // Widget Messages - System
  widgetOperatorJoined: '{operatorName} si è unito alla chat',
  widgetOperatorLeft: 'L\'operatore ha lasciato la chat',
  widgetChatClosed: 'La chat è stata chiusa dall\'operatore. Grazie per averci contattato!',
  widgetTypingIndicator: 'sta scrivendo',

  // Widget Messages - Actions
  widgetRequestOperatorPrompt: 'Vuoi parlare con un operatore umano?',
  widgetNoOperatorAvailable: 'Nessun operatore disponibile al momento. Vuoi aprire un ticket?',
  widgetTicketCreated: 'Ticket creato con successo! Ti contatteremo presto.',

  // Widget Messages - Ticket Form
  widgetTicketFormTitle: 'Apri un Ticket',
  widgetTicketFormDescription: 'Lascia i tuoi contatti e ti risponderemo al più presto',
  widgetTicketContactMethodLabel: 'Come preferisci essere contattato?',
  widgetTicketWhatsappLabel: 'WhatsApp',
  widgetTicketEmailLabel: 'Email',
  widgetTicketMessageLabel: 'Descrivi brevemente la tua richiesta',
  widgetTicketSubmitButton: 'Invia Ticket',
  widgetTicketCancelButton: 'Annulla',
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Test connection states
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<string | null>(null);
  const [whatsAppTestResult, setWhatsAppTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await settingsApi.getAll();
      console.log('Settings API response:', response);

      // Handle different response formats
      let allSettings = [];
      if (Array.isArray(response)) {
        allSettings = response;
      } else if (response?.data && Array.isArray(response.data)) {
        allSettings = response.data;
      } else if (typeof response === 'object' && response !== null) {
        // If response is an object but not an array, convert it to array format
        console.warn('Unexpected settings format, using defaults');
        allSettings = [];
      }

      const settingsMap: Record<string, any> = {};
      allSettings.forEach((setting: any) => {
        if (setting && setting.key) {
          settingsMap[setting.key] = setting.value;
        }
      });

      setSettings((prev) => ({
        ...prev,
        ...settingsMap,
      }));
    } catch (err: any) {
      console.error('Failed to fetch settings:', err);
      console.error('Error response:', err.response);

      if (err.response?.status === 404) {
        setError('Endpoint settings non trovato sul backend. Usando valori di default.');
      } else if (err.response?.status === 401) {
        setError('Non autorizzato. Effettua il login.');
      } else {
        setError('Errore durante il caricamento delle impostazioni');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof SettingsState, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Save all settings
      for (const [key, value] of Object.entries(settings)) {
        await settingsApi.upsert(key, value);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Errore durante il salvataggio delle impostazioni');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      setEmailTestResult(null);
      const result = await settingsApi.testEmail();
      setEmailTestResult(`✓ Test email inviata con successo a ${result.data.recipient}`);
    } catch (error: any) {
      setEmailTestResult(`✗ Errore: ${error.response?.data?.error?.message || 'Test fallito'}`);
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestWhatsApp = async () => {
    const phoneNumber = prompt('Inserisci il numero WhatsApp per il test (es: +393001234567):');
    if (!phoneNumber) return;

    try {
      setTestingWhatsApp(true);
      setWhatsAppTestResult(null);
      const result = await settingsApi.testWhatsApp(phoneNumber);
      setWhatsAppTestResult(`✓ Messaggio inviato con successo a ${result.data.recipient}`);
    } catch (error: any) {
      setWhatsAppTestResult(`✗ Errore: ${error.response?.data?.error?.message || 'Test fallito'}`);
    } finally {
      setTestingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <PageHeader
          title="Impostazioni"
          description="Configura le impostazioni del sistema"
          action={
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvo...' : 'Salva Modifiche'}
            </Button>
          }
        />

        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-md p-3">
            Impostazioni salvate con successo!
          </div>
        )}

        <Tabs defaultValue="generale" className="space-y-6">
          <TabsList>
            <TabsTrigger value="generale">Generale</TabsTrigger>
            <TabsTrigger value="integrazioni">Integrazioni</TabsTrigger>
            <TabsTrigger value="widget">Widget</TabsTrigger>
          </TabsList>

          <TabsContent value="generale" className="space-y-6">
        {/* AI Settings */}
        <SettingsSection
          title="Intelligenza Artificiale"
          description="Configura le impostazioni dell'AI e del modello OpenAI"
          fields={[
            {
              label: 'OpenAI API Key',
              type: 'password',
              value: settings.openaiApiKey,
              onChange: (value) => handleChange('openaiApiKey', value),
              placeholder: 'sk-...',
            },
            {
              label: 'Modello OpenAI',
              type: 'select',
              value: settings.openaiModel,
              onChange: (value) => handleChange('openaiModel', value),
              options: [
                { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
                { value: 'gpt-4', label: 'GPT-4' },
                { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
              ],
            },
            {
              label: 'Temperature',
              type: 'number',
              value: settings.openaiTemperature,
              onChange: (value) => handleChange('openaiTemperature', parseFloat(value)),
              min: 0,
              max: 1,
              step: 0.1,
            },
            {
              label: 'Confidence Threshold',
              type: 'number',
              value: settings.aiConfidenceThreshold,
              onChange: (value) => handleChange('aiConfidenceThreshold', parseFloat(value)),
              min: 0,
              max: 1,
              step: 0.1,
              description: 'Soglia minima di confidenza per le risposte AI (0-1)',
            },
            {
              label: 'System Prompt',
              type: 'textarea',
              value: settings.aiSystemPrompt,
              onChange: (value) => handleChange('aiSystemPrompt', value),
              placeholder: 'Sei un assistente virtuale...',
              description: 'Prompt di sistema che definisce il comportamento e la personalità dell\'AI',
              rows: 4,
            },
          ]}
        />
          </TabsContent>

          <TabsContent value="integrazioni" className="space-y-6">
        {/* WhatsApp Settings */}
        <SettingsSection
          title="WhatsApp (Twilio)"
          description="Configura l'integrazione WhatsApp tramite Twilio"
          fields={[
            {
              label: 'Twilio Account SID',
              type: 'text',
              value: settings.twilioAccountSid,
              onChange: (value) => handleChange('twilioAccountSid', value),
              placeholder: 'AC...',
            },
            {
              label: 'Twilio Auth Token',
              type: 'password',
              value: settings.twilioAuthToken,
              onChange: (value) => handleChange('twilioAuthToken', value),
            },
            {
              label: 'Numero WhatsApp',
              type: 'text',
              value: settings.twilioWhatsappNumber,
              onChange: (value) => handleChange('twilioWhatsappNumber', value),
              placeholder: 'whatsapp:+14155238886',
            },
          ]}
          actions={
            <div className="space-y-2">
              <Button
                onClick={handleTestWhatsApp}
                disabled={testingWhatsApp}
                variant="outline"
                size="sm"
              >
                {testingWhatsApp ? 'Invio in corso...' : 'Testa Connessione WhatsApp'}
              </Button>
              {whatsAppTestResult && (
                <p className="text-sm text-muted-foreground">{whatsAppTestResult}</p>
              )}
            </div>
          }
        />

        {/* Email Settings */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📧 Guida SendGrid</h4>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            Per usare SendGrid, configura i seguenti valori:
          </p>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li><strong>SMTP Host:</strong> smtp.sendgrid.net</li>
            <li><strong>SMTP Port:</strong> 587</li>
            <li><strong>SMTP User:</strong> apikey <span className="italic">(letteralmente "apikey")</span></li>
            <li><strong>SMTP Password:</strong> La tua API Key SendGrid (es: SG.xxxxx...)</li>
            <li><strong>Email From:</strong> Il tuo indirizzo email verificato su SendGrid</li>
          </ul>
        </div>

        <SettingsSection
          title="Email (SMTP)"
          description="Configura il server SMTP per l'invio di email"
          fields={[
            {
              label: 'SMTP Host',
              type: 'text',
              value: settings.smtpHost,
              onChange: (value) => handleChange('smtpHost', value),
              placeholder: 'smtp.gmail.com',
            },
            {
              label: 'SMTP Port',
              type: 'number',
              value: settings.smtpPort,
              onChange: (value) => handleChange('smtpPort', parseInt(value)),
              placeholder: '587',
            },
            {
              label: 'SMTP User',
              type: 'text',
              value: settings.smtpUser,
              onChange: (value) => handleChange('smtpUser', value),
              placeholder: 'SendGrid: "apikey" | Gmail: user@example.com',
              description: 'Per SendGrid, inserisci letteralmente "apikey" (senza virgolette)',
            },
            {
              label: 'SMTP Password',
              type: 'password',
              value: settings.smtpPassword,
              onChange: (value) => handleChange('smtpPassword', value),
            },
            {
              label: 'Email From',
              type: 'text',
              value: settings.emailFrom,
              onChange: (value) => handleChange('emailFrom', value),
              placeholder: 'noreply@lucinedinatale.it',
            },
          ]}
          actions={
            <div className="space-y-2">
              <Button
                onClick={handleTestEmail}
                disabled={testingEmail}
                variant="outline"
                size="sm"
              >
                {testingEmail ? 'Invio in corso...' : 'Testa Connessione Email'}
              </Button>
              {emailTestResult && (
                <p className="text-sm text-muted-foreground">{emailTestResult}</p>
              )}
            </div>
          }
        />

        {/* Cloudinary Settings */}
        <SettingsSection
          title="Cloudinary (File Storage)"
          description="Configura Cloudinary per l'upload di file in chat"
          fields={[
            {
              label: 'Cloud Name',
              type: 'text',
              value: settings.cloudinaryCloudName,
              onChange: (value) => handleChange('cloudinaryCloudName', value),
              placeholder: 'dja2b7cyw',
            },
            {
              label: 'API Key',
              type: 'text',
              value: settings.cloudinaryApiKey,
              onChange: (value) => handleChange('cloudinaryApiKey', value),
              placeholder: '778117516175176',
            },
            {
              label: 'API Secret',
              type: 'password',
              value: settings.cloudinaryApiSecret,
              onChange: (value) => handleChange('cloudinaryApiSecret', value),
              placeholder: '••••••••••••',
            },
          ]}
        />
          </TabsContent>

          <TabsContent value="widget" className="space-y-6">
        {/* Widget Colors */}
        <SettingsSection
          title="Widget - Colori"
          description="Personalizza i colori del widget chat"
          fields={[
            {
              label: 'Header',
              type: 'color',
              value: settings.widgetHeaderColor,
              onChange: (value) => handleChange('widgetHeaderColor', value),
              description: 'Colore dell\'intestazione del widget',
            },
            {
              label: 'Balloon Utente',
              type: 'color',
              value: settings.widgetUserBalloonColor,
              onChange: (value) => handleChange('widgetUserBalloonColor', value),
              description: 'Colore dei messaggi inviati dall\'utente',
            },
            {
              label: 'Balloon Operatore',
              type: 'color',
              value: settings.widgetOperatorBalloonColor,
              onChange: (value) => handleChange('widgetOperatorBalloonColor', value),
              description: 'Colore dei messaggi inviati dall\'operatore',
            },
            {
              label: 'Balloon AI',
              type: 'color',
              value: settings.widgetAiBalloonColor,
              onChange: (value) => handleChange('widgetAiBalloonColor', value),
              description: 'Colore dei messaggi generati dall\'AI',
            },
            {
              label: 'Pulsante Invio',
              type: 'color',
              value: settings.widgetSendButtonColor,
              onChange: (value) => handleChange('widgetSendButtonColor', value),
              description: 'Colore del pulsante di invio messaggio',
            },
            {
              label: 'Sfondo Widget',
              type: 'color',
              value: settings.widgetBackgroundColor,
              onChange: (value) => handleChange('widgetBackgroundColor', value),
              description: 'Colore di sfondo del widget',
            },
            {
              label: 'Sfondo Input',
              type: 'color',
              value: settings.widgetInputBackgroundColor,
              onChange: (value) => handleChange('widgetInputBackgroundColor', value),
              description: 'Colore di sfondo del campo input',
            },
            {
              label: 'Colore Testo',
              type: 'color',
              value: settings.widgetTextColor,
              onChange: (value) => handleChange('widgetTextColor', value),
              description: 'Colore del testo principale',
            },
          ]}
        />

        {/* Widget Layout */}
        <SettingsSection
          title="Widget - Layout"
          description="Configura posizione e intestazione del widget"
          fields={[
            {
              label: 'Posizione',
              type: 'select',
              value: settings.widgetPosition,
              onChange: (value) => handleChange('widgetPosition', value),
              options: [
                { value: 'bottom-right', label: 'In basso a destra' },
                { value: 'bottom-left', label: 'In basso a sinistra' },
                { value: 'top-right', label: 'In alto a destra' },
                { value: 'top-left', label: 'In alto a sinistra' },
              ],
            },
            {
              label: 'Titolo',
              type: 'text',
              value: settings.widgetTitle,
              onChange: (value) => handleChange('widgetTitle', value),
              placeholder: 'LUCY - ASSISTENTE VIRTUALE',
              description: 'Titolo mostrato nell\'header del widget',
            },
          ]}
        />

        {/* Widget Messages - Initial */}
        <SettingsSection
          title="Widget - Messaggi Iniziali"
          description="Messaggi mostrati all'avvio della chat"
          fields={[
            {
              label: 'Messaggio di Benvenuto',
              type: 'textarea',
              value: settings.widgetGreeting,
              onChange: (value) => handleChange('widgetGreeting', value),
              placeholder: 'Ciao! Sono Lucy...',
              description: 'Primo messaggio mostrato quando l\'utente apre il widget',
              rows: 2,
            },
            {
              label: 'Placeholder Input',
              type: 'text',
              value: settings.widgetPlaceholder,
              onChange: (value) => handleChange('widgetPlaceholder', value),
              placeholder: 'Scrivi un messaggio...',
              description: 'Testo segnaposto nel campo di input',
            },
          ]}
        />

        {/* Widget Messages - System */}
        <SettingsSection
          title="Widget - Messaggi di Sistema"
          description="Messaggi mostrati per eventi di sistema"
          fields={[
            {
              label: 'Operatore Connesso',
              type: 'text',
              value: settings.widgetOperatorJoined,
              onChange: (value) => handleChange('widgetOperatorJoined', value),
              placeholder: '{operatorName} si è unito alla chat',
              description: 'Usa {operatorName} per il nome dell\'operatore',
            },
            {
              label: 'Operatore Disconnesso',
              type: 'text',
              value: settings.widgetOperatorLeft,
              onChange: (value) => handleChange('widgetOperatorLeft', value),
              placeholder: 'L\'operatore ha lasciato la chat',
            },
            {
              label: 'Chat Chiusa',
              type: 'text',
              value: settings.widgetChatClosed,
              onChange: (value) => handleChange('widgetChatClosed', value),
              placeholder: 'La chat è stata chiusa...',
              description: 'Messaggio quando l\'operatore chiude la chat',
            },
            {
              label: 'Indicatore Digitazione',
              type: 'text',
              value: settings.widgetTypingIndicator,
              onChange: (value) => handleChange('widgetTypingIndicator', value),
              placeholder: 'sta scrivendo',
              description: 'Testo mostrato quando qualcuno sta scrivendo',
            },
          ]}
        />

        {/* Widget Messages - Actions */}
        <SettingsSection
          title="Widget - Messaggi Azioni"
          description="Messaggi per richieste e azioni dell'utente"
          fields={[
            {
              label: 'Richiesta Operatore',
              type: 'text',
              value: settings.widgetRequestOperatorPrompt,
              onChange: (value) => handleChange('widgetRequestOperatorPrompt', value),
              placeholder: 'Vuoi parlare con un operatore umano?',
              description: 'Messaggio quando l\'AI suggerisce di parlare con un operatore',
            },
            {
              label: 'Nessun Operatore Disponibile',
              type: 'text',
              value: settings.widgetNoOperatorAvailable,
              onChange: (value) => handleChange('widgetNoOperatorAvailable', value),
              placeholder: 'Nessun operatore disponibile...',
              description: 'Messaggio quando nessun operatore è online',
            },
            {
              label: 'Ticket Creato',
              type: 'text',
              value: settings.widgetTicketCreated,
              onChange: (value) => handleChange('widgetTicketCreated', value),
              placeholder: 'Ticket creato con successo!',
              description: 'Messaggio di conferma creazione ticket',
            },
          ]}
        />

        {/* Widget Messages - Ticket Form */}
        <SettingsSection
          title="Widget - Form Ticket"
          description="Testi del form di creazione ticket"
          fields={[
            {
              label: 'Titolo Form',
              type: 'text',
              value: settings.widgetTicketFormTitle,
              onChange: (value) => handleChange('widgetTicketFormTitle', value),
              placeholder: 'Apri un Ticket',
            },
            {
              label: 'Descrizione Form',
              type: 'text',
              value: settings.widgetTicketFormDescription,
              onChange: (value) => handleChange('widgetTicketFormDescription', value),
              placeholder: 'Lascia i tuoi contatti...',
            },
            {
              label: 'Label Metodo Contatto',
              type: 'text',
              value: settings.widgetTicketContactMethodLabel,
              onChange: (value) => handleChange('widgetTicketContactMethodLabel', value),
              placeholder: 'Come preferisci essere contattato?',
            },
            {
              label: 'Label WhatsApp',
              type: 'text',
              value: settings.widgetTicketWhatsappLabel,
              onChange: (value) => handleChange('widgetTicketWhatsappLabel', value),
              placeholder: 'WhatsApp',
            },
            {
              label: 'Label Email',
              type: 'text',
              value: settings.widgetTicketEmailLabel,
              onChange: (value) => handleChange('widgetTicketEmailLabel', value),
              placeholder: 'Email',
            },
            {
              label: 'Label Messaggio',
              type: 'text',
              value: settings.widgetTicketMessageLabel,
              onChange: (value) => handleChange('widgetTicketMessageLabel', value),
              placeholder: 'Descrivi brevemente...',
            },
            {
              label: 'Testo Pulsante Invia',
              type: 'text',
              value: settings.widgetTicketSubmitButton,
              onChange: (value) => handleChange('widgetTicketSubmitButton', value),
              placeholder: 'Invia Ticket',
            },
            {
              label: 'Testo Pulsante Annulla',
              type: 'text',
              value: settings.widgetTicketCancelButton,
              onChange: (value) => handleChange('widgetTicketCancelButton', value),
              placeholder: 'Annulla',
            },
          ]}
        />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
