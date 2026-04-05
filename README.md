# 🐝 SpellBuddy

A cheerful spelling game for kids with real speech recognition and AI-generated illustrations.

## How it works

1. Enter child's name and age → word difficulty adapts automatically
2. App shows an AI-generated illustration of the word
3. Child taps 🎤 and speaks each letter one by one
4. Correct? 🎉 Confetti! Wrong? Gentle shake — try again
5. Progress is saved locally across sessions

## First-run image generation

On the very first launch, SpellBuddy silently generates all images for the child's age group using the Freepik API (Flux 2 Turbo model). A progress banner shows at the top while this happens. Once done, all images are cached in `localStorage` permanently — **zero API calls on subsequent plays**.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Freepik key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Word bank

| Age  | Level           | Word length | Examples               |
|------|-----------------|-------------|------------------------|
| 4–5  | Tiny Tots       | 2–3 letters | bee, cat, dog, sun     |
| 6–7  | Little Learners | 3–4 letters | frog, tree, cake, bird |
| 8–9  | Super Spellers  | 4–5 letters | apple, cloud, tiger    |
| 10+  | Word Champions  | 5–6 letters | flower, castle, rabbit |

## Tech stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Web Speech API** — real microphone input
- **Freepik Flux 2 Turbo** — AI image generation
- **canvas-confetti** — celebration animations
- **localStorage** — progress + image cache (Phase 1)

## Deploying to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add `FREEPIK_API_KEY` in Vercel environment variables
4. Deploy

## Phase 2 (planned)

- Turso DB for cross-device progress sync
- Multiple child profiles
- Audio pronunciation of the word
- More word categories
