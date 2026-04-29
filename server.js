import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
import { processMessage } from "./ai.js";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ------------------
// 🔤 Arabic Normalization
// ------------------
function normalizeArabic(text) {
  return text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}

// ------------------
// 🔍 Smart Matching
// ------------------
function findMenuItem(menu, input) {
  const normalizedInput = normalizeArabic(input);

  return menu.find((item) => {
    const normalizedName = normalizeArabic(item.name);
    return (
      normalizedName.includes(normalizedInput) ||
      normalizedInput.includes(normalizedName)
    );
  });
}

// ------------------
// 🧠 Session
// ------------------
async function getSession(phone) {
  const res = await pool.query("SELECT * FROM sessions WHERE phone=$1", [
    phone,
  ]);

  if (res.rows.length > 0) return res.rows[0];

  const newSession = await pool.query(
    "INSERT INTO sessions (phone, order_json) VALUES ($1,$2) RETURNING *",
    [phone, JSON.stringify([])],
  );

  return newSession.rows[0];
}

// ------------------
// 📲 MAIN ROUTE
// ------------------
app.post("/twilio", async (req, res) => {
  const message = req.body.Body;
  const phone = req.body.From;

  const session = await getSession(phone);

  const menuRes = await pool.query(
    "SELECT * FROM menu_items WHERE restaurant_id = 1",
  );

  const menu = menuRes.rows;

  const ai = await processMessage(message, session, menu);

  console.log("USER:", message);
  console.log("AI:", ai);

  let order = session.order_json || [];

  // ------------------
  // 🛒 ADD ITEM
  // ------------------
  if (ai.intent === "place_order" && ai.item) {
    const item = findMenuItem(menu, ai.item);

    if (!item) {
      return res.send(`
        <Response>
          <Message>الحاجة دي مش موجودة في المنيو 😅</Message>
        </Response>
      `);
    }

    order.push({
      item: item.name,
      qty: ai.quantity || 1,
    });

    await pool.query("UPDATE sessions SET order_json=$1 WHERE id=$2", [
      JSON.stringify(order),
      session.id,
    ]);
  }

  // ------------------
  // ✅ CONFIRM ORDER
  // ------------------
  if (ai.intent === "confirm_order") {
    let total = 0;

    for (let o of order) {
      const item = findMenuItem(menu, o.item);
      if (item) {
        total += item.price * o.qty;
      }
    }

    await pool.query(
      "INSERT INTO orders (restaurant_id, phone, total) VALUES (1,$1,$2)",
      [phone, total],
    );

    await pool.query("UPDATE sessions SET order_json=$1 WHERE id=$2", [
      JSON.stringify([]),
      session.id,
    ]);

    return res.send(`
      <Response>
        <Message>تم تأكيد الأوردر ✅ الإجمالي ${total} جنيه</Message>
      </Response>
    `);
  }

  // ------------------
  // 💬 DEFAULT REPLY
  // ------------------
  res.send(`
    <Response>
      <Message>${ai.reply}</Message>
    </Response>
  `);
});

app.listen(3000, () => console.log("Running..."));
