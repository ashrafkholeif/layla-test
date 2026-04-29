import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

let client = null;

function getClient() {
  if (!client) {
    if (!accountSid || !authToken) {
      throw new Error(
        "Twilio credentials missing. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      );
    }
    client = twilio(accountSid, authToken);
  }
  return client;
}

/**
 * Send a WhatsApp message via Twilio
 * @param {string} to - Recipient phone number (e.g. +201234567890)
 * @param {string} body - Message body
 * @returns {Promise<object>} Twilio message object
 */
export async function sendWhatsAppMessage(to, body) {
  try {
    if (!fromNumber) {
      throw new Error("TWILIO_WHATSAPP_FROM is not set");
    }

    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const formattedFrom = fromNumber.startsWith("whatsapp:")
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    const message = await getClient().messages.create({
      from: formattedFrom,
      to: formattedTo,
      body: body,
    });

    console.log(`📤 WhatsApp sent → ${to} | SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send an order relay to the restaurant branch
 * @param {string} branchPhone - Branch WhatsApp number
 * @param {string} customerPhone - Customer phone for reference
 * @param {Array} items - Order items
 * @param {number} total - Order total
 * @returns {Promise<object>} Result object
 */
export async function relayOrderToBranch(branchPhone, customerPhone, items, total) {
  let orderDetails = "📦 طلب جديد\n";
  orderDetails += `👤 العميل: ${customerPhone}\n`;
  orderDetails += `━━━━━━━━━━━━\n`;

  for (const item of items) {
    const lineTotal = item.price * item.qty;
    orderDetails += `• ${item.item || item.name} × ${item.qty} = ${lineTotal} جنيه\n`;
  }

  orderDetails += `━━━━━━━━━━━━\n`;
  orderDetails += `💰 الإجمالي: ${total} جنيه\n`;
  orderDetails += `📌 الحالة: قيد الانتظار`;

  return sendWhatsAppMessage(branchPhone, orderDetails);
}
