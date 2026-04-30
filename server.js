import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import { handleTwilioWebhook } from "./routes/twilio.js";
import { handleSignup } from "./routes/signup.js";
import {
  handleCreateBranch,
  handleGetBranches,
  handleGetBranchById,
} from "./routes/branches.js";
import {
  handleUploadMenu,
  handleGetMenu,
  handleAddMenuItem,
  handleUploadMenuFile,
} from "./routes/menu.js";
import {
  handleActivateRestaurant,
  handleGetRestaurant,
} from "./routes/activate.js";
import { handleGetMenuTemplate } from "./routes/template.js";
import { handleDebugBranches } from "./routes/debug.js";
import { handleTestChat } from "./routes/test-chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Logging middleware
app.use((req, res, next) => {
  console.log(`\n${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// ------------------
// 📝 AUTHENTICATION MIDDLEWARE (simple)
// For now, no auth needed - but add this later if required
// ------------------

// ------------------
// 🎯 API ROUTES
// ------------------

// Signup (no auth needed)
app.post("/api/signup", handleSignup);

// Branches
app.post("/api/branches", handleCreateBranch);
app.get("/api/branches/:restaurantId", handleGetBranches);
app.get("/api/branch/:branchId", handleGetBranchById);

// Menu
app.post("/api/menu", handleUploadMenu);
app.post("/api/menu/upload-file", handleUploadMenuFile);
app.get("/api/menu/:branchId", handleGetMenu);
app.post("/api/menu/item", handleAddMenuItem);
app.get("/api/menu-template", handleGetMenuTemplate);

// Activation
app.post("/api/activate", handleActivateRestaurant);
app.get("/api/restaurant/:restaurantId", handleGetRestaurant);

// Debug endpoint
app.get("/api/debug/branches", handleDebugBranches);

// Test chat endpoint (for testing without Twilio limits)
app.post("/api/test-chat", handleTestChat);

// ------------------
// 🤖 TWILIO WEBHOOK (CRITICAL)
// ------------------
app.post("/twilio", handleTwilioWebhook);

// ------------------
// 🌍 WEB PORTAL
// ------------------

// Serve portal pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/branch-setup", (req, res) => {
  res.sendFile(path.join(__dirname, "public/branch-setup.html"));
});

app.get("/menu-upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public/menu-upload.html"));
});

app.get("/activation", (req, res) => {
  res.sendFile(path.join(__dirname, "public/activation.html"));
});

// ------------------
// ❌ ERROR HANDLING
// ------------------

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
  });
});

// ------------------
// 🚀 START SERVER
// ------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  const mode = process.env.LAYLA_INBOUND_NUMBER
    ? "🌍 GLOBAL NUMBER"
    : "📞 BRANCH-SPECIFIC";
  console.log(`
╔════════════════════════════════════════╗
║  🍽️  Layla Backend v2.0 🍽️             ║
║  Running on http://localhost:${PORT}    ║
║  Mode: ${mode.padEnd(28)}║
║  Database: ${process.env.DATABASE_URL ? "✅ Connected" : "❌ Not set"}        ║
║  OpenAI: ${process.env.OPENAI_API_KEY ? "✅ Configured" : "❌ Not set"}         ║
║  Twilio Inbound: ${process.env.LAYLA_INBOUND_NUMBER ? "✅ " + process.env.LAYLA_INBOUND_NUMBER : "❌ Not set"}  ║
║  Twilio Outbound: ${process.env.TWILIO_WHATSAPP_FROM ? "✅ " + process.env.TWILIO_WHATSAPP_FROM : "❌ Not set"}  ║
╚════════════════════════════════════════╝
  `);
});
