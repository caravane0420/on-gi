/* ================================================================
 * Personal volume preference (per-browser, NOT synced to others)
 *
 * Each viewer controls their own volume because everyone's hardware
 * / headset loudness differs. Persisted so it's remembered next time.
 * ================================================================ */

const K_VOL = 'ongi:volume';
const K_MUTED = 'ongi:muted';

export function getSavedVolume(): number {
  try {
    const raw = Number(localStorage.getItem(K_VOL));
    if (Number.isFinite(raw) && raw >= 0 && raw <= 100) return raw;
  } catch {
    /* ignore */
  }
  return 100;
}

export function setSavedVolume(v: number): void {
  try {
    localStorage.setItem(K_VOL, String(Math.round(v)));
  } catch {
    /* ignore */
  }
}

export function getSavedMuted(): boolean {
  try {
    return localStorage.getItem(K_MUTED) === '1';
  } catch {
    return false;
  }
}

export function setSavedMuted(m: boolean): void {
  try {
    localStorage.setItem(K_MUTED, m ? '1' : '0');
  } catch {
    /* ignore */
  }
}
