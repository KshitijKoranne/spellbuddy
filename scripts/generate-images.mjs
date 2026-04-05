/**
 * SpellBuddy — Pre-image generation script
 * Uses Freepik Flux 2 Turbo to generate all word images
 * Saves as JPGs to public/word-images/ — committed to repo, zero runtime API cost
 *
 * Usage: node scripts/generate-images.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../public/word-images");
const BASE_URL = "https://api.freepik.com";

function loadEnv() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) { console.error("❌ .env.local not found"); process.exit(1); }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() === "FREEPIK_API_KEY") return rest.join("=").trim();
  }
  console.error("❌ FREEPIK_API_KEY not found in .env.local"); process.exit(1);
}

function curlPost(url, apiKey, body) {
  const escaped = JSON.stringify(body).replace(/'/g, "'\\''");
  const cmd = `curl -s -m 30 -X POST "${url}" -H "Content-Type: application/json" -H "x-freepik-api-key: ${apiKey}" -d '${escaped}'`;
  const out = execSync(cmd, { encoding: "utf8" });
  return JSON.parse(out);
}

function curlGet(url, apiKey) {
  const cmd = `curl -s -m 30 "${url}" -H "x-freepik-api-key: ${apiKey}"`;
  const out = execSync(cmd, { encoding: "utf8" });
  return JSON.parse(out);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollTask(apiKey, taskId, maxAttempts = 25) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    try {
      const data = curlGet(`${BASE_URL}/v1/ai/text-to-image/flux-2-turbo/${taskId}`, apiKey);
      const status = data?.data?.status;
      process.stdout.write(`    ↻ [${i+1}] ${status}... `);
      if (status === "COMPLETED") {
        console.log("✓");
        const generated = data?.data?.generated;
        if (generated?.length > 0) return generated[0].base64;
      }
      if (status === "FAILED") { console.log("FAILED"); return null; }
      console.log("");
    } catch (e) { console.log(`poll error: ${e.message}`); }
  }
  return null;
}

const WORDS = [
  { word: "bee",    hint: "a yellow and black striped bee" },
  { word: "cat",    hint: "a cute cartoon cat" },
  { word: "dog",    hint: "a friendly cartoon dog" },
  { word: "sun",    hint: "a bright yellow sun with rays" },
  { word: "hat",    hint: "a colorful red hat" },
  { word: "pig",    hint: "a pink cartoon pig" },
  { word: "egg",    hint: "a white egg" },
  { word: "cup",    hint: "a cute colorful cup" },
  { word: "bus",    hint: "a bright yellow school bus" },
  { word: "cow",    hint: "a friendly black and white cow" },
  { word: "frog",   hint: "a green cartoon frog on a lily pad" },
  { word: "tree",   hint: "a big green tree" },
  { word: "cake",   hint: "a colorful birthday cake" },
  { word: "bird",   hint: "a small colorful bird on a branch" },
  { word: "fish",   hint: "a bright orange fish" },
  { word: "bear",   hint: "a friendly cartoon bear" },
  { word: "duck",   hint: "a yellow cartoon duck" },
  { word: "rain",   hint: "raindrops falling from a cloud" },
  { word: "moon",   hint: "a glowing crescent moon with stars" },
  { word: "star",   hint: "a bright yellow star" },
  { word: "kite",   hint: "a colorful kite flying in the sky" },
  { word: "boat",   hint: "a small colorful sailboat on water" },
  { word: "apple",  hint: "a shiny red apple" },
  { word: "cloud",  hint: "a fluffy white cloud in a blue sky" },
  { word: "tiger",  hint: "a cartoon orange tiger" },
  { word: "horse",  hint: "a brown cartoon horse" },
  { word: "pizza",  hint: "a delicious pizza slice" },
  { word: "grape",  hint: "a bunch of purple grapes" },
  { word: "beach",  hint: "a sunny beach with waves" },
  { word: "bread",  hint: "a loaf of golden bread" },
  { word: "piano",  hint: "a black and white piano" },
  { word: "globe",  hint: "a colorful globe of the earth" },
  { word: "flower", hint: "a bright colorful flower" },
  { word: "castle", hint: "a fairytale castle" },
  { word: "rabbit", hint: "a white fluffy rabbit" },
  { word: "bridge", hint: "a stone bridge over a river" },
  { word: "candle", hint: "a glowing candle with a flame" },
  { word: "spider", hint: "a cartoon spider on a web" },
  { word: "parrot", hint: "a colorful cartoon parrot" },
  { word: "rocket", hint: "a cartoon rocket launching into space" },
  { word: "cactus", hint: "a cartoon green cactus" },
  { word: "donkey", hint: "a cartoon donkey" },
];

async function main() {
  const apiKey = loadEnv();
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existing = fs.readdirSync(OUTPUT_DIR).map(f => f.replace(".jpg", ""));
  const todo = WORDS.filter(w => !existing.includes(w.word));

  console.log(`\n🎨 SpellBuddy Image Pre-generator`);
  console.log(`   Total: ${WORDS.length} | Done: ${existing.length} | To generate: ${todo.length}\n`);

  if (todo.length === 0) { console.log("✅ All images ready!"); return; }

  let ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const { word, hint } = todo[i];
    console.log(`[${i+1}/${todo.length}] 🖼  ${word}`);
    try {
      const prompt = `A single cute cartoon illustration of ${hint}. Bright pastel colors, plain white background, simple friendly style for children aged 3-10. No text, no letters in the image. Single centered subject.`;
      const submit = curlPost(`${BASE_URL}/v1/ai/text-to-image/flux-2-turbo`, apiKey, {
        prompt, aspect_ratio: "square_1_1", num_images: 1
      });
      const taskId = submit?.data?.task_id;
      if (!taskId) throw new Error("No task_id: " + JSON.stringify(submit));
      console.log(`    → task: ${taskId}`);
      const base64 = await pollTask(apiKey, taskId);
      if (!base64) { console.log(`    ❌ No image returned\n`); fail++; continue; }
      const buf = Buffer.from(base64, "base64");
      fs.writeFileSync(path.join(OUTPUT_DIR, `${word}.jpg`), buf);
      console.log(`    ✅ ${word}.jpg saved (${Math.round(buf.length/1024)}KB)\n`);
      ok++;
      if (i < todo.length - 1) await sleep(800);
    } catch (e) {
      console.log(`    ❌ ${e.message}\n`);
      fail++;
    }
  }
  console.log(`\n🎉 Done! ✅ ${ok} generated  ❌ ${fail} failed`);
  if (fail > 0) console.log(`   Re-run script to retry failures.`);
}

main();
