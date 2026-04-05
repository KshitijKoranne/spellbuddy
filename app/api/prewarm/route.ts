import { NextRequest, NextResponse } from "next/server";
import { AGE_GROUPS, getAgeGroup } from "@/lib/words";

const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;
const BASE_URL = "https://api.freepik.com";

async function generateOne(word: string, hint: string): Promise<{ word: string; dataUrl: string | null }> {
  try {
    const prompt = `A single cute cartoon illustration of ${hint}. Bright pastel colors, plain white background, simple friendly style for children aged 3-10. No text, no letters in the image. Single centered subject.`;

    const submitRes = await fetch(`${BASE_URL}/v1/ai/text-to-image/flux-2-turbo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": FREEPIK_API_KEY,
      },
      body: JSON.stringify({ prompt, aspect_ratio: "square_1_1", num_images: 1 }),
    });

    if (!submitRes.ok) return { word, dataUrl: null };

    const { data } = await submitRes.json();
    const taskId = data?.task_id;
    if (!taskId) return { word, dataUrl: null };

    // Poll
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(`${BASE_URL}/v1/ai/text-to-image/flux-2-turbo/${taskId}`, {
        headers: { "x-freepik-api-key": FREEPIK_API_KEY },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      const status = pollData?.data?.status;
      if (status === "COMPLETED") {
        const imageUrl: string = pollData?.data?.generated?.[0];
        if (!imageUrl) return { word, dataUrl: null };
        const imgRes = await fetch(imageUrl);
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return { word, dataUrl: `data:image/png;base64,${base64}` };
      }
      if (status === "FAILED") return { word, dataUrl: null };
    }
    return { word, dataUrl: null };
  } catch {
    return { word, dataUrl: null };
  }
}

// GET /api/prewarm?age=6&skip=cat,dog  → streams back { word, dataUrl } per image
// Client calls this once on first launch and caches results in localStorage
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const age = parseInt(searchParams.get("age") ?? "6");
  const skipRaw = searchParams.get("skip") ?? "";
  const skip = new Set(skipRaw ? skipRaw.split(",") : []);

  const group = getAgeGroup(age);
  const todo = group.words.filter((w) => !skip.has(w.word));

  if (todo.length === 0) {
    return NextResponse.json({ done: true, results: [] });
  }

  // Generate all words for this age group (sequentially to stay within rate limits)
  const results: { word: string; dataUrl: string | null }[] = [];
  for (const w of todo) {
    const result = await generateOne(w.word, w.hint);
    results.push(result);
  }

  return NextResponse.json({ done: true, results });
}
