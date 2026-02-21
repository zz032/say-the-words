/**
 * Get or create a persistent unique userId (stored in localStorage).
 * Used to identify users across page refreshes and browser reopens.
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  let id = storage ? storage.getItem("say-the-words-user-id") : null;
  if (!id) {
    let newId: string;
    try {
      if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
        newId = (crypto as any).randomUUID();
      } else {
        const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        newId = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
      }
    } catch {
      const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      newId = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    }
    id = newId;
    try {
      if (storage) storage.setItem("say-the-words-user-id", id);
    } catch {}
  }
  return id as string;
}

/**
 * Check if we've passed today's 6:00 AM Beijing Time (UTC+8).
 * Used for Speaker daily message reset.
 */
export function getBeijingTimeNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 60 * 60 * 1000);
}

/**
 * Get the start of the current "day" for message counting.
 * Day starts at 6:00 AM Beijing Time (UTC+8).
 * Returns the UTC timestamp of that moment for comparison with DB.
 */
export function getCurrentPeriodStart(): Date {
  const beijing = getBeijingTimeNow();
  const year = beijing.getFullYear();
  const month = beijing.getMonth();
  const date = beijing.getDate();
  const hour = beijing.getHours();

  // If before 6 AM Beijing, the period started yesterday at 6 AM Beijing
  let periodDate = date;
  if (hour < 6) {
    periodDate = date - 1;
  }

  // 6:00 AM Beijing = 22:00 UTC previous day (Beijing is UTC+8)
  const utcMs =
    Date.UTC(year, month, periodDate, 6, 0, 0, 0) - 8 * 60 * 60 * 1000;
  return new Date(utcMs);
}

export function getSpeakerName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("say-the-words-speaker-name");
  } catch {
    return null;
  }
}

export function setSpeakerName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("say-the-words-speaker-name", name);
  } catch {}
}
