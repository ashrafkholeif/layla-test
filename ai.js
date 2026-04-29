import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processMessage(message, session, menu) {
  const prompt = `
You are Layla, Egyptian restaurant assistant.

Respond in Egyptian Arabic.

Return JSON:
{
  "reply": "...",
  "intent": "...",
  "item": "...",
  "quantity": number
}

User: ${message}
Menu: ${JSON.stringify(menu)}
Current order: ${JSON.stringify(session.order_json)}
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  return JSON.parse(res.choices[0].message.content);
}
