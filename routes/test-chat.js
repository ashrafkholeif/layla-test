import { processMessage } from "../ai.js";
import { findMenuItemFuzzy } from "../utils.js";
import * as db from "../db.js";

export async function handleTestChat(req, res) {
  try {
    const { message, branchId, userPhone } = req.body;

    if (!message || !branchId || !userPhone) {
      return res.status(400).json({
        error: "message, branchId, and userPhone are required",
      });
    }

    console.log(`\n🧪 TEST CHAT: From: ${userPhone}, Message: "${message}"`);

    // Get or create session
    const session = await db.getOrCreateSession(branchId, userPhone);
    console.log(`📋 Session ID: ${session.id}`);

    // Fetch menu for this branch
    const menu = await db.getMenuForBranch(branchId);
    if (menu.length === 0) {
      return res.status(400).json({
        error: "No menu items for this branch",
      });
    }

    let orderJson = session.order_json || [];
    let pendingItem = session.pending_item || null;

    // ─────────────────────────────────────────
    // Check if user is confirming a pending item
    // ─────────────────────────────────────────
    if (
      pendingItem &&
      (message.toLowerCase().includes("نعم") ||
        message.toLowerCase().includes("yes") ||
        message.toLowerCase().includes("تمام") ||
        message.toLowerCase().includes("أكد") ||
        message.toLowerCase().includes("confirm"))
    ) {
      console.log(`✅ User confirmed pending item: ${pendingItem.name}`);
      orderJson.push(pendingItem);
      await db.updateSession(session.id, orderJson);
      await db.clearPendingItem(session.id);
      const confirmMsg = `تم إضافة ${pendingItem.name} ✅\n\nحاجة أخرى؟ (قول "تمام" لتأكيد الطلب)`;
      return res.json({
        reply: confirmMsg,
        orderJson,
      });
    }

    // ─────────────────────────────────────────
    // Check if user is rejecting a pending item
    // ─────────────────────────────────────────
    if (
      pendingItem &&
      (message.toLowerCase().includes("لا") ||
        message.toLowerCase().includes("no") ||
        message.toLowerCase().includes("مش") ||
        message.toLowerCase().includes("cancel"))
    ) {
      console.log(`❌ User rejected pending item: ${pendingItem.name}`);
      await db.clearPendingItem(session.id);
      const rejectMsg = `حسن، ما تم إضافة ${pendingItem.name}\n\nحاجة أخرى؟`;
      return res.json({
        reply: rejectMsg,
        orderJson,
      });
    }

    // ─────────────────────────────────────────
    // Check if user is finalizing the order
    // ─────────────────────────────────────────
    if (
      !pendingItem &&
      orderJson.length > 0 &&
      (message.toLowerCase().includes("تمام") ||
        message.toLowerCase().includes("خلص") ||
        message.toLowerCase().includes("انتهي"))
    ) {
      console.log(`✅ User finalizing order with ${orderJson.length} items`);

      let total = 0;
      let orderDetails = "الطلب:\n";
      for (const order of orderJson) {
        const itemTotal = order.price * order.qty;
        total += itemTotal;
        orderDetails += `• ${order.item} x${order.qty} = ${itemTotal} جنيه\n`;
      }

      await db.createOrder(branchId, userPhone, orderJson, total);
      await db.clearSession(session.id);

      const confirmMessage = `تم تأكيد الأوردر ✅\n${orderDetails}الإجمالي: ${total} جنيه\nشكرًا لاختيارك! 🎉`;
      console.log(`✅ Order confirmed: ${total} EGP`);
      return res.json({
        reply: confirmMessage,
        orderJson: [],
        orderConfirmed: true,
        total,
      });
    }

    // ─────────────────────────────────────────
    // Process message with AI
    // ─────────────────────────────────────────
    const aiResponse = await processMessage(message, session, menu);
    console.log(`✅ AI response: ${JSON.stringify(aiResponse)}`);

    // ─────────────────────────────────────────
    // Handle place_order intent
    // ─────────────────────────────────────────
    if (aiResponse.intent === "place_order" && aiResponse.item) {
      console.log(`🛒 Intent: place_order, item: ${aiResponse.item}`);
      const item = findMenuItemFuzzy(menu, aiResponse.item);

      if (!item) {
        const response = `${aiResponse.reply} 😅`;
        console.log(`⚠️ Item not found: "${aiResponse.item}"`);
        return res.json({
          reply: response,
          orderJson,
        });
      }

      // Set pending item and ask for confirmation
      await db.setPendingItem(session.id, item.name, item.price);
      console.log(`⏳ Pending item set: ${item.name}`);

      const confirmMsg = `تمام! عايز ${item.name}؟ (قول "نعم" للتأكيد أو "لا" للرفض)`;
      return res.json({
        reply: confirmMsg,
        orderJson,
        pendingItem: item,
      });
    }

    // ─────────────────────────────────────────
    // Default reply
    // ─────────────────────────────────────────
    console.log(`💬 Intent: ${aiResponse.intent} (default reply)`);
    return res.json({
      reply: aiResponse.reply,
      orderJson,
    });
  } catch (err) {
    console.error("❌ Test chat error:", err.message);
    return res.status(500).json({
      error: "Failed to process message: " + err.message,
    });
  }
}
