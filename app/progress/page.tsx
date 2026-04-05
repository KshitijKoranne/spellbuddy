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
  const ageGroup = getAgeGroup(profile.age);
  const wordList = ageGroup.words;
  const attempted = Object.keys(words).length;
  const mastered = Object.values(words).filter((w) => w.mastered).length;
  const pct = wordList.length > 0 ? Math.round((mastered / wordList.length) * 100) : 0;

  const handleReset = () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      clearProgress();
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-4 pt-8 pb-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/")}
            className="px-3 py-2 rounded-2xl font-bold text-sm"
            style={{ background: "white", border: "2px solid #f0e6d3", color: "#636e72" }}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black" style={{ color: "#ff6b6b" }}>
            {profile.name}&apos;s Progress 📊
          </h1>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Mastered", value: totalMastered, icon: "⭐", color: "#ffe66d" },
            { label: "Streak", value: `${streak} days`, icon: "🔥", color: "#ff6b6b" },
            { label: "Tried", value: attempted, icon: "🎯", color: "#4ecdc4" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 text-center card-shadow" style={{ border: "2px solid #f0e6d3" }}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs font-bold mt-1" style={{ color: "#b2bec3" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl p-5 mb-5 card-shadow" style={{ border: "2px solid #f0e6d3" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold" style={{ color: "#2d3436" }}>
              {ageGroup.label} Level
            </p>
            <span className="font-black text-lg" style={{ color: "#ff6b6b" }}>{pct}%</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: "16px", background: "#f0e6d3" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #ff6b6b, #4ecdc4)",
              }}
            />
          </div>
          <p className="text-xs font-semibold mt-2" style={{ color: "#b2bec3" }}>
            {mastered} of {wordList.length} words mastered
          </p>
        </div>

        {/* Word list */}
        <div className="bg-white rounded-2xl p-5 card-shadow" style={{ border: "2px solid #f0e6d3" }}>
          <h2 className="font-black text-lg mb-4" style={{ color: "#2d3436" }}>Your Words</h2>
          <div className="grid grid-cols-2 gap-2">
            {wordList.map((w) => {
              const wp = words[w.word];
              const isMastered = wp?.mastered;
              const isTried = !!wp;
              return (
                <div
                  key={w.word}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: isMastered ? "#f0fff4" : isTried ? "#fff8f0" : "#fef9f0",
                    border: `2px solid ${isMastered ? "#52c41a" : isTried ? "#ffe66d" : "#f0e6d3"}`,
                  }}
                >
                  <span className="text-lg">{w.emoji}</span>
                  <span className="font-bold text-sm uppercase" style={{ color: isMastered ? "#52c41a" : "#2d3436" }}>
                    {w.word}
                  </span>
                  <span className="ml-auto text-xs">
                    {isMastered ? "✅" : isTried ? "🔄" : "🔒"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button onClick={() => router.push("/game")} className="btn-primary flex-1 py-3 text-base">
            Keep Playing! 🎮
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-2xl font-bold text-sm"
            style={{ background: "white", border: "2px solid #ffb3b3", color: "#ff6b6b" }}
          >
            Reset 🗑️
          </button>
        </div>
      </div>
    </main>
  );
}
