"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { loadProgress, recordWordAttempt } from "@/lib/progress";
import { getRandomWord, getAgeGroup, Word } from "@/lib/words";

type GameState = "loading" | "idle" | "listening" | "correct";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResult; length: number; }
interface SpeechRecognitionResult { [index: number]: SpeechRecognitionAlternative; isFinal: boolean; }
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
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

const CACHE_PREFIX  = "spellbuddy_img_";
const PREWARM_KEY   = "spellbuddy_prewarmed_";
const getCached     = (w: string) => { try { return localStorage.getItem(CACHE_PREFIX + w); } catch { return null; } };
const setCached     = (w: string, d: string) => { try { localStorage.setItem(CACHE_PREFIX + w, d); } catch { /**/ } };
const isPrewarmed   = (g: string) => { try { return localStorage.getItem(PREWARM_KEY + g) === "1"; } catch { return false; } };
const markPrewarmed = (g: string) => { try { localStorage.setItem(PREWARM_KEY + g, "1"); } catch { /**/ } };

export default function GamePage() {
  const router = useRouter();
  const [age, setAge]                     = useState(0);
  const [childName, setChildName]         = useState("Friend");
  const [currentWord, setCurrentWord]     = useState<Word | null>(null);
  const [imageUrl, setImageUrl]           = useState<string | null>(null);
  const [gameState, setGameState]         = useState<GameState>("loading");
  const [spokenLetters, setSpokenLetters] = useState<string[]>([]);
  const [shakeSlot, setShakeSlot]         = useState<number | null>(null);
  const [seenWords, setSeenWords]         = useState<string[]>([]);
  const [score, setScore]                 = useState(0);
  const [hint, setHint]                   = useState(false);
  const [prewarming, setPrewarming]       = useState(false);
  const [prewarmTotal, setPWTotal]        = useState(0);
  const [prewarmDone, setPWDone]          = useState(0);
  const [showBanner, setShowBanner]       = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef    = useRef<SpeechRecognition | null>(null);
  const expectedIndexRef  = useRef(0);
  const spokenLettersRef  = useRef<string[]>([]);

  useEffect(() => { spokenLettersRef.current = spokenLetters; }, [spokenLetters]);

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

  const maybePrewarm = useCallback(async (a: number) => {
    const group   = getAgeGroup(a);
    const groupId = group.label.replace(/\s/g, "_");
    if (isPrewarmed(groupId)) return;
    const missing = group.words.filter(w => !getCached(w.word));
    if (missing.length === 0) { markPrewarmed(groupId); return; }
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

  const loadNewWord = useCallback(async (a: number, seen: string[]) => {
    setGameState("loading");
    setSpokenLetters([]);
    spokenLettersRef.current = [];
    expectedIndexRef.current = 0;
    setHint(false);
    setImageUrl(null);
    const word = getRandomWord(a, seen);
    setCurrentWord(word);
    setSeenWords(prev => [...prev, word.word]);
    const cached = getCached(word.word);
    if (cached) { setImageUrl(cached); setGameState("idle"); return; }
    try {
      const res  = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: word.word, hint: word.hint }) });
      const data = await res.json();
      if (data.dataUrl) { setCached(word.word, data.dataUrl); setImageUrl(data.dataUrl); }
    } catch { /**/ }
    setGameState("idle");
  }, []);

  const startListening = useCallback(() => {
    if (!currentWord || gameState !== "idle") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setGameState("listening");
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    recognitionRef.current = rec;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const t = ev.results[0][0].transcript.trim().toLowerCase();
      handleTranscript(t);
    };
    rec.onerror = () => setGameState("idle");
    rec.onend   = () => setGameState("idle");
    rec.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord, gameState]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setGameState("idle"); }, []);

  const handleTranscript = useCallback((t: string) => {
    if (!currentWord) return;
    const word = currentWord.word;
    const idx  = expectedIndexRef.current;
    let spoken = "";
    if (t.length === 1 && /[a-z]/.test(t))       spoken = t;
    else if (t.startsWith("the letter "))          spoken = t.replace("the letter ", "").trim()[0] || "";
    else                                            spoken = t[0] || "";
    setGameState("idle");
    if (spoken === word[idx]) {
      const next = [...spokenLettersRef.current, spoken];
      setSpokenLetters(next);
      spokenLettersRef.current = next;
      expectedIndexRef.current = idx + 1;
      if (next.length === word.length) triggerSuccess();
    } else {
      setShakeSlot(idx);
      setTimeout(() => setShakeSlot(null), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord]);

  const triggerSuccess = useCallback(() => {
    setGameState("correct");
    setScore(s => s + 1);
    if (currentWord) recordWordAttempt(currentWord.word, true);
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ["#ff6b6b","#4ecdc4","#ffe66d","#c77dff"] });
    setTimeout(() => {
      confetti({ particleCount: 80, angle: 60,  spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
  }, [currentWord]);

  const nextWord = useCallback(() => loadNewWord(age, seenWords), [age, seenWords, loadNewWord]);

  if (!currentWord || age === 0) return (
    <div style={{ minHeight: "100vh", background: "#fef9f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "4rem", animation: "float 3s ease-in-out infinite" }}>🐝</div>
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#636e72", marginTop: "12px" }}>Getting ready…</p>
      </div>
    </div>
  );

  const word = currentWord.word;

  return (
    <div style={{ minHeight: "100vh", background: "#fef9f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 16px 32px" }}>

      {/* Prewarm banner */}
      {showBanner && (
        <div style={{
          position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)",
          zIndex: 50, borderRadius: "16px", padding: "12px 20px",
          background: prewarming ? "#ffe66d" : "#4ecdc4",
          color: "#2d3436", fontWeight: 700, fontSize: "0.9rem",
          minWidth: "260px", textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          transition: "background 0.4s",
        }}>
          {prewarming ? (
            <>
              🎨 Preparing pictures… {prewarmDone}/{prewarmTotal}
              <div style={{ marginTop: "8px", height: "6px", borderRadius: "99px", background: "rgba(0,0,0,0.15)" }}>
                <div style={{ height: "100%", borderRadius: "99px", background: "#ff6b6b", width: `${prewarmTotal > 0 ? Math.round((prewarmDone/prewarmTotal)*100) : 0}%`, transition: "width 0.4s" }} />
              </div>
            </>
          ) : "✅ All pictures ready!"}
        </div>
      )}

      {/* Top bar */}
      <div style={{ width: "100%", maxWidth: "480px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => router.push("/")}
          style={{ padding: "8px 14px", borderRadius: "14px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", background: "white", border: "2px solid #f0e6d3", color: "#636e72", fontFamily: "inherit" }}>
          ← Home
        </button>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ padding: "8px 16px", borderRadius: "14px", fontWeight: 900, fontSize: "0.9rem", background: "#ffe66d", color: "#2d3436" }}>
            ⭐ {score} stars
          </div>
          <button onClick={() => router.push("/progress")}
            style={{ padding: "8px 12px", borderRadius: "14px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", background: "white", border: "2px solid #f0e6d3", color: "#636e72", fontFamily: "inherit" }}>
            📊
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: "#ffffff", borderRadius: "28px", padding: "24px", width: "100%", maxWidth: "480px", border: "3px solid #f0e6d3", boxShadow: "0 8px 40px rgba(255,107,107,0.12)" }}>

        {gameState === "correct" ? (
          <div style={{ textAlign: "center", padding: "32px 0", animation: "bounce-in 0.5s both" }}>
            <div style={{ fontSize: "5rem" }}>🎉</div>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 900, color: "#ff6b6b", margin: "8px 0" }}>Amazing!</h2>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#4ecdc4", margin: "4px 0" }}>
              You spelled <span style={{ color: "#ff6b6b", fontWeight: 900, textTransform: "uppercase" }}>{word}</span>!
            </p>
            <div style={{ fontSize: "3.5rem", margin: "16px 0" }}>{currentWord.emoji}</div>
            <button onClick={nextWord}
              style={{ padding: "14px 32px", background: "linear-gradient(135deg, #ff6b6b, #ff9f9f)", color: "white", border: "none", borderRadius: "16px", fontSize: "1.2rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 15px rgba(255,107,107,0.4)", marginTop: "8px" }}>
              Next Word! 🚀
            </button>
          </div>
        ) : (
          <>
            {/* Image */}
            <div style={{ height: "220px", borderRadius: "18px", marginBottom: "20px", background: "#fef9f0", border: "2px solid #f0e6d3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {gameState === "loading" || (!imageUrl) ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "5rem", animation: "float 3s ease-in-out infinite" }}>{currentWord.emoji}</div>
                  {gameState === "loading" && <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#b2bec3", marginTop: "8px" }}>Drawing picture…</p>}
                </div>
              ) : (
                <img src={imageUrl} alt="Guess this!" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "16px" }} />
              )}
            </div>

            {/* Prompt */}
            <p style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: 700, color: "#636e72", margin: "0 0 20px" }}>
              What is this? Spell it out! 🎤
            </p>

            {/* Letter slots */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
              {word.split("").map((letter, i) => {
                const filled  = i < spokenLetters.length;
                const isNext  = i === spokenLetters.length;
                const shaking = shakeSlot === i;
                return (
                  <div key={i}
                    style={{
                      width: "52px", height: "64px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "14px",
                      fontSize: "1.6rem", fontWeight: 900,
                      transition: "all 0.2s",
                      animation: shaking ? "shake 0.4s ease-in-out" : "none",
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              {speechSupported && (
                <div style={{ position: "relative" }}>
                  {gameState === "listening" && <div className="mic-pulse" style={{ position: "absolute", inset: 0, borderRadius: "50%" }} />}
                  <button
                    onClick={gameState === "listening" ? stopListening : startListening}
                    style={{
                      position: "relative",
                      width: "80px", height: "80px", borderRadius: "50%",
                      fontSize: "1.8rem", border: "none", cursor: "pointer",
                      background: gameState === "listening" ? "linear-gradient(135deg,#ff6b6b,#ff4040)" : "linear-gradient(135deg,#ff6b6b,#ff9f9f)",
                      boxShadow: gameState === "listening" ? "0 0 30px rgba(255,107,107,0.6)" : "0 4px 20px rgba(255,107,107,0.4)",
                      transform: gameState === "listening" ? "scale(1.1)" : "scale(1)",
                      transition: "all 0.2s",
                    }}
                  >
                    {gameState === "listening" ? "⏹️" : "🎤"}
                  </button>
                </div>
              )}

              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#b2bec3", textAlign: "center", margin: 0 }}>
                {gameState === "listening"
                  ? `Say the letter "${word[spokenLetters.length]?.toUpperCase()}"…`
                  : `Tap 🎤 and say letter ${spokenLetters.length + 1} of ${word.length}`}
              </p>

              {!hint && spokenLetters.length < word.length && (
                <button onClick={() => setHint(true)}
                  style={{ padding: "6px 14px", borderRadius: "99px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", background: "#f0e6d3", color: "#636e72", border: "none", fontFamily: "inherit" }}>
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

      <p style={{ marginTop: "16px", fontSize: "0.85rem", fontWeight: 700, color: "#b2bec3" }}>
        Playing as <span style={{ color: "#ff6b6b" }}>{childName}</span> 👶 Age {age}
      </p>
    </div>
  );
}
