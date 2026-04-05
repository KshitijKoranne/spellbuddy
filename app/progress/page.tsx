"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProgress, clearProgress, GameProgress } from "@/lib/progress";
import { getAgeGroup } from "@/lib/words";

export default function ProgressPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<GameProgress | null>(null);

  useEffect(() => {
    const p = loadProgress();
    if (!p) { router.push("/"); return; }
    setProgress(p);
  }, [router]);

  if (!progress) return null;

  const { profile, words, streak, totalMastered } = progress;
  const ageGroup  = getAgeGroup(profile.age);
  const wordList  = ageGroup.words;
  const mastered  = Object.values(words).filter(w => w.mastered).length;
  const attempted = Object.keys(words).length;
  const pct       = wordList.length > 0 ? Math.round((mastered / wordList.length) * 100) : 0;

  const handleReset = () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      clearProgress();
      router.push("/");
    }
  };

  const card = {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    border: "2px solid #f0e6d3",
    boxShadow: "0 4px 20px rgba(255,107,107,0.08)",
    marginBottom: "16px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fef9f0", padding: "24px 16px 48px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "8px 14px", borderRadius: "14px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", background: "white", border: "2px solid #f0e6d3", color: "#636e72", fontFamily: "inherit" }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900, color: "#ff6b6b" }}>
            {profile.name}&apos;s Progress 📊
          </h1>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "Mastered", value: totalMastered, icon: "⭐", color: "#f5d000" },
            { label: "Streak",   value: `${streak}d`,  icon: "🔥", color: "#ff6b6b" },
            { label: "Tried",    value: attempted,     icon: "🎯", color: "#4ecdc4" },
          ].map(stat => (
            <div key={stat.label} style={{ ...card, marginBottom: 0, textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem" }}>{stat.icon}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#b2bec3", marginTop: "2px" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontWeight: 700, color: "#2d3436" }}>{ageGroup.label} Level</span>
            <span style={{ fontWeight: 900, fontSize: "1.1rem", color: "#ff6b6b" }}>{pct}%</span>
          </div>
          <div style={{ height: "14px", borderRadius: "99px", background: "#f0e6d3", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #ff6b6b, #4ecdc4)", borderRadius: "99px", transition: "width 0.6s ease" }} />
          </div>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#b2bec3", margin: "8px 0 0" }}>
            {mastered} of {wordList.length} words mastered
          </p>
        </div>

        {/* Word list */}
        <div style={card}>
          <h2 style={{ margin: "0 0 14px", fontWeight: 900, color: "#2d3436", fontSize: "1.1rem" }}>Your Words</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {wordList.map(w => {
              const wp         = words[w.word];
              const isMastered = wp?.mastered;
              const isTried    = !!wp;
              return (
                <div key={w.word} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 12px", borderRadius: "12px",
                  background: isMastered ? "#f0fff4" : isTried ? "#fff8f0" : "#fef9f0",
                  border: `2px solid ${isMastered ? "#52c41a" : isTried ? "#ffe66d" : "#f0e6d3"}`,
                }}>
                  <span style={{ fontSize: "1.2rem" }}>{w.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", textTransform: "uppercase", color: isMastered ? "#52c41a" : "#2d3436" }}>
                    {w.word}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: "0.85rem" }}>
                    {isMastered ? "✅" : isTried ? "🔄" : "🔒"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => router.push("/game")}
            style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #ff6b6b, #ff9f9f)", color: "white", border: "none", borderRadius: "16px", fontSize: "1rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 15px rgba(255,107,107,0.35)" }}
          >
            Keep Playing! 🎮
          </button>
          <button
            onClick={handleReset}
            style={{ padding: "14px 16px", background: "white", border: "2px solid #ffb3b3", borderRadius: "16px", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", color: "#ff6b6b", fontFamily: "inherit" }}
          >
            Reset 🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
