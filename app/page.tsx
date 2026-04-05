"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadProgress, saveProfile } from "@/lib/progress";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [returning, setReturning] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="absolute top-10 left-10 text-6xl animate-float" style={{ animationDelay: "0s" }}>🌟</div>
      <div className="absolute top-20 right-16 text-5xl animate-float" style={{ animationDelay: "0.8s" }}>🎈</div>
      <div className="absolute bottom-20 left-16 text-4xl animate-float" style={{ animationDelay: "1.5s" }}>🦋</div>
      <div className="absolute bottom-16 right-12 text-5xl animate-float" style={{ animationDelay: "0.4s" }}>🌈</div>

      <div className="bg-white rounded-3xl p-8 w-full max-w-md card-shadow animate-bounce-in" style={{ border: "3px solid #f0e6d3" }}>
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🐝</div>
          <h1 className="text-4xl font-black" style={{ color: "#ff6b6b", letterSpacing: "-1px" }}>SpellBuddy</h1>
          <p className="text-lg mt-1 font-semibold" style={{ color: "#636e72" }}>
            {returning ? "Welcome back! 👋" : "Learn to spell with fun!"}
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: "#636e72" }}>
              What&apos;s your name? 😊
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav"
              className="w-full px-4 py-3 rounded-2xl text-lg font-bold outline-none transition-all"
              style={{ border: "3px solid #f0e6d3", fontFamily: "Nunito, sans-serif", color: "#2d3436", background: "#fef9f0" }}
              onFocus={(e) => (e.target.style.borderColor = "#ff6b6b")}
              onBlur={(e) => (e.target.style.borderColor = "#f0e6d3")}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: "#636e72" }}>
              How old are you? 🎂
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((a) => (
                <button
                  key={a}
                  onClick={() => setAge(a)}
                  className="py-3 rounded-2xl text-lg font-black transition-all"
                  style={{
                    background: age === a ? "#ff6b6b" : "#fef9f0",
                    color: age === a ? "white" : "#2d3436",
                    border: `3px solid ${age === a ? "#ff6b6b" : "#f0e6d3"}`,
                    transform: age === a ? "scale(1.1)" : "scale(1)",
                    fontFamily: "Nunito, sans-serif",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!name.trim() || !age}
            className="btn-primary w-full py-4 text-xl mt-2"
            style={{ opacity: !name.trim() || !age ? 0.5 : 1 }}
          >
            {returning ? "Continue Playing! 🚀" : "Let's Play! 🎉"}
          </button>

          {returning && (
            <button onClick={() => router.push("/progress")} className="btn-secondary w-full py-3 text-base">
              View My Progress 📊
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm font-semibold" style={{ color: "#b2bec3" }}>
        Made with ❤️ for little learners
      </p>
    </main>
  );
}
