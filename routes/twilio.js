import { processMessage } from "../ai.js";
import {
  findMenuItemFuzzy,
  resolveAmbiguousItem,
  normalizeArabic,
} from "../utils.js";
import * as db from "../db.js";
import { relayOrderToBranch } from "../twilio-client.js";

const LAYLA_INBOUND_NUMBER = process.env.LAYLA_INBOUND_NUMBER;

export async function handleTwilioWebhook(req, res) {
  console.log("\n🔔 Twilio webhook received");
  console.log(`   Raw headers: ${JSON.stringify(req.headers)}`);
  console.log(`   Raw body keys: ${Object.keys(req.body).join(", ")}`);

  // SET PROPER HEADERS IMMEDIATELY
  res.type("text/xml");
  console.log(`✅ Content-Type set to: text/xml`);

  try {
    const incomingMessage = req.body.Body || "";
    let fromPhone = req.body.From || "";
    let toPhone = req.body.To || "";

    // Strip "whatsapp:" prefix if present (Twilio sends: whatsapp:+1234567890)
    fromPhone = fromPhone.replace(/^whatsapp:/, "");
    toPhone = toPhone.replace(/^whatsapp:/, "");

    console.log(`📱 From: ${fromPhone}, To: ${toPhone}`);
    console.log(`💬 Message: "${incomingMessage}"`);

    // ─────────────────────────────────────────
    // Determine flow: global number vs branch-specific
    // ─────────────────────────────────────────
    const isGlobalNumber =
      LAYLA_INBOUND_NUMBER && toPhone === LAYLA_INBOUND_NUMBER;
    let branch = null;
    let session = null;

    if (isGlobalNumber) {
      console.log(`🌍 Global inbound number detected`);
      session = await db.getOrCreateGlobalSession(fromPhone);

      if (session.branch_id) {
        branch = await db.getBranchById(session.branch_id);
        console.log(`✅ Session has branch: ${branch?.name}`);
      }
    } else {
      // Branch-specific number flow (original behavior)
      branch = await db.getBranchByPhone(toPhone);
      if (!branch) {
        console.error(`❌ No active branch for phone: ${toPhone}`);
        const response = generateTwiML(
          "عذرًا، لم نتمكن من تحديد المطعم. تواصل مع الدعم.",
        );
        return res.status(400).send(response);
      }
      console.log(`✅ Branch identified: ${branch.name}`);
      session = await db.getOrCreateSession(branch.id, fromPhone);
      console.log(`📋 Session ID: ${session.id}`);
    }

    // ─────────────────────────────────────────
    // GLOBAL NUMBER: Branch selection flow
    // ─────────────────────────────────────────
    if (isGlobalNumber && !branch) {
      const context = session.context || {};

      // If we're already awaiting branch selection, process the reply
      if (context.awaitingBranchSelection && context.branchOptions) {
        const selected = matchBranchSelection(
          incomingMessage,
          context.branchOptions,
        );
        if (selected) {
          branch = selected;
          const updatedSession = await db.updateSessionBranch(
            session.id,
            branch.id,
          );
          await db.updateSessionContext(session.id, {});
          console.log(`✅ Branch selected and saved: ${branch.name}`);
          const welcomeMsg = `تمام! هنطلب من ${branch.name} 🍽️\n\nقوللي عايز إيه؟`;
          return res.status(200).send(generateTwiML(welcomeMsg));
        } else {
          const retryMsg = buildBranchSelectionMessage(
            context.branchOptions,
            true,
          );
          return res.status(200).send(generateTwiML(retryMsg));
        }
      }

      // First time — ask for branch selection
      const allBranches = await db.getAllActiveBranches();
      if (allBranches.length === 0) {
        return res
          .status(200)
          .send(generateTwiML("مفيش فروع متاحة حاليًا. حاول تاني بعدين."));
      }

      const newContext = {
        awaitingBranchSelection: true,
        branchOptions: allBranches,
      };
      await db.updateSessionContext(session.id, newContext);

      const selectionMsg = buildBranchSelectionMessage(allBranches);
      return res.status(200).send(generateTwiML(selectionMsg));
    }

    // ─────────────────────────────────────────
    // NORMAL ORDER FLOW (we have a branch now)
    // ─────────────────────────────────────────

    // Fetch menu for this branch
    const menu = await db.getMenuForBranch(branch.id);
    if (menu.length === 0) {
      console.error(`⚠️ No menu items for branch: ${branch.id}`);
      const response = generateTwiML("المنيو غير متاح الآن. حاول لاحقًا.");
      return res.status(400).send(response);
    }

    let orderJson = session.order_json || [];
    let pendingItem = session.pending_item || null;
    let context = session.context || {};

    // ─────────────────────────────────────────
    // 1. Check if user is selecting an ambiguous item
    // ─────────────────────────────────────────
    if (context.awaitingItemSelection && context.itemOptions) {
      const selected = matchItemSelection(incomingMessage, context.itemOptions);
      if (selected) {
        await db.setPendingItem(
          session.id,
          selected.name,
          selected.price,
          context.selectionQty || 1,
        );
        await db.updateSessionContext(session.id, {});
        const confirmMsg = `تمام! عايز ${selected.name} (${selected.price} جنيه)؟ (قول "نعم" للتأكيد أو "لا" للرفض)`;
        return res.status(200).send(generateTwiML(confirmMsg));
      } else {
        const retryMsg = buildItemSelectionMessage(
          context.itemOptions,
          context.selectionQuery,
          true,
        );
        return res.status(200).send(generateTwiML(retryMsg));
      }
    }

    // ─────────────────────────────────────────
    // 2. Check if user is confirming a pending item
    // ─────────────────────────────────────────
    if (
      pendingItem &&
      (incomingMessage.toLowerCase().includes("نعم") ||
        incomingMessage.toLowerCase().includes("yes") ||
        incomingMessage.toLowerCase().includes("تمام") ||
        incomingMessage.toLowerCase().includes("أكد") ||
        incomingMessage.toLowerCase().includes("confirm"))
    ) {
      console.log(`✅ User confirmed pending item: ${pendingItem.name}`);
      orderJson.push(pendingItem);
      await db.updateSession(session.id, orderJson);
      await db.clearPendingItem(session.id);
      const confirmMsg = `تم إضافة ${pendingItem.name} ✅\n\nحاجة أخرى؟ (قول "تمام" لتأكيد الطلب)`;
      const response = generateTwiML(confirmMsg);
      return res.status(200).send(response);
    }

    // ─────────────────────────────────────────
    // 3. Check if user is rejecting a pending item
    // ─────────────────────────────────────────
    if (
      pendingItem &&
      (incomingMessage.toLowerCase().includes("لا") ||
        incomingMessage.toLowerCase().includes("no") ||
        incomingMessage.toLowerCase().includes("مش") ||
        incomingMessage.toLowerCase().includes("cancel"))
    ) {
      console.log(`❌ User rejected pending item: ${pendingItem.name}`);
      await db.clearPendingItem(session.id);
      const rejectMsg = `حسن، ما تم إضافة ${pendingItem.name}\n\nحاجة أخرى؟`;
      const response = generateTwiML(rejectMsg);
      return res.status(200).send(response);
    }

    // ─────────────────────────────────────────
    // 3b. Check if user is finalizing the order (no pending item, but has items in order)
    // ─────────────────────────────────────────
    if (
      !pendingItem &&
      orderJson.length > 0 &&
      (incomingMessage.toLowerCase().includes("تمام") ||
        incomingMessage.toLowerCase().includes("خلص") ||
        incomingMessage.toLowerCase().includes("انتهي"))
    ) {
      console.log(`✅ User finalizing order with ${orderJson.length} items`);

      let total = 0;
      let orderDetails = "الطلب:\n";
      for (const order of orderJson) {
        const itemTotal = order.price * order.qty;
        total += itemTotal;
        orderDetails += `• ${order.item} x${order.qty} = ${itemTotal} جنيه\n`;
      }

      await db.createOrder(branch.id, fromPhone, orderJson, total);
      await db.clearSession(session.id);

      // Send order to restaurant branch's WhatsApp number
      if (branch.phone) {
        const restaurantMsg = `📦 طلب جديد من ${fromPhone}\n\n${orderDetails}\nالإجمالي: ${total} جنيه`;
        console.log(`📨 Relaying order to restaurant: ${branch.phone}`);
        console.log(`   Message: ${restaurantMsg}`);
        // TODO: Implement actual Twilio message sending to branch.phone
      }

      const confirmMessage = `تم تأكيد الأوردر ✅\n${orderDetails}الإجمالي: ${total} جنيه\nشكرًا لاختيارك! 🎉`;
      console.log(`✅ Order confirmed: ${total} EGP`);
      const response = generateTwiML(confirmMessage);
      return res.status(200).send(response);
    }

    // ─────────────────────────────────────────
    // 4. Process message with AI
    // ─────────────────────────────────────────
    const aiResponse = await processMessage(incomingMessage, session, menu);
    console.log(`✅ AI response: ${JSON.stringify(aiResponse)}`);

    // ─────────────────────────────────────────
    // 5. Handle place_order intent
    // ─────────────────────────────────────────
    if (aiResponse.intent === "place_order" && aiResponse.item) {
      console.log(`🛒 Intent: place_order, item: ${aiResponse.item}`);

      // Check for ambiguous matches first
      const resolution = resolveAmbiguousItem(menu, aiResponse.item);

      if (resolution.type === "none") {
        const response = generateTwiML(`${aiResponse.reply} 😅`);
        console.log(`⚠️ Item not found: "${aiResponse.item}"`);
        return res.status(200).send(response);
      }

      if (resolution.type === "ambiguous") {
        const qty = aiResponse.quantity || 1;
        const context = {
          awaitingItemSelection: true,
          itemOptions: resolution.items,
          selectionQuery: aiResponse.item,
          selectionQty: qty,
        };
        await db.updateSessionContext(session.id, context);
        const selectionMsg = buildItemSelectionMessage(
          resolution.items,
          aiResponse.item,
        );
        return res.status(200).send(generateTwiML(selectionMsg));
      }

      // Single clear match — set pending item
      const item = resolution.item;
      const qty = aiResponse.quantity || 1;
      await db.setPendingItem(session.id, item.name, item.price, qty);
      console.log(`⏳ Pending item set: ${item.name} x${qty}`);

      const confirmMsg = `تمام! عايز ${item.name} (${item.price} جنيه)${qty > 1 ? ` × ${qty}` : ""}؟ (قول "نعم" للتأكيد أو "لا" للرفض)`;
      const response = generateTwiML(confirmMsg);
      return res.status(200).send(response);
    }

    // ─────────────────────────────────────────
    // 6. Handle confirm_order intent
    // ─────────────────────────────────────────
    if (aiResponse.intent === "confirm_order") {
      console.log(`✅ Intent: confirm_order`);
      if (orderJson.length === 0) {
        const response = generateTwiML("ما فيش حاجات في الأوردر بتاعك.");
        console.log(`📤 No items in order`);
        return res.status(200).send(response);
      }

      let total = 0;
      let orderDetails = "الطلب:\n";
      for (const order of orderJson) {
        const itemTotal = order.price * order.qty;
        total += itemTotal;
        orderDetails += `• ${order.name || order.item} x${order.qty} = ${itemTotal} جنيه\n`;
      }

      await db.createOrder(branch.id, fromPhone, orderJson, total);

      // Relay order to restaurant branch via WhatsApp
      if (branch.phone) {
        const relayResult = await relayOrderToBranch(
          branch.phone,
          fromPhone,
          orderJson,
          total,
        );
        if (!relayResult.success) {
          console.error(`❌ Order relay failed: ${relayResult.error}`);
        }
      }

      // Clear session order state (keep branch_id for returning customers on global number)
      await db.updateSession(session.id, []);
      await db.clearPendingItem(session.id);
      await db.updateSessionContext(session.id, {});

      const confirmMessage = `تم تأكيد الأوردر ✅\n${orderDetails}الإجمالي: ${total} جنيه\nشكرًا لاختيارك! 🎉`;
      console.log(`✅ Order confirmed: ${total} EGP`);
      const response = generateTwiML(confirmMessage);
      return res.status(200).send(response);
    }

    // ─────────────────────────────────────────
    // 7. Default reply
    // ─────────────────────────────────────────
    console.log(`💬 Intent: ${aiResponse.intent} (default reply)`);
    const response = generateTwiML(aiResponse.reply);
    console.log(
      `📤 Sending TwiML response for intent "${aiResponse.intent}": ${response.substring(0, 100)}...`,
    );
    console.log(`📨 Full response: ${response}`);
    return res.status(200).send(response);
  } catch (err) {
    console.error("❌ Twilio handler error:", err.message);
    console.error("   Stack:", err.stack);
    const response = generateTwiML("حصلت مشكلة في المعالجة. حاول مرة أخرى.");
    console.log(`📤 Sending error response: ${response.substring(0, 100)}...`);
    return res.status(500).send(response);
  }
}

// ─────────────────────────────────────────
// BRANCH SELECTION HELPERS
// ─────────────────────────────────────────

function buildBranchSelectionMessage(branches, isRetry = false) {
  let msg = isRetry
    ? "مش فاهم الإختيار. جرب تاني:\n\n"
    : "أهلاً بيك في Layla! 👋\nمن أي فرع عايز تطلب؟\n\n";

  branches.forEach((b, i) => {
    const displayName = b.restaurant_name
      ? `${b.restaurant_name} — ${b.name}`
      : b.name;
    msg += `${i + 1}. ${displayName}\n`;
  });

  msg += "\nقوللي رقم أو اسم الفرع.";
  return msg;
}

function matchBranchSelection(message, options) {
  const normalized = normalizeArabic(message).trim();

  // Try matching by number first
  const num = parseInt(normalized, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1];
  }

  // Try fuzzy matching by name
  for (const branch of options) {
    const displayName = normalizeArabic(
      branch.restaurant_name
        ? `${branch.restaurant_name} ${branch.name}`
        : branch.name,
    );
    if (displayName.includes(normalized) || normalized.includes(displayName)) {
      return branch;
    }
  }

  return null;
}

// ─────────────────────────────────────────
// ITEM SELECTION HELPERS
// ─────────────────────────────────────────

function buildItemSelectionMessage(items, query, isRetry = false) {
  let msg = isRetry
    ? `مش فاهم إختيارك. عندنا أكتر من نوع "${query}":\n\n`
    : `عندنا أكتر من نوع "${query}". إختار واحد:\n\n`;

  items.forEach((item, i) => {
    msg += `${i + 1}. ${item.name} — ${item.price} جنيه\n`;
  });

  msg += "\nقوللي رقم أو اسم اللي عايزه.";
  return msg;
}

function matchItemSelection(message, options) {
  const normalized = normalizeArabic(message).trim();

  // Try matching by number first
  const num = parseInt(normalized, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1];
  }

  // Try exact/fuzzy match by name
  for (const item of options) {
    const itemName = normalizeArabic(item.name);
    if (
      itemName.includes(normalized) ||
      normalized.includes(itemName) ||
      similarity(normalized, itemName) > 0.6
    ) {
      return item;
    }
  }

  return null;
}

// Quick similarity helper for item selection
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ─────────────────────────────────────────
// TwiML GENERATOR
// ─────────────────────────────────────────
function generateTwiML(message) {
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
