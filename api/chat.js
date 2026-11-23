import { createClient } from "@supabase/supabase-js";

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Authentication is unavailable" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return Response.json({ error: "Please sign in again" }, { status: 401 });
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI assistant is not configured" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
  const safeMessages = incomingMessages
    .filter((message) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string"
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }))
    .filter((message) => message.content);

  if (!safeMessages.length) {
    return Response.json({ error: "Enter a message" }, { status: 400 });
  }

  const systemPrompt = `You are the UAHC Hamtic Campus Clinic assistant.
Help patients navigate clinic services, appointment booking, clinic hours, and general wellness information.
Do not diagnose conditions or replace consultation with a licensed clinician.
For emergencies or severe symptoms, tell the user to contact local emergency services or visit the clinic immediately.
Keep answers concise, accurate, and respectful. Never claim access to a patient's private medical record or appointment status.`;

  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  try {
    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      }),
    });

    if (!aiResponse.ok) {
      const details = await aiResponse.text();
      console.error("AI provider error:", aiResponse.status, details);
      return Response.json({ error: "The AI assistant is temporarily unavailable" }, { status: 502 });
    }

    const result = await aiResponse.json();
    const reply = result?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return Response.json({ error: "The AI assistant returned no response" }, { status: 502 });
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("AI request failed:", error);
    return Response.json({ error: "The AI assistant could not connect" }, { status: 502 });
  }
}
