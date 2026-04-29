# Layla — Self-Serve SaaS Production Roadmap

> **Current State:** MVP with working AI ordering, item confirmation, single inbound Twilio number, branch selection, and live order relay to restaurant WhatsApp.
>
> **Goal:** Production-ready multi-tenant SaaS where any restaurant can self-onboard, configure their menu, and start receiving orders with zero manual intervention.

---

## ✅ Just Shipped (This Sprint)

| Feature | Status | Notes |
|---------|--------|-------|
| **Item-level confirmation** | ✅ Done | Every item requires explicit yes/no before adding to cart |
| **Burger / ambiguous type selection** | ✅ Done | If user says "burger" and menu has 3 burgers, bot lists options and asks which one |
| **Single Twilio inbound number** | ✅ Done | One number for all customers; branch selection flow handles routing |
| **Live order relay to branch WhatsApp** | ✅ Done | After customer confirms order, Twilio sends formatted receipt to branch.phone |
| **Session context (`context` JSONB)** | ✅ Done | Supports selection modes without schema migrations |
| **Global session support** | ✅ Done | `branch_id` nullable; partial unique index ensures one global session per user |

---

## 🚀 Phase 1: Hardening MVP (Next 1–2 Weeks)

### 1.1 Auth & Access Control
**Why:** Currently zero auth. Anyone can hit `/api/branches`, upload menus, activate restaurants.

- [ ] **Simple PIN-based auth for restaurant owners**
  - On signup, generate a 6-digit PIN sent via SMS to `owner_phone`
  - Store hashed PIN in `restaurants` table
  - Require PIN header (`X-Restaurant-PIN`) for all portal API calls
  - Session cookie for web portal
- [ ] **Branch ownership verification**
  - When creating a branch, send a verification code to `branch.phone`
  - Branch cannot be activated until verified
- [ ] **Webhook signature validation**
  - Validate Twilio request signatures (`X-Twilio-Signature`) using Twilio's helper

### 1.2 Order Lifecycle & Status Management
**Why:** Orders are created with `status = 'pending'` but never updated. Restaurants can't mark orders received/ready/delivered.

- [ ] Add `orders` REST API for restaurants:
  - `GET /api/orders/:branchId` — list orders (last 24h default)
  - `PATCH /api/orders/:orderId/status` — update status (`pending` → `confirmed` → `ready` → `delivered` / `cancelled`)
- [ ] Auto-assign order number (human-friendly, e.g., `L-1001`)
  - Add `order_number` column to orders table
- [ ] Notify customer on status changes via WhatsApp
  - "Your order #L-1001 is being prepared 🍳"
  - "Your order #L-1001 is ready for pickup! 🎉"

### 1.3 Data Integrity & Edge Cases
- [ ] **Order timeout / abandonment**
  - If session inactive for >30 min, clear cart and notify user
  - Cron job or lazy cleanup on next message
- [ ] **Duplicate order prevention**
  - Hash of (customer_phone + items + total + 5-min window) to prevent double-submit
- [ ] **Rate limiting**
  - Express-rate-limit on Twilio webhook (prevent spam/abuse)
  - Per-customer message throttling
- [ ] **Input sanitization hardening**
  - Max message length enforcement (already 500 chars in `sanitizeInput`)
  - Escape special chars in TwiML more aggressively

---

## 🏗️ Phase 2: SaaS Infrastructure (Weeks 3–4)

### 2.1 Multi-Tenant Isolation & Onboarding
**Why:** True self-serve means a new restaurant can sign up and go live without us touching code or DB.

- [ ] **Self-serve signup flow**
  - Landing page (`/signup`) with restaurant name, owner phone
  - Auto-verify owner phone via OTP
  - Auto-create restaurant record
- [ ] **Branch wizard**
  - Add multiple branches, each verified by SMS
  - Each branch gets a QR code + short link for customers
- [ ] **Menu management dashboard**
  - Edit / delete / disable items after upload
  - Categories (Burgers, Drinks, etc.) for better AI context
  - Item photos (URL-based for now)
- [ ] **Subscription / Plan model** (schema only for now)
  - `plans` table: free tier (N orders/mo), pro tier (unlimited)
  - `restaurants.plan_id`, `restaurants.plan_expires_at`
  - Soft limit enforcement (warn when approaching limit)

### 2.2 Better Branch Discovery (Global Number)
**Current:** Lists all active branches. Doesn't scale past 10–15 restaurants.

- [ ] **Location-based discovery** (future)
  - Ask customer for area/neighborhood
  - Match to branches with location data
- [ ] **Restaurant short codes**
  - Each restaurant gets a unique 4–6 character code (e.g., `KFC-M`, `MCD-Z`)
  - Customer texts: `"Order from KFC-M"` → skip selection
  - Store `restaurants.short_code` (unique, indexed)
- [ ] **Recent / favorite branches**
  - Store last 3 branches per customer in a new `customer_preferences` table
  - Offer quick reorder: "Last time you ordered from KFC Maadi. Same branch?"

### 2.3 Admin Dashboard (for Layla operators)
- [ ] **System health page**
  - Active restaurants, orders today, failed relays, AI errors
- [ ] **Restaurant management**
  - Approve / suspend restaurants
  - View logs per restaurant
- [ ] **Revenue tracking** (simple)
  - Order count per restaurant, GMV estimates

---

## 🔐 Phase 3: Security & Compliance (Week 5–6)

### 3.1 Authentication Overhaul
- [ ] **JWT-based auth** replacing PIN
  - `POST /api/auth/login` → SMS OTP → JWT token
  - Refresh token rotation
  - Token expiry: 24h
- [ ] **Role-based access control**
  - Roles: `owner`, `manager`, `staff`, `admin` (Layla team)
  - Middleware: `requireRole('owner')`

### 3.2 Data Privacy
- [ ] **GDPR / local privacy compliance**
  - Right to deletion: wipe customer data on request
  - Data retention policy (auto-delete sessions after 30 days)
  - Encrypt sensitive fields at rest (owner_phone, branch.phone)
- [ ] **Audit logging**
  - `audit_logs` table: who changed what and when
  - Log all order status transitions

### 3.3 Webhook & API Security
- [ ] **Twilio signature validation** (production must-have)
  - Reject webhook requests without valid Twilio signature
- [ ] **API key for external integrations**
  - If restaurants want to pull orders into their POS

---

## ⚡ Phase 4: Performance & Scale (Week 7–8)

### 4.1 Database Optimization
- [ ] **Connection pooling tuning**
  - Current: default pg pool. Set `max: 20`, `idleTimeoutMillis: 30000`
- [ ] **Query optimization**
  - Add composite index on `orders(branch_id, created_at)`
  - Partition `orders` by month if volume >100K/month
- [ ] **Caching layer**
  - Redis for: active menus, branch lookups, session state
  - Eliminates repeated DB hits per WhatsApp message

### 4.2 AI Cost & Latency
- [ ] **Intent caching**
  - Cache common messages ("menu", "confirm", "yes") → skip OpenAI call
  - 80/20 rule: 80% of messages are repetitive
- [ ] **Faster model fallback**
  - Try local fuzzy matching first for obvious cases
  - Only call OpenAI for ambiguous / complex messages
- [ ] **Token usage monitoring**
  - Track per-restaurant AI spend
  - Alert if a single restaurant is abusing / looping

### 4.3 Async Processing
- [ ] **Message queue for outbound relay**
  - If Twilio API is slow/down, queue order relays
  - Retry with exponential backoff
  - Use Bull + Redis or AWS SQS
- [ ] **Background jobs**
  - Session cleanup
  - Daily summary reports to restaurants
  - Failed order retry

---

## 💰 Phase 5: Monetization & Business Features (Month 3)

### 5.1 Billing & Subscriptions
- [ ] **Stripe integration**
  - Monthly subscription: $29/mo basic, $79/mo pro
  - Per-order fee: $0.10/order on free tier
- [ ] **Invoice generation**
  - Monthly PDF invoice per restaurant

### 5.2 Advanced Ordering
- [ ] **Scheduled orders**
  - "Order for 7 PM tonight"
  - Store `scheduled_for` datetime, queue for dispatch
- [ ] **Order modifications**
  - Customer can edit/cancel within 5 minutes
  - "Remove the fries, add a drink"
- [ ] **Special instructions**
  - "No onions", "extra spicy"
  - AI extracts `notes` field, relayed to branch

### 5.3 Analytics for Restaurants
- [ ] **Daily / weekly summary**
  - Orders, revenue, top items, peak hours
  - Sent via WhatsApp every morning
- [ ] **Customer insights**
  - Repeat customer rate
  - Average order value

---

## 🧪 Immediate Testing Checklist

Before calling Phase 1 complete, run through:

- [ ] Customer texts global number → sees branch list → picks branch → orders burger → sees ambiguous options → picks type → confirms → order relayed to branch WhatsApp
- [ ] Customer texts branch-specific number → skips branch selection → normal flow works
- [ ] Restaurant receives order on their personal WhatsApp
- [ ] Branch without menu → graceful error
- [ ] Customer says "yes" to pending item → item added
- [ ] Customer says "no" to pending item → item rejected
- [ ] Customer says "confirm" with empty cart → graceful message
- [ ] Twilio credentials missing → server starts but warns
- [ ] Duplicate global session → prevented by unique partial index

---

## 📋 Tech Debt to Address

| Issue | Priority | Fix |
|-------|----------|-----|
| `twilio_number` = `phone` at branch creation | Medium | Separate columns; `phone` = branch WhatsApp, `twilio_number` = optional dedicated inbound |
| No tests | High | Add Jest + Supertest for API routes, Twilio webhook, AI parsing |
| No TypeScript | Medium | Gradual migration; start with `.d.ts` files |
| No CI/CD | High | GitHub Actions: lint → test → deploy to Render |
| No structured logging | Medium | Replace `console.log` with Pino or Winston; add correlation IDs |
| Hardcoded Arabic | Low | Full i18n framework (English primary for SaaS) |

---

## 🎯 Definition of "Production Ready"

- [ ] Zero-downtime deploys (Render + health checks)
- [ ] Automated backups (PostgreSQL daily)
- [ ] Monitoring & alerting (UptimeRobot + Log alerting)
- [ ] Incident runbook (Twilio down, OpenAI down, DB down)
- [ ] Self-serve onboarding: restaurant signs up, adds branch, uploads menu, activates → live in <10 minutes
- [ ] Support channel: WhatsApp or email for restaurant owners
- [ ] Pricing page and billing collection

---

*Last updated: 2026-04-30*
