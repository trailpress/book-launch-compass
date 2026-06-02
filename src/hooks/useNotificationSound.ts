import { useCallback, useRef } from 'react';

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
      } catch (e) {
        console.warn('Browser notification failed:', e);
      }
    }
  }, []);

  const playNotification = useCallback((niche?: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      
      // Three-tone charm chime
      const notes = [
        { freq: 783.99, start: 0, end: 0.25, vol: 0.3 },      // G5
        { freq: 1046.50, start: 0.12, end: 0.35, vol: 0.25 },  // C6
        { freq: 1318.51, start: 0.24, end: 0.55, vol: 0.2 },   // E6
      ];

      notes.forEach(({ freq, start, end, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + end);
        osc.start(now + start);
        osc.stop(now + end);
      });
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }

    // Browser notification
    showBrowserNotification(
      '✅ Analisi Completata',
      niche ? `L'analisi per "${niche}" è pronta!` : 'La tua analisi di mercato è pronta!'
    );
  }, [showBrowserNotification]);

  return { playNotification, requestNotificationPermission };
}
