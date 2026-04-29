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
} from "./routes/menu.js";
import {
  handleActivateRestaurant,
  handleGetRestaurant,
} from "./routes/activate.js";

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
app.get("/api/menu/:branchId", handleGetMenu);
app.post("/api/menu/item", handleAddMenuItem);

// Activation
app.post("/api/activate", handleActivateRestaurant);
app.get("/api/restaurant/:restaurantId", handleGetRestaurant);

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
  console.log(`
╔════════════════════════════════════════╗
║  🍽️  Layla Backend v2.0 🍽️             ║
║  Running on http://localhost:${PORT}    ║
║  Database: ${process.env.DATABASE_URL ? "✅ Connected" : "❌ Not set"}        ║
║  OpenAI: ${process.env.OPENAI_API_KEY ? "✅ Configured" : "❌ Not set"}         ║
║  Twilio: ${process.env.TWILIO_ACCOUNT_SID ? "✅ Configured" : "❌ Not set"}        ║
╚════════════════════════════════════════╝
  `);
});
