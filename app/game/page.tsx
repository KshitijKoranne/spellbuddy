"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { loadProgress, recordWordAttempt } from "@/lib/progress";
import { getRandomWord, getAgeGroup, Word } from "@/lib/words";

type GameState = "loading" | "idle" | "listening" | "correct";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResult; length: number; }
interface SpeechRecognitionResult { [index: number]: SpeechRecognitionAlternative; isFinal: boolean; }
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
const CACHE_PREFIX  = "spellbuddy_img_";
const PREWARM_KEY   = "spellbuddy_prewarmed_";
const getCached     = (w: string) => { try { return localStorage.getItem(CACHE_PREFIX + w); } catch { return null; } };
const setCached     = (w: string, d: string) => { try { localStorage.setItem(CACHE_PREFIX + w, d); } catch { /**/ } };
const isPrewarmed   = (g: string) => { try { return localStorage.getItem(PREWARM_KEY + g) === "1"; } catch { return false; } };
const markPrewarmed = (g: string) => { try { localStorage.setItem(PREWARM_KEY + g, "1"); } catch { /**/ } };

// ── Parse a speech transcript into a single letter ───────────────────────────
// Handles: "b", "bee", "the letter b", "capital b", "B"
function parseToLetter(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";

  // Single letter spoken directly
  if (t.length === 1 && /[a-z]/.test(t)) return t;

  // "the letter X" / "letter X"
  const letterPhraseMatch = t.match(/\b(?:the\s+)?letter\s+([a-z])\b/);
  if (letterPhraseMatch) return letterPhraseMatch[1];

  // NATO / common letter names
  const NATO: Record<string, string> = {
    alpha: "a", bravo: "b", charlie: "c", delta: "d", echo: "e",
    foxtrot: "f", golf: "g", hotel: "h", india: "i", juliet: "j",
    kilo: "k", lima: "l", mike: "m", november: "n", oscar: "o",
    papa: "p", quebec: "q", romeo: "r", sierra: "s", tango: "t",
    uniform: "u", victor: "v", whiskey: "w", "x-ray": "x", xray: "x",
    yankee: "y", zulu: "z",
  };
  if (NATO[t]) return NATO[t];

  // Common phonetic letter sounds that browsers return
  // e.g. "ay"→a, "bee"→b, "see/sea"→c, "dee"→d, "ee"→e, "ef"→f ...
  const PHONETIC: Record<string, string> = {
    ay: "a", "a": "a",
    bee: "b", be: "b", bi: "b",
    see: "c", sea: "c", cee: "c",
    dee: "d",
    ee: "e",
    ef: "f", eff: "f",
    gee: "g", ji: "g",
    aitch: "h", haitch: "h", hey: "h",
    eye: "i", aye: "i",
    jay: "j",
    kay: "k",
    el: "l", ell: "l",
    em: "m",
    en: "n",
    oh: "o", owe: "o",
    pee: "p", pe: "p",
    queue: "q", cue: "q",
    are: "r", ar: "r",
    ess: "s", es: "s",
    tee: "t", tea: "t",
    you: "u", yew: "u",
    vee: "v", ve: "v",
    "double you": "w", "double-you": "w",
    ex: "x", eks: "x",
    why: "y", wye: "y",
    zed: "z", zee: "z",
  };
  if (PHONETIC[t]) return PHONETIC[t];

  // Last resort: first character of transcript
  const first = t[0];
  if (/[a-z]/.test(first)) return first;

  return "";
}

export default function GamePage() {
  const router = useRouter();

  const [age, setAge]                     = useState(0);
  const [childName, setChildName]         = useState("Friend");
  const [currentWord, setCurrentWord]     = useState<Word | null>(null);
  const [imageUrl, setImageUrl]           = useState<string | null>(null);
  const [gameState, setGameState]         = useState<GameState>("loading");
  const [spokenLetters, setSpokenLetters] = useState<string[]>([]);
  const [wrongFlash, setWrongFlash]       = useState<number | null>(null); // slot index
  const [seenWords, setSeenWords]         = useState<string[]>([]);
  const [score, setScore]                 = useState(0);
  const [hint, setHint]                   = useState(false);

  // Prewarm state
  const [prewarming, setPrewarming]   = useState(false);
  const [pwTotal, setPWTotal]         = useState(0);
  const [pwDone, setPWDone]           = useState(0);
  const [showBanner, setShowBanner]   = useState(false);

  const [speechSupported, setSpeechSupported] = useState(true);

  // Refs — stable across renders
  const recRef            = useRef<SpeechRecognition | null>(null);
  const expectedIdxRef    = useRef(0);
  const spokenRef         = useRef<string[]>([]);
  const currentWordRef    = useRef<Word | null>(null);
  const gameStateRef      = useRef<GameState>("loading");
  const autoRestartRef    = useRef(false);  // whether we should restart mic on end

  // Keep refs in sync
  useEffect(() => { spokenRef.current = spokenLetters; }, [spokenLetters]);
  useEffect(() => { currentWordRef.current = currentWord; }, [currentWord]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const progress = loadProgress();
    if (!progress) { router.push("/"); return; }
    setAge(progress.profile.age);
    setChildName(progress.profile.name);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSpeechSupported(false);
  }, [router]);

  useEffect(() => {
    if (!age) return;
    loadNewWord(age, []);
    maybePrewarm(age);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age]);

  // ── Prewarm ───────────────────────────────────────────────────────────────
  const maybePrewarm = useCallback(async (a: number) => {
    const group   = getAgeGroup(a);
    const groupId = group.label.replace(/\s/g, "_");
    if (isPrewarmed(groupId)) return;
    const missing = group.words.filter(w => !getCached(w.word));
    if (!missing.length) { markPrewarmed(groupId); return; }
    setPrewarming(true);
    setPWTotal(group.words.length);
    setPWDone(group.words.length - missing.length);
    setShowBanner(true);
    for (const w of missing) {
      try {
        const res  = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: w.word, hint: w.hint }) });
        const data = await res.json();
        if (data.dataUrl) setCached(w.word, data.dataUrl);
      } catch { /**/ }
      setPWDone(d => d + 1);
    }
    markPrewarmed(groupId);
    setPrewarming(false);
    setTimeout(() => setShowBanner(false), 2500);
  }, []);

  // ── Load word ─────────────────────────────────────────────────────────────
  const loadNewWord = useCallback(async (a: number, seen: string[]) => {
    stopListening();
    setGameState("loading");
    gameStateRef.current = "loading";
    setSpokenLetters([]);
    spokenRef.current = [];
    expectedIdxRef.current = 0;
    setHint(false);
    setImageUrl(null);

    const word = getRandomWord(a, seen);
    setCurrentWord(word);
    currentWordRef.current = word;
    setSeenWords(prev => [...prev, word.word]);

    const cached = getCached(word.word);
    if (cached) { setImageUrl(cached); }
    else {
      try {
        const res  = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: word.word, hint: word.hint }) });
        const data = await res.json();
        if (data.dataUrl) { setCached(word.word, data.dataUrl); setImageUrl(data.dataUrl); }
      } catch { /**/ }
    }

    setGameState("idle");
    gameStateRef.current = "idle";

    // Auto-start listening after a short delay so child is ready
    setTimeout(() => {
      if (gameStateRef.current === "idle") startListeningFn();
    }, 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Speech — CONTINUOUS mode ──────────────────────────────────────────────
  const startListeningFn = useCallback(() => {
    if (gameStateRef.current === "correct" || gameStateRef.current === "loading") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Clean up any existing instance
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /**/ }
      recRef.current = null;
    }

    const rec = new SR();
    rec.continuous     = true;   // keep listening across pauses
    rec.interimResults = true;   // fire as speech comes in
    rec.lang           = "en-US";
    recRef.current     = rec;
    autoRestartRef.current = true;

    let lastProcessed = "";      // debounce: don't process same transcript twice

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      // Walk through all new results since resultIndex
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result     = ev.results[i];
        const transcript = result[0].transcript.trim().toLowerCase();

        // Skip empty or already processed
        if (!transcript || transcript === lastProcessed) continue;

        if (result.isFinal) {
          lastProcessed = transcript;
          processTranscript(transcript);
        } else {
          // Interim: try to detect a confident single letter immediately
          const letter = parseToLetter(transcript);
          if (letter && letter !== lastProcessed) {
            lastProcessed = letter;
            processTranscript(letter);
          }
        }
      }
    };

    rec.onerror = () => {
      // On error, try restarting silently
      if (autoRestartRef.current && gameStateRef.current === "listening") {
        setTimeout(startListeningFn, 500);
      }
    };

    rec.onend = () => {
      // Auto-restart if word not yet complete
      if (autoRestartRef.current && gameStateRef.current === "listening") {
        setTimeout(startListeningFn, 300);
      } else {
        setGameState("idle");
        gameStateRef.current = "idle";
      }
    };

    rec.start();
    setGameState("listening");
    gameStateRef.current = "listening";
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    autoRestartRef.current = false;
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /**/ }
      recRef.current = null;
    }
    setGameState("idle");
    gameStateRef.current = "idle";
  }, []);

  const toggleListening = useCallback(() => {
    if (gameStateRef.current === "listening") stopListening();
    else startListeningFn();
  }, [startListeningFn, stopListening]);

  // ── Process what was heard ────────────────────────────────────────────────
  const processTranscript = useCallback((transcript: string) => {
    const word = currentWordRef.current;
    if (!word) return;

    // Try to extract letters from the transcript
    // Child might say "B E E" → ["b","e","e"]  or just "B" → ["b"]
    const letters = extractLetters(transcript, word.word, expectedIdxRef.current);

    for (const letter of letters) {
      const idx            = expectedIdxRef.current;
      const expectedLetter = word.word[idx];
      if (idx >= word.word.length) break;

      if (letter === expectedLetter) {
        const next = [...spokenRef.current, letter];
        spokenRef.current        = next;
        expectedIdxRef.current   = idx + 1;
        setSpokenLetters([...next]);

        if (next.length === word.word.length) {
          // Word complete!
          autoRestartRef.current = false;
          try { recRef.current?.abort(); recRef.current = null; } catch { /**/ }
          triggerSuccess(word);
          return;
        }
      } else {
        // Wrong letter — flash the current slot red briefly
        setWrongFlash(idx);
        setTimeout(() => setWrongFlash(null), 600);
        // Don't advance
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract sequence of letters from a transcript segment
  // e.g. "b e e" → ["b","e","e"], "bee" → ["b"], "b" → ["b"]
  function extractLetters(transcript: string, targetWord: string, fromIdx: number): string[] {
    const t       = transcript.trim().toLowerCase();
    const results: string[] = [];

    // Case 1: multiple space-separated tokens → treat each as a letter attempt
    const tokens = t.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      for (const tok of tokens) {
        const l = parseToLetter(tok);
        if (l) results.push(l);
      }
      if (results.length > 0) return results;
    }

    // Case 2: single token
    const single = parseToLetter(t);
    if (single) return [single];

    // Case 3: transcript exactly matches remaining word or prefix
    const remaining = targetWord.slice(fromIdx);
    if (remaining.startsWith(t)) {
      return t.split("").filter(c => /[a-z]/.test(c));
    }

    // Case 4: transcript IS the full word → give first unspoken letter only
    if (t === targetWord) {
      return [targetWord[fromIdx]];
    }

    return [];
  }

  const triggerSuccess = useCallback((word: Word) => {
    setGameState("correct");
    gameStateRef.current = "correct";
    setScore(s => s + 1);
    recordWordAttempt(word.word, true);
    confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 }, colors: ["#ff6b6b","#4ecdc4","#ffe66d","#c77dff"] });
    setTimeout(() => {
      confetti({ particleCount: 80, angle: 60,  spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
  }, []);

  const nextWord = useCallback(() => loadNewWord(age, seenWords), [age, seenWords, loadNewWord]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentWord || age === 0) return (
    <div style={{ minHeight: "100vh", background: "#fef9f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "4rem", animation: "float 3s ease-in-out infinite" }}>🐝</div>
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#636e72", marginTop: "12px" }}>Getting ready…</p>
      </div>
    </div>
  );

  const word = currentWord.word;
  const isListening = gameState === "listening";

  return (
    <div style={{ minHeight: "100vh", background: "#fef9f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 16px 32px" }}>

      {/* Prewarm banner */}
      {showBanner && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 50, borderRadius: 16, padding: "12px 20px", background: prewarming ? "#ffe66d" : "#4ecdc4", color: "#2d3436", fontWeight: 700, fontSize: "0.9rem", minWidth: 260, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", transition: "background 0.4s" }}>
          {prewarming ? (
            <>🎨 Preparing pictures… {pwDone}/{pwTotal}
              <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: "rgba(0,0,0,0.15)" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "#ff6b6b", width: `${pwTotal > 0 ? Math.round((pwDone/pwTotal)*100) : 0}%`, transition: "width 0.4s" }} />
              </div>
            </>
          ) : "✅ All pictures ready!"}
        </div>
      )}

      {/* Top bar */}
      <div style={{ width: "100%", maxWidth: 480, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => { stopListening(); router.push("/"); }}
          style={{ padding: "8px 14px", borderRadius: 14, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", background: "white", border: "2px solid #f0e6d3", color: "#636e72", fontFamily: "inherit" }}>
          ← Home
        </button>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ padding: "8px 16px", borderRadius: 14, fontWeight: 900, fontSize: "0.9rem", background: "#ffe66d", color: "#2d3436" }}>⭐ {score} stars</div>
          <button onClick={() => { stopListening(); router.push("/progress"); }}
            style={{ padding: "8px 12px", borderRadius: 14, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", background: "white", border: "2px solid #f0e6d3", color: "#636e72", fontFamily: "inherit" }}>
            📊
          </button>
        </div>
      </div>

      {/* Main card */}
      <div style={{ background: "#ffffff", borderRadius: 28, padding: 24, width: "100%", maxWidth: 480, border: "3px solid #f0e6d3", boxShadow: "0 8px 40px rgba(255,107,107,0.12)" }}>

        {gameState === "correct" ? (
          /* ── SUCCESS ── */
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "5rem" }}>🎉</div>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 900, color: "#ff6b6b", margin: "8px 0" }}>Amazing!</h2>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#4ecdc4", margin: "4px 0" }}>
              You spelled <span style={{ color: "#ff6b6b", fontWeight: 900, textTransform: "uppercase" }}>{word}</span>!
            </p>
            <div style={{ fontSize: "3.5rem", margin: "16px 0" }}>{currentWord.emoji}</div>
            <button onClick={nextWord}
              style={{ padding: "14px 32px", background: "linear-gradient(135deg,#ff6b6b,#ff9f9f)", color: "white", border: "none", borderRadius: 16, fontSize: "1.2rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 15px rgba(255,107,107,0.4)" }}>
              Next Word! 🚀
            </button>
          </div>
        ) : (
          /* ── GAME ── */
          <>
            {/* Image */}
            <div style={{ height: 200, borderRadius: 18, marginBottom: 20, background: "#fef9f0", border: "2px solid #f0e6d3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {!imageUrl ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "5rem", animation: "float 3s ease-in-out infinite" }}>{currentWord.emoji}</div>
                  {gameState === "loading" && <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#b2bec3", marginTop: 8 }}>Drawing picture…</p>}
                </div>
              ) : (
                <img src={imageUrl} alt="Guess this!" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
              )}
            </div>

            {/* Listening status line */}
            <div style={{ textAlign: "center", marginBottom: 16, height: 28 }}>
              {isListening ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff0f0", borderRadius: 99, padding: "5px 16px", border: "2px solid #ffcdd2" }}>
                  {/* animated dots */}
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: "50%", background: "#ff6b6b",
                        animation: "bounce-in 0.6s ease-in-out infinite",
                        animationDelay: `${i * 0.15}s`,
                        display: "inline-block",
                      }} />
                    ))}
                  </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ff6b6b" }}>
                    Listening… say each letter!
                  </span>
                </div>
              ) : gameState !== "loading" ? (
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#b2bec3" }}>Tap the mic to start 🎤</span>
              ) : null}
            </div>

            {/* Letter slots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {word.split("").map((letter, i) => {
                const filled    = i < spokenLetters.length;
                const isNext    = i === spokenLetters.length;
                const isWrong   = wrongFlash === i;
                return (
                  <div key={i} style={{
                    width: 52, height: 64,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 14, fontSize: "1.6rem", fontWeight: 900,
                    transition: "all 0.2s",
                    animation: isWrong ? "shake 0.4s ease-in-out" : "none",
                    background: isWrong ? "#fff0f0" : filled ? "#ff6b6b" : isNext && isListening ? "#fff0f5" : "#fef9f0",
                    border: `3px solid ${isWrong ? "#ff6b6b" : filled ? "#ff6b6b" : isNext && isListening ? "#ffb3c6" : "#f0e6d3"}`,
                    color: filled ? "white" : "#2d3436",
                    transform: filled ? "scale(1.05)" : "scale(1)",
                    boxShadow: isNext && isListening ? "0 0 0 4px rgba(255,107,107,0.15)" : "none",
                  }}>
                    {filled
                      ? spokenLetters[i].toUpperCase()
                      : (hint && isNext ? letter.toUpperCase() : "")}
                  </div>
                );
              })}
            </div>

            {/* Expected letter hint */}
            {isListening && spokenLetters.length < word.length && (
              <p style={{ textAlign: "center", fontSize: "1rem", fontWeight: 700, color: "#636e72", margin: "0 0 16px" }}>
                Say the letter <strong style={{ color: "#ff6b6b", fontSize: "1.4rem" }}>&quot;{word[spokenLetters.length].toUpperCase()}&quot;</strong>
              </p>
            )}

            {/* Big mic button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {speechSupported && (
                <div style={{ position: "relative" }}>
                  {isListening && <div className="mic-pulse" style={{ position: "absolute", inset: 0, borderRadius: "50%" }} />}
                  <button
                    onClick={toggleListening}
                    style={{
                      position: "relative",
                      width: 88, height: 88, borderRadius: "50%",
                      fontSize: "2rem", border: "none", cursor: "pointer",
                      background: isListening
                        ? "linear-gradient(135deg,#ff6b6b,#ff4040)"
                        : "linear-gradient(135deg,#ff6b6b,#ff9f9f)",
                      boxShadow: isListening
                        ? "0 0 0 6px rgba(255,107,107,0.25), 0 0 30px rgba(255,107,107,0.5)"
                        : "0 4px 20px rgba(255,107,107,0.4)",
                      transform: isListening ? "scale(1.08)" : "scale(1)",
                      transition: "all 0.2s",
                    }}
                  >
                    {isListening ? "⏸️" : "🎤"}
                  </button>
                </div>
              )}

              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#b2bec3", margin: 0, textAlign: "center" }}>
                {isListening ? "Tap to pause" : "Tap to start listening"}
              </p>

              {/* Hint */}
              {!hint && spokenLetters.length < word.length && (
                <button onClick={() => setHint(true)}
                  style={{ padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", background: "#f0e6d3", color: "#636e72", border: "none", fontFamily: "inherit" }}>
                  Need a hint? 💡
                </button>
              )}

              <button onClick={nextWord}
                style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b2bec3", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Skip this word →
              </button>
            </div>
          </>
        )}
      </div>

      <p style={{ marginTop: 16, fontSize: "0.85rem", fontWeight: 700, color: "#b2bec3" }}>
        Playing as <span style={{ color: "#ff6b6b" }}>{childName}</span> 👶 Age {age}
      </p>
    </div>
  );
}
