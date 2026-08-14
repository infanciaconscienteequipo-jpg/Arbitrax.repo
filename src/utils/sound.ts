/**
 * ArbitraX Pro - Notification Sound Utility
 * 
 * Generates a pleasant, subtle, professional chime (0.25 - 0.35 seconds)
 * using Web Audio API synthesized audio.
 * Fully self-contained, offline-first, zero external URL dependencies.
 * Safely catches any browser autoplay restrictions without throwing or logging errors.
 */

export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic dual-frequency chime (A5 ~880Hz gently ascending to E6 ~1318Hz with warm overtone)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now);
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12);

    // Smooth envelope: gentle attack (0.02s), peak volume 0.30, exponential decay to 0.32s
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.30, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.33);
    osc2.stop(now + 0.33);

    // Automatically close AudioContext after playback completes
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Silently ignore if autoplay is restricted by the browser
  }
}
