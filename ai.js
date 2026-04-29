import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function cleanJSON(text) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function processMessage(message, session, menu) {
  const menuNames = menu.map((i) => i.name).join(", ");

  const prompt = `
You are Layla, a friendly Egyptian restaurant assistant.

Rules:
- Speak Egyptian Arabic
- Be short and natural
- Help user order food

IMPORTANT:
- Only use items from this menu:
${menuNames}

- If item not in menu → say it's unavailable
- Return ONLY valid JSON (no markdown)

Format:
{
  "reply": "string",
  "intent": "ask_menu | place_order | confirm_order | other",
  "item": "string or null",
  "quantity": number or null
}

User message: ${message}
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
    console.error("RAW:", raw);

    return {
      reply: "معلش حصلت مشكلة 😅 حاول تاني",
      intent: "other",
      item: null,
      quantity: null,
    };
  }
}
