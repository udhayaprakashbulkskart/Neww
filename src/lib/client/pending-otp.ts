/**
 * Carries the mobile number and purpose from the entry screen to the OTP screen. Stored in sessionStorage
 * (cleared when the tab closes) rather than the URL, so the number does not appear in history or logs.
 */
export type PendingOtp = {
  mobile: string;
  purpose: 'LOGIN' | 'REGISTER';
  fullName?: string;
  consent?: boolean;
  next?: string;
};

const KEY = 'ht.pendingOtp';

export function setPendingOtp(value: PendingOtp) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode). The OTP page will ask the user to start again.
  }
}

export function getPendingOtp(): PendingOtp | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingOtp) : null;
  } catch {
    return null;
  }
}

export function clearPendingOtp() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
