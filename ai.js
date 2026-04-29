import OpenAI from "openai";
import { safeJsonParse, sanitizeInput } from "./utils.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processMessage(message, session, menu, language = "ar") {
  try {
    const sanitized = sanitizeInput(message);
    const menuNames = menu.map((i) => i.name).join(", ");

    const systemPrompt =
      language === "ar"
        ? buildArabicSystemPrompt(menuNames)
        : buildEnglishSystemPrompt(menuNames);

    console.log(`🤖 Processing: "${sanitized}" (${menu.length} items)`);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: sanitized,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const rawContent = response.choices[0].message.content;
    console.log(`📨 Raw AI response: ${rawContent.substring(0, 100)}...`);

    const result = parseAiResponse(rawContent);
    console.log(`✅ Parsed intent: ${result.intent}`);

    return result;
  } catch (err) {
    console.error("❌ AI processing error:", err.message);
    return getFallbackResponse(language);
  }
}

function buildArabicSystemPrompt(menuNames) {
  return `أنت Layla، مساعد خدمة عملاء ودود في مطعم مصري.

🎯 قواعدك:
- تحدث العربية المصرية بشكل طبيعي
- كن قصيرًا وبشري
- ساعد المستخدم في الطلب
- لا تتجاوز 2-3 جمل

⚠️ IMPORTANT - MENU ONLY:
استخدم فقط العناصر من هذا القائمة:
${menuNames}

- إذا لم يكن العنصر في القائمة → قل أنه غير متوفر
- أرجع JSON فقط (بدون markdown)

📋 JSON Format:
{
  "reply": "string",
  "intent": "ask_menu | place_order | confirm_order | view_cart | other",
  "item": "string or null",
  "quantity": number or null
}

أمثلة:
User: "عايز برجر وفرايز"
Response: {"reply":"تمام، برجر وفرايز. كمية كام من كل حاجة؟","intent":"place_order","item":"برجر","quantity":1}

User: "تأكيد"
Response: {"reply":"تمام، تم تأكيد الأوردر ✅","intent":"confirm_order","item":null,"quantity":null}`;
}

function buildEnglishSystemPrompt(menuNames) {
  return `You are Layla, a friendly restaurant assistant.

🎯 Rules:
- Speak naturally and briefly
- Be helpful and human
- Keep responses to 2-3 sentences max

⚠️ IMPORTANT - MENU ONLY:
Only use items from this menu:
${menuNames}

- If item not in menu → say it's unavailable
- Return ONLY valid JSON (no markdown)

📋 JSON Format:
{
  "reply": "string",
  "intent": "ask_menu | place_order | confirm_order | view_cart | other",
  "item": "string or null",
  "quantity": number or null
}

Examples:
User: "I want a burger"
Response: {"reply":"Got it! One burger. Anything else?","intent":"place_order","item":"burger","quantity":1}

User: "Confirm"
Response: {"reply":"Your order is confirmed ✅","intent":"confirm_order","item":null,"quantity":null}`;
}

function parseAiResponse(rawContent) {
  // Try to extract JSON from response
  let jsonStr = rawContent.trim();

  // Remove markdown code blocks if present
  jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Try to parse
  const parsed = safeJsonParse(jsonStr);

  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.reply &&
    parsed.intent &&
    "quantity" in parsed
  ) {
    // Validate intent
    const validIntents = [
      "ask_menu",
      "place_order",
      "confirm_order",
      "view_cart",
      "other",
    ];
    if (!validIntents.includes(parsed.intent)) {
      parsed.intent = "other";
    }

    // Ensure quantity is a number
    parsed.quantity =
      parsed.quantity && typeof parsed.quantity === "number"
        ? Math.max(1, Math.min(10, parsed.quantity))
        : null;

    // Ensure item is string or null
    parsed.item = typeof parsed.item === "string" ? parsed.item.trim() : null;

    return parsed;
  }

  // If parsing failed, return safe fallback
  console.error("Failed to parse AI response:", jsonStr);
  return getFallbackResponse();
}

function getFallbackResponse(language = "ar") {
  if (language === "ar") {
    return {
      reply: "معلش، حصلت مشكلة 😅 حاول تاني من فضلك",
      intent: "other",
      item: null,
      quantity: null,
    };
  }

  return {
    reply: "Sorry, something went wrong. Please try again.",
    intent: "other",
    item: null,
    quantity: null,
  };
}

// For testing
export function testParseAiResponse(rawContent) {
  return parseAiResponse(rawContent);
}
