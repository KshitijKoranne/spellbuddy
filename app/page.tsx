"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadProgress, saveProfile } from "@/lib/progress";

const S = {
  page: {
    minHeight: "100vh",
    background: "#fef9f0",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    position: "relative" as const,
    overflow: "hidden",
  },
  card: {
    background: "#ffffff",
    borderRadius: "28px",
    padding: "32px",
    width: "100%",
    maxWidth: "420px",
    border: "3px solid #f0e6d3",
    boxShadow: "0 8px 40px rgba(255,107,107,0.12), 0 2px 8px rgba(0,0,0,0.06)",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: 900,
    color: "#ff6b6b",
    letterSpacing: "-1px",
    margin: 0,
    fontFamily: "inherit",
  },
  subtitle: { color: "#636e72", fontSize: "1.1rem", fontWeight: 600, margin: "4px 0 0" },
  label: { display: "block", fontSize: "0.9rem", fontWeight: 700, color: "#636e72", marginBottom: "8px" },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "16px",
    border: "3px solid #f0e6d3",
    fontSize: "1.1rem",
    fontWeight: 700,
    outline: "none",
    background: "#fef9f0",
    color: "#2d3436",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  },
  ageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "8px",
  },
  btnPrimary: (disabled: boolean) => ({
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #ff6b6b, #ff9f9f)",
    color: "white",
    border: "none",
    borderRadius: "16px",
    fontSize: "1.2rem",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: disabled ? "none" : "0 4px 15px rgba(255,107,107,0.4)",
    fontFamily: "inherit",
    transition: "all 0.2s",
  }),
  btnSecondary: {
    width: "100%",
    padding: "12px",
    background: "linear-gradient(135deg, #4ecdc4, #a8ebe7)",
    color: "white",
    border: "none",
    borderRadius: "16px",
    fontSize: "1rem",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(78,205,196,0.35)",
    fontFamily: "inherit",
  },
  footer: { marginTop: "20px", fontSize: "0.85rem", fontWeight: 600, color: "#b2bec3" },
};

export default function Home() {
  const router = useRouter();
  const [name, setName]           = useState("");
  const [age, setAge]             = useState<number | "">("");
  const [returning, setReturning] = useState(false);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    const progress = loadProgress();
    if (progress) {
      setName(progress.profile.name);
      setAge(progress.profile.age);
      setReturning(true);
    }
    setLoaded(true);
  }, []);

  const handleStart = () => {
    if (!name.trim() || !age) return;
    saveProfile({ name: name.trim(), age: Number(age) });
    router.push("/game");
  };

  if (!loaded) return null;

  const disabled = !name.trim() || !age;

  return (
    <div style={S.page}>
      {/* floating decorations */}
      <span style={{ position: "absolute", top: 32, left: 32, fontSize: "3rem", animation: "float 3s ease-in-out infinite" }}>🌟</span>
      <span style={{ position: "absolute", top: 64, right: 48, fontSize: "2.5rem", animation: "float 3s ease-in-out 0.8s infinite" }}>🎈</span>
      <span style={{ position: "absolute", bottom: 64, left: 48, fontSize: "2rem", animation: "float 3s ease-in-out 1.5s infinite" }}>🦋</span>
      <span style={{ position: "absolute", bottom: 48, right: 40, fontSize: "2.5rem", animation: "float 3s ease-in-out 0.4s infinite" }}>🌈</span>

      <div style={S.card}>
        {/* header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "4.5rem", lineHeight: 1 }}>🐝</div>
          <h1 style={S.title}>SpellBuddy</h1>
          <p style={S.subtitle}>
            {returning ? "Welcome back! 👋" : "Learn to spell with fun!"}
          </p>
        </div>

        {/* name */}
        <div style={{ marginBottom: "20px" }}>
          <label style={S.label}>What&apos;s your name? 😊</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleStart()}
            placeholder="e.g. Aarav"
            style={S.input}
            onFocus={e => (e.target.style.borderColor = "#ff6b6b")}
            onBlur={e  => (e.target.style.borderColor = "#f0e6d3")}
          />
        </div>

        {/* age */}
        <div style={{ marginBottom: "24px" }}>
          <label style={S.label}>How old are you? 🎂</label>
          <div style={S.ageGrid}>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(a => (
              <button
                key={a}
                onClick={() => setAge(a)}
                style={{
                  padding: "10px 0",
                  borderRadius: "14px",
                  fontSize: "1.1rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  background: age === a ? "#ff6b6b" : "#fef9f0",
                  color:      age === a ? "white"    : "#2d3436",
                  border:     `3px solid ${age === a ? "#ff6b6b" : "#f0e6d3"}`,
                  transform:  age === a ? "scale(1.1)" : "scale(1)",
                  boxShadow:  age === a ? "0 4px 12px rgba(255,107,107,0.35)" : "none",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button onClick={handleStart} disabled={disabled} style={S.btnPrimary(disabled)}>
          {returning ? "Continue Playing! 🚀" : "Let's Play! 🎉"}
        </button>

        {returning && (
          <button onClick={() => router.push("/progress")} style={{ ...S.btnSecondary, marginTop: "12px" }}>
            View My Progress 📊
          </button>
        )}
      </div>

      <p style={S.footer}>Made with ❤️ for little learners</p>
    </div>
  );
}
