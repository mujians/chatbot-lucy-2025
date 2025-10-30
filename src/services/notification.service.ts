/**
 * Notification Service
 * Gestisce notifiche browser, badge, e suoni
 * P2.8: Ora rispetta le preferenze dell'operatore (quiet hours, toggles)
 */

interface OperatorPreferences {
  email: {
    newChat: boolean;
    newTicket: boolean;
    ticketResumed: boolean;
  };
  whatsapp: {
    newChat: boolean;
    newTicket: boolean;
    ticketResumed: boolean;
  };
  inApp: {
    newChat: boolean;
    newTicket: boolean;
    chatMessage: boolean;
    ticketResumed: boolean;
  };
  audio: {
    newChat: boolean;
    newTicket: boolean;
    chatMessage: boolean;
    ticketResumed: boolean;
  };
  quietHours: {
    start: string; // "22:00"
    end: string;   // "08:00"
  };
}

class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private permission: NotificationPermission = 'default';
  private preferences: OperatorPreferences | null = null;

  constructor() {
    this.initAudio();
    this.checkPermission();
    this.loadPreferences();
  }

  /**
   * Inizializza audio per notifiche
   */
  private initAudio() {
    // Crea un beep sound semplice usando Web Audio API
    try {
      // Per ora usiamo un suono di sistema, poi si può sostituire con un file audio custom
      this.audio = new Audio();
      // Base64 encoded simple beep sound (440Hz, 200ms)
      const beepSound = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZWQ==';
      this.audio.src = beepSound;
    } catch (error) {
      console.error('Failed to init audio:', error);
    }
  }

  /**
   * Verifica permessi notifiche browser
   */
  private checkPermission() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * P2.8: Carica preferenze operatore dal backend
   */
  private async loadPreferences(): Promise<void> {
    try {
      const operatorId = localStorage.getItem('operator_id');
      if (!operatorId) {
        console.warn('No operator ID found, using default notification preferences');
        return;
      }

      const response = await fetch(`/api/operators/${operatorId}`);
      const data = await response.json();

      const prefs = data.data?.notificationPreferences;

      // Default preferences
      const defaultPreferences: OperatorPreferences = {
        email: { newChat: true, newTicket: true, ticketResumed: true },
        whatsapp: { newChat: false, newTicket: false, ticketResumed: true },
        inApp: { newChat: true, newTicket: true, chatMessage: true, ticketResumed: true },
        audio: { newChat: true, newTicket: true, chatMessage: false, ticketResumed: true },
        quietHours: { start: '22:00', end: '08:00' }
      };

      this.preferences = typeof prefs === 'string'
        ? { ...defaultPreferences, ...JSON.parse(prefs) }
        : { ...defaultPreferences, ...prefs };

      console.log('✅ Operator preferences loaded:', this.preferences);
    } catch (error) {
      console.error('Failed to load operator preferences:', error);
    }
  }

  /**
   * P2.8: Verifica se siamo in orari di silenzio
   */
  private isInQuietHours(): boolean {
    if (!this.preferences) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const { start, end } = this.preferences.quietHours;

    // Handle quiet hours that cross midnight (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    } else {
      return currentTime >= start && currentTime < end;
    }
  }

  /**
   * P2.8: Verifica se riprodurre audio per un evento
   */
  private shouldPlayAudio(eventType: 'newChat' | 'newTicket' | 'chatMessage' | 'ticketResumed'): boolean {
    if (!this.preferences) return true; // Default: play sound
    if (this.isInQuietHours()) return false; // No audio during quiet hours
    return this.preferences.audio[eventType];
  }

  /**
   * P2.8: Verifica se mostrare notifica browser per un evento
   */
  private shouldShowNotification(eventType: 'newChat' | 'newTicket' | 'chatMessage' | 'ticketResumed'): boolean {
    if (!this.preferences) return true; // Default: show notification
    if (this.isInQuietHours()) return false; // No notifications during quiet hours
    return this.preferences.inApp[eventType];
  }

  /**
   * Richiede permessi notifiche browser
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Mostra notifica browser
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    // Richiedi permesso se non ancora concesso
    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    try {
      const notification = new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'lucine-chatbot',
        ...options,
      });

      // Auto-close dopo 5 secondi
      setTimeout(() => notification.close(), 5000);

      // Focus finestra quando si clicca la notifica
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  /**
   * Suona notifica audio
   * P2.8: Ora accetta eventType opzionale per rispettare preferenze
   */
  playSound(eventType?: 'newChat' | 'newTicket' | 'chatMessage' | 'ticketResumed'): void {
    // If eventType is provided, check preferences
    if (eventType && !this.shouldPlayAudio(eventType)) {
      return;
    }

    if (this.audio) {
      try {
        this.audio.currentTime = 0;
        this.audio.play().catch((error) => {
          console.warn('Failed to play notification sound:', error);
        });
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
  }

  /**
   * Notifica nuovo messaggio
   * P2.8: Ora rispetta preferenze operatore
   */
  async notifyNewMessage(chatId: string, userName: string, message: string): Promise<void> {
    // Check if we should show browser notification
    if (this.shouldShowNotification('chatMessage')) {
      await this.showNotification(`Nuovo messaggio da ${userName}`, {
        body: message.length > 100 ? message.substring(0, 100) + '...' : message,
        tag: `chat-${chatId}`,
      });
    }

    // Check if we should play audio
    if (this.shouldPlayAudio('chatMessage')) {
      this.playSound();
    }
  }

  /**
   * Notifica nuova chat assegnata
   * P2.8: Ora rispetta preferenze operatore
   */
  async notifyNewChat(chatId: string, userName: string): Promise<void> {
    // Check if we should show browser notification
    if (this.shouldShowNotification('newChat')) {
      await this.showNotification('Nuova chat assegnata', {
        body: `${userName} ha richiesto assistenza`,
        tag: `new-chat-${chatId}`,
      });
    }

    // Check if we should play audio
    if (this.shouldPlayAudio('newChat')) {
      this.playSound();
    }
  }

  /**
   * Notifica chat trasferita
   * P2.8: Ora rispetta preferenze operatore (maps to newChat)
   */
  async notifyTransferredChat(chatId: string, userName: string, fromOperator: string): Promise<void> {
    // Treat transfers like new chats for notification purposes
    if (this.shouldShowNotification('newChat')) {
      await this.showNotification('Chat trasferita', {
        body: `${fromOperator} ti ha trasferito la chat con ${userName}`,
        tag: `transfer-${chatId}`,
      });
    }

    if (this.shouldPlayAudio('newChat')) {
      this.playSound();
    }
  }

  /**
   * Aggiorna badge count nel favicon (se supportato)
   */
  updateBadgeCount(count: number): void {
    // Prova a usare Badge API se disponibile (Chrome/Edge su mobile)
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }

    // Aggiorna anche il titolo della pagina
    this.updatePageTitle(count);
  }

  /**
   * Aggiorna titolo pagina con count
   */
  private updatePageTitle(count: number): void {
    const baseTitle = 'Lucine Dashboard';
    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }

  /**
   * Resetta tutti i badge
   */
  resetBadge(): void {
    this.updateBadgeCount(0);
  }

  /**
   * P2.8: Ricarica preferenze operatore (chiamare dopo salvataggio)
   */
  async reloadPreferences(): Promise<void> {
    await this.loadPreferences();
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
