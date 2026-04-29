import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
import { processMessage } from "./ai.js";
import twilio from "twilio";

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

// --- Helper: get or create session ---
async function getSession(phone) {
  const res = await pool.query("SELECT * FROM sessions WHERE phone=$1", [
    phone,
  ]);

  if (res.rows.length > 0) return res.rows[0];

  const newSession = await pool.query(
    "INSERT INTO sessions (phone, order_json) VALUES ($1, $2) RETURNING *",
    [phone, JSON.stringify([])],
  );

  return newSession.rows[0];
}

// --- MAIN ROUTE ---
app.post("/twilio", async (req, res) => {
  const message = req.body.Body;
  const phone = req.body.From;

  const session = await getSession(phone);

  const menuRes = await pool.query(
    "SELECT * FROM menu_items WHERE restaurant_id = 1",
  );

  const ai = await processMessage(message, session, menuRes.rows);

  // update session
  let order = session.order_json || [];

  if (ai.intent === "place_order") {
    order.push({ item: ai.item, qty: ai.quantity || 1 });

    await pool.query("UPDATE sessions SET order_json=$1 WHERE id=$2", [
      JSON.stringify(order),
      session.id,
    ]);
  }

  // confirm order
  if (ai.intent === "confirm_order") {
    let total = 0;

    for (let o of order) {
      const item = menuRes.rows.find((i) => i.name === o.item);
      total += item.price * o.qty;
    }

    await pool.query(
      "INSERT INTO orders (restaurant_id, phone, total) VALUES (1,$1,$2)",
      [phone, total],
    );

    await pool.query("UPDATE sessions SET order_json=$1 WHERE id=$2", [
      JSON.stringify([]),
      session.id,
    ]);
  }

  res.send(`<Response><Message>${ai.reply}</Message></Response>`);
});

app.listen(3000, () => console.log("Running..."));
