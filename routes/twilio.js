import { processMessage } from "../ai.js";
import { findMenuItemFuzzy } from "../utils.js";
import * as db from "../db.js";

export async function handleTwilioWebhook(req, res) {
  console.log("\n🔔 Twilio webhook received");

  // SET PROPER HEADERS IMMEDIATELY
  res.type("text/xml");

  try {
    const incomingMessage = req.body.Body || "";
    const fromPhone = req.body.From || "";
    const toPhone = req.body.To || "";

    console.log(`📱 From: ${fromPhone}, To: ${toPhone}`);
    console.log(`💬 Message: "${incomingMessage}"`);

    // Identify branch by Twilio number (to phone)
    const branch = await db.getBranchByPhone(toPhone);

    if (!branch) {
      console.error(`❌ No active branch for phone: ${toPhone}`);
      const response = generateTwiML(
        "عذرًا، لم نتمكن من تحديد المطعم. تواصل مع الدعم.",
      );
      return res.status(400).send(response);
    }

    console.log(`✅ Branch identified: ${branch.name}`);

    // Get or create session
    const session = await db.getOrCreateSession(branch.id, fromPhone);
    console.log(`📋 Session ID: ${session.id}`);

    // Fetch menu for this branch
    const menu = await db.getMenuForBranch(branch.id);
    if (menu.length === 0) {
      console.error(`⚠️ No menu items for branch: ${branch.id}`);
      const response = generateTwiML("المنيو غير متاح الآن. حاول لاحقًا.");
      return res.status(400).send(response);
    }

    // Process message with AI
    const aiResponse = await processMessage(incomingMessage, session, menu);

    let orderJson = session.order_json || [];

    // Handle intents
    if (aiResponse.intent === "place_order" && aiResponse.item) {
      const item = findMenuItemFuzzy(menu, aiResponse.item);

      if (!item) {
        const response = generateTwiML(`${aiResponse.reply} 😅`);
        return res.status(200).send(response);
      }

      orderJson.push({
        item: item.name,
        qty: aiResponse.quantity || 1,
        price: item.price,
      });

      await db.updateSession(session.id, orderJson);
      console.log(`✅ Item added to order: ${item.name}`);
    }

    if (aiResponse.intent === "confirm_order") {
      if (orderJson.length === 0) {
        const response = generateTwiML("ما فيش حاجات في الأوردر بتاعك.");
        return res.status(200).send(response);
      }

      let total = 0;
      for (const order of orderJson) {
        total += order.price * order.qty;
      }

      await db.createOrder(branch.id, fromPhone, orderJson, total);
      await db.clearSession(session.id);

      const confirmMessage = `تم تأكيد الأوردر ✅\nالإجمالي: ${total} جنيه\nشكرًا لاختيارك! 🎉`;
      console.log(`✅ Order confirmed: ${total} EGP`);
      const response = generateTwiML(confirmMessage);
      return res.status(200).send(response);
    }

    // Default reply
    const response = generateTwiML(aiResponse.reply);
    return res.status(200).send(response);
  } catch (err) {
    console.error("❌ Twilio handler error:", err);
    const response = generateTwiML("حصلت مشكلة في المعالجة. حاول مرة أخرى.");
    return res.status(500).send(response);
  }
}

// CRITICAL: Generate proper TwiML response
function generateTwiML(message) {
  // Ensure message is valid XML
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`;
}
