# Layla v2 - Setup & Deployment Guide

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Twilio account with WhatsApp API enabled
- OpenAI API key
- Render account (for hosting)

---

## 🚀 Local Development Setup

### 1. Install Dependencies

```bash
cd /Users/ashrafkholeif/Projects/layla-v2
npm install
```

### 2. Database Setup

#### Create PostgreSQL Database

```bash
# On your local machine or cloud provider
createdb layla_v2

# Or via psql:
psql -U postgres
CREATE DATABASE layla_v2;
```

#### Initialize Schema

```bash
psql -U postgres -d layla_v2 -f schema.sql
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/layla_v2

# OpenAI
OPENAI_API_KEY=sk-...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+1...

# Server
PORT=3000
NODE_ENV=development
```

### 4. Start Development Server

```bash
npm start
```

Server will be running at `http://localhost:3000`

---

## 🌐 Deployment to Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Layla v2 - Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/layla-v2.git
git push -u origin main
```

### 2. Create Render PostgreSQL Database

1. Go to [render.com](https://render.com)
2. New → PostgreSQL
3. Choose PostgreSQL 15
4. Copy the **external database URL**

### 3. Initialize Schema on Render

```bash
# Temporarily update .env to use Render database URL
psql "postgresql://user:pass@host:5432/db" -f schema.sql
```

### 4. Deploy Node.js Service

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repository
4. Configuration:
   - Name: `layla-v2`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free/Starter

5. Add Environment Variables:
   - `DATABASE_URL`: (from PostgreSQL service)
   - `OPENAI_API_KEY`: (from OpenAI)
   - `TWILIO_ACCOUNT_SID`: (from Twilio)
   - `TWILIO_AUTH_TOKEN`: (from Twilio)
   - `TWILIO_WHATSAPP_FROM`: (from Twilio)
   - `NODE_ENV`: `production`

6. Deploy

### 5. Get Render URL

After deployment:

```
https://layla-v2.onrender.com
```

---

## 🔧 Twilio Configuration

### 1. Set Webhook URL

1. Go to Twilio Console
2. WhatsApp → Settings → Sandbox
3. When a message comes in: `https://layla-v2.onrender.com/twilio`
4. Save

### 2. Test Webhook

```bash
curl -X POST http://localhost:3000/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+201001234567&To=+1234567890&Body=Hello"
```

---

## 📱 Testing WhatsApp Flow

### 1. Signup

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "الشرقاوي",
    "phone": "+201001234567"
  }'
```

Response:

```json
{
  "success": true,
  "restaurantId": 1,
  "name": "الشرقاوي",
  "phone": "+201001234567"
}
```

### 2. Create Branch

```bash
curl -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": 1,
    "name": "الفرع الرئيسي",
    "phone": "+1234567890"
  }'
```

### 3. Upload Menu

```bash
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": 1,
    "items": [
      { "name": "برجر", "price": 50 },
      { "name": "فرايز", "price": 20 },
      { "name": "عصير", "price": 15 }
    ]
  }'
```

### 4. Activate Restaurant

```bash
curl -X POST http://localhost:3000/api/activate \
  -H "Content-Type: application/json" \
  -d '{ "restaurantId": 1 }'
```

### 5. Test Twilio Webhook

```bash
curl -X POST http://localhost:3000/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B201001234567&To=%2B1234567890&Body=عايز برجر"
```

Expected Response (TwiML):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>تمام، واحد برجر. حاجة تانية؟</Message>
</Response>
```

---

## 🐛 Troubleshooting

### Issue: WhatsApp Messages Not Received

**Symptoms**: Messages sent to WhatsApp but no reply

**Fixes**:

1. Check Twilio logs: Twilio Console → WhatsApp → Logs
2. Verify webhook URL is correct
3. Ensure response has correct TwiML format
4. Check `res.type("text/xml")` is set before sending response

### Issue: Database Connection Error

```
Error: connect ECONNREFUSED
```

**Fixes**:

1. Verify DATABASE_URL is correct
2. Check PostgreSQL is running
3. Test connection: `psql $DATABASE_URL`
4. For Render: ensure IP whitelist allows all

### Issue: OpenAI Rate Limit

```
Error: 429 Too Many Requests
```

**Fixes**:

1. Check API key is valid
2. Verify rate limit isn't exceeded
3. Add exponential backoff in production

### Issue: JSON Parsing Error

```
Failed to parse AI response
```

**Fixes**:

1. Check OpenAI response format
2. Verify menu is non-empty
3. Check message isn't too long (max 500 chars)

---

## 📊 Database Schema

### restaurants

```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(255) NOT NULL
owner_phone     VARCHAR(20) NOT NULL UNIQUE
is_active       BOOLEAN DEFAULT false
created_at      TIMESTAMP
```

### branches

```sql
id              SERIAL PRIMARY KEY
restaurant_id   INTEGER REFERENCES restaurants(id)
name            VARCHAR(255) NOT NULL
phone           VARCHAR(20) NOT NULL
twilio_number   VARCHAR(20)
is_active       BOOLEAN DEFAULT false
created_at      TIMESTAMP
```

### menu_items

```sql
id              SERIAL PRIMARY KEY
branch_id       INTEGER REFERENCES branches(id)
name            VARCHAR(255) NOT NULL
price           DECIMAL(10, 2) NOT NULL
description     TEXT
is_available    BOOLEAN DEFAULT true
created_at      TIMESTAMP
```

### sessions

```sql
id              SERIAL PRIMARY KEY
branch_id       INTEGER REFERENCES branches(id)
user_phone      VARCHAR(20) NOT NULL
order_json      JSONB DEFAULT '[]'
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### orders

```sql
id              SERIAL PRIMARY KEY
branch_id       INTEGER REFERENCES branches(id)
user_phone      VARCHAR(20) NOT NULL
items_json      JSONB NOT NULL
total           DECIMAL(10, 2) NOT NULL
status          VARCHAR(50) DEFAULT 'pending'
created_at      TIMESTAMP
```

---

## 🔐 Security Best Practices (Future)

- [ ] Add authentication (JWT tokens)
- [ ] Rate limiting on APIs
- [ ] Input validation (already done)
- [ ] CORS configuration
- [ ] HTTPS enforcement
- [ ] Database encryption
- [ ] Audit logging
- [ ] API key rotation

---

## 📝 Environment Variables Reference

| Variable               | Example            | Required                  |
| ---------------------- | ------------------ | ------------------------- |
| `DATABASE_URL`         | `postgresql://...` | Yes                       |
| `OPENAI_API_KEY`       | `sk-...`           | Yes                       |
| `TWILIO_ACCOUNT_SID`   | `AC...`            | Yes                       |
| `TWILIO_AUTH_TOKEN`    | `auth...`          | Yes                       |
| `TWILIO_WHATSAPP_FROM` | `+1234567890`      | Yes                       |
| `PORT`                 | `3000`             | No (default)              |
| `NODE_ENV`             | `production`       | No (default: development) |

---

## 🎯 Next Steps

1. ✅ Fix Twilio response issue
2. ✅ Refactor backend
3. ✅ Build onboarding portal
4. [ ] Add multi-language support (Currently: AR, EN)
5. [ ] Order management dashboard
6. [ ] Analytics
7. [ ] Restaurant notifications (Email, SMS)
8. [ ] Payment integration
9. [ ] Customer ratings

---

## 📞 Support

For issues:

1. Check logs: `npm start` (development)
2. Check Twilio logs
3. Verify environment variables
4. Test with curl commands above
