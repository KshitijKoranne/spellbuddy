import { NextRequest, NextResponse } from "next/server";

const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;
const BASE_URL = "https://api.freepik.com";

async function pollTask(taskId: string, maxAttempts = 25): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(
      `${BASE_URL}/v1/ai/text-to-image/flux-2-turbo/${taskId}`,
      { headers: { "x-freepik-api-key": FREEPIK_API_KEY } }
    );
    if (!res.ok) continue;
    const data = await res.json();
    const status = data?.data?.status;
    if (status === "COMPLETED") {
      const generated: string[] = data?.data?.generated ?? [];
      // API returns array of URLs (not base64)
      return generated[0] ?? null;
    }
    if (status === "FAILED") return null;
  }
  return null;
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const { word, hint } = await req.json();
    if (!word || !hint) {
      return NextResponse.json({ error: "Missing word or hint" }, { status: 400 });
    }

    if (!FREEPIK_API_KEY) {
      return NextResponse.json({ error: "FREEPIK_API_KEY not configured" }, { status: 500 });
    }

    const prompt = `A single cute cartoon illustration of ${hint}. Bright pastel colors, plain white background, simple friendly style for children aged 3-10. No text, no letters, no words in the image. Single centered subject.`;

    const submitRes = await fetch(`${BASE_URL}/v1/ai/text-to-image/flux-2-turbo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": FREEPIK_API_KEY,
      },
      body: JSON.stringify({ prompt, aspect_ratio: "square_1_1", num_images: 1 }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      console.error("Freepik submit error:", err);
      return NextResponse.json({ error: "Failed to submit task" }, { status: 500 });
    }

    const submitData = await submitRes.json();
    const taskId = submitData?.data?.task_id;
    if (!taskId) {
      return NextResponse.json({ error: "No task ID returned" }, { status: 500 });
    }

    // Poll until done
    const imageUrl = await pollTask(taskId);
    if (!imageUrl) {
      return NextResponse.json({ error: "Generation timed out or failed" }, { status: 500 });
    }

    // Download image and convert to base64 data URL for permanent client caching
    const base64 = await urlToBase64(imageUrl);
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
