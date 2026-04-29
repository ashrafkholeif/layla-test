# Layla v2 - Troubleshooting Guide

## 🚨 Critical: WhatsApp Messages Not Delivered

### Symptom

- Logs show response sent
- User doesn't receive WhatsApp message
- Twilio shows webhook was called

### Root Causes & Fixes

#### 1. Missing TwiML Content-Type Header

**Fix:**

```javascript
res.type("text/xml"); // MUST be set before res.send()
```

#### 2. Invalid TwiML Format

**Invalid:**

```xml
<Response>Message text</Response>  <!-- Wrong! -->
```

**Valid:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Message text</Message>
</Response>
```

#### 3. Response Not Returned

**Wrong:**

```javascript
res.send(twiml);
// Code continues... Twilio doesn't know response is done
```

**Right:**

```javascript
return res.send(twiml); // Must RETURN immediately
```

#### 4. Async/Await Not Awaited

**Check:** All `await` calls are properly awaited before sending response

```javascript
await db.updateSession(...);  // Must wait
return res.send(twiml);       // Then respond
```

#### 5. XML Special Characters Not Escaped

**Wrong:**

```xml
<Message>Price: 50 & quantity > 1</Message>
```

**Right:**

```xml
<Message>Price: 50 &amp; quantity &gt; 1</Message>
```

### Debug Steps

1. **Check Twilio Logs:**
   - Twilio Console → Messages → Log
   - Look for HTTP response code (should be 200)
   - Check response body

2. **Test with cURL:**

```bash
curl -X POST http://localhost:3000/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B201001234567&To=%2B20100999999&Body=test" \
  -v
```

Expected: XML response with 200 status

3. **Check Server Logs:**

```bash
npm start  # Look for errors
```

4. **Verify Webhook URL:**
   - Twilio Dashboard → WhatsApp → Sandbox Settings
   - Should be: `https://layla-v2.onrender.com/twilio`
   - Test endpoint: `https://layla-v2.onrender.com/twilio` (should return 400)

---

## 🔴 Database Connection Errors

### Symptom

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

### Fixes

**1. PostgreSQL Not Running**

```bash
# macOS with Homebrew
brew services start postgresql

# Or Docker
docker run -d -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
```

**2. Wrong Database URL**

```env
# Check format:
DATABASE_URL=postgresql://user:password@host:port/database

# For local:
DATABASE_URL=postgresql://postgres:password@localhost:5432/layla_v2

# For Render:
DATABASE_URL=postgresql://user:pass@host-name.render-postgresql.com/db
```

**3. Database Doesn't Exist**

```bash
createdb layla_v2

# Or via psql:
psql -U postgres -c "CREATE DATABASE layla_v2;"

# Then initialize schema:
psql -d layla_v2 -f schema.sql
```

**4. Schema Not Initialized**

```bash
psql -U postgres -d layla_v2 -f schema.sql
```

**5. SSL Certificate Error (Render)**

```javascript
// This is already handled in db.js:
ssl: {
  rejectUnauthorized: false;
}
```

### Test Connection

```bash
# Local
psql postgresql://postgres:password@localhost:5432/layla_v2

# Render
psql -U user -h host.render-postgresql.com -d database -W
```

---

## 🤖 OpenAI API Errors

### Symptom

```
Error: 401 Unauthorized
Error: 429 Too Many Requests
```

### Fixes

**1. Invalid API Key**

```bash
# Check .env file
echo $OPENAI_API_KEY

# Should start with: sk-
```

**2. Rate Limit Hit**

- Check OpenAI dashboard for usage
- Free tier has low limits
- Solution: Upgrade plan or implement backoff

**3. API Key Exposed**

```bash
# If exposed, regenerate immediately:
# OpenAI Console → API Keys → Regenerate
```

### Debug

```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## 🔧 JSON Parsing Errors

### Symptom

```
Failed to parse AI response: ...
```

### Causes

**1. AI Response Not Valid JSON**

- OpenAI returned invalid format
- Network interruption
- Token limit reached

**2. Menu Is Empty**

- Branch has no menu items
- Fix: Add menu items first

**3. Message Too Long**

- Input exceeds 500 characters
- Already handled by `sanitizeInput()`

### Debug

Add logging to `ai.js`:

```javascript
console.log("Raw AI response:", rawContent);
console.log("Parsed JSON:", parsed);
```

---

## 🌐 Twilio Webhook Issues

### Symptom

- Webhook not being called
- 404 errors
- Wrong phone number

### Fixes

**1. Webhook URL Not Set**

1. Twilio Console
2. WhatsApp → Settings
3. "When a message comes in": Set URL
4. Save

**2. URL Format Wrong**

```
✅ https://layla-v2.onrender.com/twilio
❌ https://layla-v2.onrender.com/api/twilio
❌ http://localhost:3000/twilio  (won't work from Twilio cloud)
```

**3. Server Not Responding**

```bash
curl -X POST https://layla-v2.onrender.com/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "test=1"
```

Should return 400 or similar, not timeout

**4. Phone Number Mismatch**

- `To` parameter must match your branch's phone
- Add phone to database:

```bash
psql layla_v2
SELECT * FROM branches WHERE phone = '+20100999999';
```

---

## 📊 Database Issues

### No Menu Items Found

**Symptom:** Responses say "menu unavailable"

**Fix:**

```bash
# Check if menu items exist
psql layla_v2
SELECT * FROM menu_items;

# If empty, add items:
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": 1,
    "items": [
      {"name": "برجر", "price": 50}
    ]
  }'
```

### Session Not Found

**Symptom:** "Session not found" errors

**Fix:**

- Sessions are created automatically
- If issue persists, check:

```bash
psql layla_v2
SELECT * FROM sessions WHERE user_phone = '+201001234567';
```

### Orders Not Saving

**Symptom:** Orders confirmed but don't appear

**Check:**

```bash
psql layla_v2
SELECT * FROM orders ORDER BY created_at DESC;
```

**If empty:**

- Confirm order intent not being recognized
- Check AI response parsing

---

## 🎯 Fuzzy Matching Issues

### Symptom

Menu items not found even though in menu

### Solution

Test fuzzy matching:

```javascript
// In ai.js test:
import { findMenuItemFuzzy } from "./utils.js";

const menu = [{ id: 1, name: "برجر" }];
console.log(findMenuItemFuzzy(menu, "برغر")); // Should find it
```

### Common Issues

- Arabic character variations
- Typos
- Different spelling variations

Already handled by:

- `normalizeArabic()`
- Levenshtein distance (fuzzy matching)
- Synonyms

---

## 🚀 Deployment Issues

### 502 Bad Gateway (Render)

**Causes:**

1. Server crashed
2. Process exited
3. Out of memory

**Fix:**

```bash
# Check logs on Render dashboard
# Restart service
```

### Build Failed

**Check build logs:**

```bash
# npm install failing?
npm install --verbose

# Make sure package.json has all deps
npm list
```

### Environment Variables Not Set

**Fix on Render:**

1. Service → Environment
2. Add all variables from .env
3. Redeploy

---

## 🧪 Testing Checklist

### Before Going Live

- [ ] Twilio webhook responds with correct TwiML
- [ ] Database connection works
- [ ] OpenAI API responds
- [ ] Full user flow works:
  - [ ] Signup
  - [ ] Create branch
  - [ ] Upload menu
  - [ ] Activate
  - [ ] Receive WhatsApp message
  - [ ] Response sent to user

### Test Commands

```bash
# 1. Server starts
npm start

# 2. Database accessible
psql $DATABASE_URL -c "SELECT version();"

# 3. Signup
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+201001234567"}'

# 4. Branch
curl -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":1,"name":"Main","phone":"+20100999999"}'

# 5. Menu
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -d '{"branchId":1,"items":[{"name":"برجر","price":50}]}'

# 6. Activate
curl -X POST http://localhost:3000/api/activate \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":1}'

# 7. Twilio
curl -X POST http://localhost:3000/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B201001234567&To=%2B20100999999&Body=برجر"
```

---

## 📞 Getting Help

1. Check this guide
2. Check `/server.js` logs
3. Check Twilio webhook logs
4. Check PostgreSQL logs
5. Check `.env` file is correct
6. Test with cURL first

---

## 🔍 Debug Mode

Enable verbose logging:

**Option 1: Add console.logs**

```javascript
console.log("DEBUG:", variableName);
```

**Option 2: Use NODE_DEBUG**

```bash
NODE_DEBUG=* npm start  # Very verbose
```

**Option 3: Use a debugger**

```bash
node --inspect server.js
# Then open chrome://inspect
```
