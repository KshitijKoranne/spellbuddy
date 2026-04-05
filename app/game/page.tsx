"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { loadProgress, recordWordAttempt } from "@/lib/progress";
import { getRandomWord, getAgeGroup, Word } from "@/lib/words";

type GameState = "loading" | "idle" | "listening" | "correct";

// ── Web Speech API types ──────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
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

// ── Image cache helpers ───────────────────────────────────────────────────────
const CACHE_PREFIX = "spellbuddy_img_";
const PREWARM_KEY  = "spellbuddy_prewarmed_";

function getCachedImage(word: string): string | null {
  try { return localStorage.getItem(CACHE_PREFIX + word); } catch { return null; }
}
function setCachedImage(word: string, dataUrl: string) {
  try { localStorage.setItem(CACHE_PREFIX + word, dataUrl); } catch { /* quota */ }
}
function isPrewarmed(ageGroup: string): boolean {
  try { return localStorage.getItem(PREWARM_KEY + ageGroup) === "1"; } catch { return false; }
}
function markPrewarmed(ageGroup: string) {
  try { localStorage.setItem(PREWARM_KEY + ageGroup, "1"); } catch { /* ok */ }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GamePage() {
  const router = useRouter();

  // profile
  const [age, setAge]             = useState(0);
  const [childName, setChildName] = useState("Friend");

  // game
  const [currentWord, setCurrentWord]   = useState<Word | null>(null);
  const [imageUrl, setImageUrl]         = useState<string | null>(null);
  const [gameState, setGameState]       = useState<GameState>("loading");
  const [spokenLetters, setSpokenLetters] = useState<string[]>([]);
  const [shakeSlot, setShakeSlot]       = useState<number | null>(null);
  const [seenWords, setSeenWords]       = useState<string[]>([]);
  const [score, setScore]               = useState(0);
  const [hint, setHint]                 = useState(false);

  // prewarm
  const [prewarming, setPrewarming]     = useState(false);
  const [prewarmTotal, setPrewarmTotal] = useState(0);
  const [prewarmDone, setPrewarmDone]   = useState(0);
  const [showPrewarmBanner, setShowPrewarmBanner] = useState(false);

  // speech
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef       = useRef<SpeechRecognition | null>(null);
  const expectedIndexRef     = useRef(0);
  const spokenLettersRef     = useRef<string[]>([]);

  // keep ref in sync with state
  useEffect(() => { spokenLettersRef.current = spokenLetters; }, [spokenLetters]);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const progress = loadProgress();
    if (!progress) { router.push("/"); return; }
    setAge(progress.profile.age);
    setChildName(progress.profile.name);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSpeechSupported(false);
  }, [router]);

  // once age is set, load first word + maybe prewarm
  useEffect(() => {
    if (!age) return;
    loadNewWord(age, []);
    maybePrewarm(age);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age]);

  // ── Pre-warm: silently generate all images for this age group ────────────
  const maybePrewarm = useCallback(async (currentAge: number) => {
    const group   = getAgeGroup(currentAge);
    const groupId = group.label.replace(/\s/g, "_");

    if (isPrewarmed(groupId)) return;           // already done

    const words       = group.words;
    const alreadyCached = words.filter(w => getCachedImage(w.word)).map(w => w.word);
    const missing       = words.filter(w => !getCachedImage(w.word));

    if (missing.length === 0) { markPrewarmed(groupId); return; }

    setPrewarming(true);
    setPrewarmTotal(words.length);
    setPrewarmDone(alreadyCached.length);
    setShowPrewarmBanner(true);

    // Generate one at a time so we don't hammer the API
    for (const w of missing) {
      try {
        const res  = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: w.word, hint: w.hint }),
        });
        const data = await res.json();
        if (data.dataUrl) setCachedImage(w.word, data.dataUrl);
      } catch { /* best-effort */ }

      setPrewarmDone(d => d + 1);
    }

    markPrewarmed(groupId);
    setPrewarming(false);
    // hide banner after short delay
    setTimeout(() => setShowPrewarmBanner(false), 2000);
  }, []);

  // ── Load a word ───────────────────────────────────────────────────────────
  const loadNewWord = useCallback(async (currentAge: number, seen: string[]) => {
    setGameState("loading");
    setSpokenLetters([]);
    spokenLettersRef.current = [];
    expectedIndexRef.current = 0;
    setHint(false);
    setImageUrl(null);

    const word = getRandomWord(currentAge, seen);
    setCurrentWord(word);
    setSeenWords(prev => [...prev, word.word]);

    // Check cache first
    const cached = getCachedImage(word.word);
    if (cached) {
      setImageUrl(cached);
      setGameState("idle");
      return;
    }

    // Not cached — generate on demand
    try {
      const res  = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.word, hint: word.hint }),
      });
      const data = await res.json();
      if (data.dataUrl) {
        setCachedImage(word.word, data.dataUrl);
        setImageUrl(data.dataUrl);
      }
    } catch (e) {
      console.error("Image generation failed", e);
    }
    setGameState("idle");
  }, []);

  // ── Speech ────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!currentWord || gameState !== "idle") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    setGameState("listening");
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const transcript = ev.results[0][0].transcript.trim().toLowerCase();
      handleTranscript(transcript);
    };
    rec.onerror = () => setGameState("idle");
    rec.onend   = () => { setGameState("idle"); };
    rec.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord, gameState]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setGameState("idle");
  }, []);

  const handleTranscript = useCallback((transcript: string) => {
    if (!currentWord) return;

    const word          = currentWord.word;
    const expectedIdx   = expectedIndexRef.current;
    const expectedLetter = word[expectedIdx];

    // Parse what was said — "b", "the letter b", "bee" all map to first char
    let spoken = "";
    if (transcript.length === 1 && /[a-z]/.test(transcript)) {
      spoken = transcript;
    } else if (transcript.startsWith("the letter ")) {
      spoken = transcript.replace("the letter ", "").trim()[0] || "";
    } else {
      spoken = transcript[0] || "";
    }

    setGameState("idle");

    if (spoken === expectedLetter) {
      const next = [...spokenLettersRef.current, spoken];
      setSpokenLetters(next);
      spokenLettersRef.current = next;
      expectedIndexRef.current = expectedIdx + 1;
      if (next.length === word.length) triggerSuccess();
    } else {
      setShakeSlot(expectedIdx);
      setTimeout(() => setShakeSlot(null), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord]);

  const triggerSuccess = useCallback(() => {
    setGameState("correct");
    setScore(s => s + 1);
    if (currentWord) recordWordAttempt(currentWord.word, true);

    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 },
      colors: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#c77dff", "#ff9f9f"] });
    setTimeout(() => {
      confetti({ particleCount: 80, angle: 60,  spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
  }, [currentWord]);

  const nextWord = useCallback(() => {
    loadNewWord(age, seenWords);
  }, [age, seenWords, loadNewWord]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentWord || age === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-float">🐝</div>
        <p className="text-xl font-bold" style={{ color: "#636e72" }}>Getting ready...</p>
      </div>
    </div>
  );

  const word = currentWord.word;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 pb-8">

      {/* ── Pre-warm banner ── */}
      {showPrewarmBanner && (
        <div
          className="fixed top-4 left-1/2 z-50 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg"
          style={{
            transform: "translateX(-50%)",
            background: prewarming ? "#ffe66d" : "#4ecdc4",
            color: "#2d3436",
            transition: "background 0.4s",
            minWidth: "260px",
            textAlign: "center",
          }}
        >
          {prewarming ? (
            <>
              🎨 Preparing pictures… {prewarmDone}/{prewarmTotal}
              <div className="mt-2 rounded-full overflow-hidden" style={{ height: "6px", background: "rgba(0,0,0,0.15)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${prewarmTotal > 0 ? Math.round((prewarmDone / prewarmTotal) * 100) : 0}%`,
                    background: "#ff6b6b",
                  }}
                />
              </div>
            </>
          ) : (
            <>✅ All pictures ready!</>
          )}
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="w-full max-w-lg flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 font-bold text-sm px-3 py-2 rounded-2xl transition-all"
          style={{ color: "#636e72", background: "white", border: "2px solid #f0e6d3" }}
        >
          ← Home
        </button>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl font-black text-sm" style={{ background: "#ffe66d", color: "#2d3436" }}>
            ⭐ {score} stars
          </div>
          <button
            onClick={() => router.push("/progress")}
            className="px-3 py-2 rounded-2xl font-bold text-sm"
            style={{ background: "white", border: "2px solid #f0e6d3", color: "#636e72" }}
          >
            📊
          </button>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg card-shadow" style={{ border: "3px solid #f0e6d3" }}>

        {gameState === "correct" ? (
          /* SUCCESS */
          <div className="text-center py-8 animate-bounce-in">
            <div className="text-8xl mb-4">🎉</div>
            <h2 className="text-4xl font-black mb-2" style={{ color: "#ff6b6b" }}>Amazing!</h2>
            <p className="text-xl font-bold mb-2" style={{ color: "#4ecdc4" }}>
              You spelled{" "}
              <span className="uppercase font-black" style={{ color: "#ff6b6b" }}>{word}</span>!
            </p>
            <p className="text-5xl my-4">{currentWord.emoji}</p>
            <button onClick={nextWord} className="btn-primary px-8 py-4 text-xl mt-4">
              Next Word! 🚀
            </button>
          </div>
        ) : (
          /* GAME */
          <>
            {/* Image */}
            <div
              className="rounded-2xl mb-5 flex items-center justify-center overflow-hidden"
              style={{ height: "220px", background: "#fef9f0", border: "2px solid #f0e6d3" }}
            >
              {gameState === "loading" || (!imageUrl && gameState !== "idle") ? (
                <div className="text-center">
                  <div className="text-6xl animate-float">{currentWord.emoji}</div>
                  <p className="text-sm font-semibold mt-2" style={{ color: "#b2bec3" }}>
                    Drawing picture…
                  </p>
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt="What is this?" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                /* no image yet — show large emoji fallback */
                <div className="text-center">
                  <div className="text-9xl">{currentWord.emoji}</div>
                </div>
              )}
            </div>

            {/* Prompt */}
            <p className="text-center text-lg font-bold mb-4" style={{ color: "#636e72" }}>
              What is this? Spell it out! 🎤
            </p>

            {/* Letter slots */}
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
              {word.split("").map((letter, i) => {
                const filled   = i < spokenLetters.length;
                const isNext   = i === spokenLetters.length;
                const shaking  = shakeSlot === i;
                return (
                  <div
                    key={i}
                    className={`letter-slot flex items-center justify-center rounded-2xl font-black text-2xl transition-all ${shaking ? "animate-shake" : ""}`}
                    style={{
                      width: "52px", height: "64px",
                      background: filled ? "#ff6b6b" : isNext ? "#fff8f0" : "#fef9f0",
                      border: `3px solid ${filled ? "#ff6b6b" : isNext ? "#ff6b6b" : "#f0e6d3"}`,
                      color: filled ? "white" : "#2d3436",
                      transform: filled ? "scale(1.05)" : "scale(1)",
                      boxShadow: isNext ? "0 0 0 3px rgba(255,107,107,0.2)" : "none",
                    }}
                  >
                    {filled ? spokenLetters[i].toUpperCase() : (hint && isNext ? letter.toUpperCase() : "")}
                  </div>
                );
              })}
            </div>

            {/* Mic */}
            <div className="flex flex-col items-center gap-3">
              {speechSupported && (
                <div className="relative">
                  {gameState === "listening" && <div className="mic-pulse absolute inset-0 rounded-full" />}
                  <button
                    onClick={gameState === "listening" ? stopListening : startListening}
                    className="relative rounded-full flex items-center justify-center text-3xl transition-all"
                    style={{
                      width: "80px", height: "80px",
                      background: gameState === "listening"
                        ? "linear-gradient(135deg,#ff6b6b,#ff4040)"
                        : "linear-gradient(135deg,#ff6b6b,#ff9f9f)",
                      boxShadow: gameState === "listening"
                        ? "0 0 30px rgba(255,107,107,0.6)"
                        : "0 4px 20px rgba(255,107,107,0.4)",
                      transform: gameState === "listening" ? "scale(1.1)" : "scale(1)",
                    }}
                  >
                    {gameState === "listening" ? "⏹️" : "🎤"}
                  </button>
                </div>
              )}

              <p className="text-sm font-semibold text-center" style={{ color: "#b2bec3" }}>
                {gameState === "listening"
                  ? `Say the letter "${word[spokenLetters.length]?.toUpperCase()}"…`
                  : `Tap 🎤 and say letter ${spokenLetters.length + 1} of ${word.length}`}
              </p>

              {!hint && spokenLetters.length < word.length && (
                <button
                  onClick={() => setHint(true)}
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: "#f0e6d3", color: "#636e72" }}
                >
                  Need a hint? 💡
                </button>
              )}

              <button onClick={nextWord} className="text-xs font-bold" style={{ color: "#b2bec3" }}>
                Skip this word →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Name badge */}
      <p className="mt-4 text-sm font-bold" style={{ color: "#b2bec3" }}>
        Playing as <span style={{ color: "#ff6b6b" }}>{childName}</span> 👶 Age {age}
      </p>
    </main>
  );
}
