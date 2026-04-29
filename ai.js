import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// تنظيف أي markdown أو ```json
function cleanJSON(text) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function processMessage(message, session, menu) {
  const prompt = `
You are Layla, an Egyptian restaurant assistant.

Rules:
- Speak Egyptian Arabic
- Be short and friendly
- Help the user order food

IMPORTANT:
- Return ONLY valid JSON
- Do NOT use markdown
- Do NOT wrap in \`\`\`
- No explanation

Format:
{
  "reply": "string",
  "intent": "ask_menu | place_order | confirm_order | other",
  "item": "string or null",
  "quantity": number or null
}

User message: ${message}
Menu: ${JSON.stringify(menu)}
Current order: ${JSON.stringify(session.order_json)}
`;

  let raw;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    raw = res.choices[0].message.content;

    const cleaned = cleanJSON(raw);

    const parsed = JSON.parse(cleaned);

    return parsed;
  } catch (err) {
    console.error("AI ERROR:", err);
    console.error("RAW RESPONSE:", raw);

    // 🔥 Fallback (prevents crashes)
    return {
      reply: "معلش حصل مشكلة صغيرة 😅 ممكن تعيد طلبك؟",
      intent: "other",
      item: null,
      quantity: null,
    };
  }
}
