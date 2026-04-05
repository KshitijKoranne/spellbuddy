export interface ChildProfile {
  name: string;
  age: number;
}

export interface WordProgress {
  word: string;
  attempts: number;
  mastered: boolean;
  lastSeen: number;
}

export interface GameProgress {
  profile: ChildProfile;
  words: Record<string, WordProgress>;
  streak: number;
  lastPlayedDate: string;
  totalMastered: number;
}

const STORAGE_KEY = "spellbuddy_progress";

export function loadProgress(): GameProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: ChildProfile): GameProgress {
  const existing = loadProgress();
  const today = new Date().toDateString();

  if (existing && existing.profile.name === profile.name) {
    const updated = { ...existing, profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }

  const fresh: GameProgress = {
    profile,
    words: {},
    streak: 0,
    lastPlayedDate: today,
    totalMastered: 0,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function recordWordAttempt(
  word: string,
  correct: boolean
): GameProgress | null {
  const progress = loadProgress();
  if (!progress) return null;

  const today = new Date().toDateString();
  const existing = progress.words[word] || {
    word,
    attempts: 0,
    mastered: false,
    lastSeen: Date.now(),
  };

  const updated: WordProgress = {
    ...existing,
    attempts: existing.attempts + 1,
    mastered: correct ? true : existing.mastered,
    lastSeen: Date.now(),
  };

  progress.words[word] = updated;

  // Update streak
  if (correct) {
    if (progress.lastPlayedDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (progress.lastPlayedDate === yesterday.toDateString()) {
        progress.streak += 1;
      } else {
        progress.streak = 1;
      }
    }
    progress.lastPlayedDate = today;
    progress.totalMastered = Object.values(progress.words).filter(
      (w) => w.mastered
    ).length;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export function clearProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}
