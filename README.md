# 🍽️ Layla v2 - AI WhatsApp Ordering System

A production-ready Node.js backend for restaurants to receive orders via WhatsApp using AI-powered conversations. Multi-restaurant, multi-branch support with an easy onboarding portal.

## 🎯 Quick Start (5 minutes)

```bash
# 1. Clone & Install
git clone <repo>
cd layla-v2
npm install

# 2. Create .env (copy from .env.example)
cp .env.example .env
# Edit .env with your keys

# 3. Initialize Database
psql -U postgres -d layla_v2 -f schema.sql

# 4. Start Server
npm start

# 5. Open Browser
open http://localhost:3000
```

## ✨ Features

### 🚀 Core Features

- ✅ Multi-restaurant, multi-branch support
- ✅ Self-serve onboarding (signup → branches → menu → activate)
- ✅ WhatsApp AI ordering via Twilio
- ✅ Real-time order management
- ✅ Arabic language support (Egyptian Arabic)
- ✅ Fuzzy matching for menu items
- ✅ Auto-saving customer sessions

### 🛠️ Built-In Capabilities

- Smart menu item matching (handles typos & synonyms)
- Arabic text normalization
- Automatic session management
- Order calculation & confirmation
- JSON-based order storage
- Comprehensive error handling

### 📱 User Experience

- Web portal: Signup → Branch setup → Menu upload → Activation
- WhatsApp: Customers chat naturally to order
- Mobile-first, responsive design
- Instant delivery to restaurants

## 🏗️ Architecture

### Multi-Tenant Schema

```
Restaurants (1) ──→ Branches (N) ──→ Menu Items (N)
                        ↓
                   Sessions (N) + Orders (N)
```

### API Routes

```
POST   /api/signup              # Register restaurant
POST   /api/branches            # Add branch
GET    /api/branches/:id        # List branches
POST   /api/menu                # Upload menu (bulk)
GET    /api/menu/:branchId      # Get menu
POST   /api/activate            # Go live
GET    /api/restaurant/:id      # Get status

POST   /twilio                  # WhatsApp webhook (critical)
```

### Frontend

```
/                   # Signup page
/branch-setup       # Add branches
/menu-upload        # Upload items
/activation         # Final setup
```

## 🔧 Technology Stack

| Layer     | Technology               |
| --------- | ------------------------ |
| Runtime   | Node.js 18+ (ES modules) |
| Framework | Express.js               |
| Database  | PostgreSQL + pg          |
| AI        | OpenAI (gpt-4o-mini)     |
| Messaging | Twilio WhatsApp API      |
| Hosting   | Render                   |
| Frontend  | HTML/CSS/Vanilla JS      |

## 📦 Project Structure

```
layla-v2/
├── public/                  # Frontend portal
│   ├── index.html          # Signup page
│   ├── branch-setup.html   # Branch management
│   ├── menu-upload.html    # Menu upload
│   ├── activation.html     # Final activation
│   └── styles.css          # Unified styling
├── routes/                 # API endpoint handlers
│   ├── twilio.js          # WhatsApp webhook (CRITICAL FIX)
│   ├── signup.js          # Restaurant registration
│   ├── branches.js        # Branch management
│   ├── menu.js            # Menu operations
│   └── activate.js        # Restaurant activation
├── server.js              # Main server + routing
├── db.js                  # Database queries (all models)
├── ai.js                  # OpenAI integration
├── utils.js               # Arabic handling, fuzzy matching
├── schema.sql             # Database schema
├── .env.example           # Environment template
├── package.json           # Dependencies
├── SETUP.md              # Deployment guide
├── API.md                # API documentation
└── TROUBLESHOOTING.md    # Debug guide
```

## 🔧 Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- OpenAI API key
- Twilio account (WhatsApp API enabled)

### Local Development

1. **Clone & Install**

```bash
npm install
```

2. **Database Setup**

```bash
# Create database
createdb layla_v2

# Initialize schema
psql -d layla_v2 -f schema.sql
```

3. **Environment Variables**

```bash
cp .env.example .env
# Edit .env with:
# - DATABASE_URL
# - OPENAI_API_KEY
# - TWILIO_ACCOUNT_SID
# - TWILIO_AUTH_TOKEN
# - TWILIO_WHATSAPP_FROM
```

4. **Start Server**

```bash
npm start
# Server runs on http://localhost:3000
```

### Production (Render)

See `SETUP.md` for detailed deployment instructions.

## 🧪 Testing

### Quick Test

```bash
# Signup
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"البرجر ماما","phone":"+201001234567"}'

# Create branch
curl -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":1,"name":"الفرع الرئيسي","phone":"+20100999999"}'

# Upload menu
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -d '{
    "branchId":1,
    "items":[
      {"name":"برجر","price":50},
      {"name":"فرايز","price":20}
    ]
  }'

# Activate
curl -X POST http://localhost:3000/api/activate \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":1}'

# Test Twilio
curl -X POST http://localhost:3000/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B201001234567&To=%2B20100999999&Body=عايز برجر"
```

See `API.md` for complete API reference and `TROUBLESHOOTING.md` for debugging.

## 🔴 Critical Bug Fixed

### Issue: WhatsApp Messages Not Delivered

**Status:** ✅ FIXED

**Root Cause:**

- Missing `res.type("text/xml")` header
- Invalid TwiML format
- Async response handling

**Solution:**

- ✅ Set proper content-type header
- ✅ Generate valid TwiML with XML declaration
- ✅ Escape XML special characters
- ✅ Await all async operations before response
- ✅ Return response immediately (no code after `res.send()`)

See `routes/twilio.js` for implementation.

## 📈 How It Works

### 1. Restaurant Setup (Portal)

```
User visits http://localhost:3000
     ↓
Sign up (name + phone)
     ↓
Add branches (WhatsApp number per branch)
     ↓
Upload menu (items + prices)
     ↓
Activate restaurant
```

### 2. Customer Orders (WhatsApp)

```
Customer sends: "عايز برجر"
     ↓
Twilio → POST /twilio webhook
     ↓
Identify branch (by phone)
     ↓
Get customer session
     ↓
OpenAI processes: "place_order, item=برجر, qty=1"
     ↓
Match "برجر" to menu (fuzzy matching + Arabic normalization)
     ↓
Add to order, return: "تمام، واحد برجر. حاجة تانية؟"
     ↓
Customer replies: "تأكيد"
     ↓
Calculate total, save order, clear session
     ↓
Return: "تم تأكيد الأوردر ✅ الإجمالي 50 جنيه"
```

## 🌍 Language Support

Currently supported:

- ✅ Egyptian Arabic
- ✅ English

Built-in features:

- Arabic normalization (ا, ة, ى, etc.)
- Fuzzy matching (handles typos)
- Synonym support (برجر/برغر/burger)

## 🔐 Security

**Current (MVP):**

- No authentication required (for onboarding)
- Input validation on all fields
- SQL injection protection (parameterized queries)
- Safe JSON parsing with fallbacks

**Next Phase:**

- JWT authentication
- Rate limiting
- CORS configuration
- Audit logging
- Data encryption

## 📊 Database Schema

### Key Tables

- `restaurants`: Main accounts
- `branches`: WhatsApp phone routing
- `menu_items`: Catalog per branch
- `sessions`: Customer conversations
- `orders`: Order records

See `schema.sql` for complete schema with indexes.

## 🚀 Deployment

### Render (Recommended)

1. Push to GitHub
2. Create PostgreSQL service on Render
3. Deploy Node.js service
4. Set environment variables
5. Get public URL: `https://layla-v2.onrender.com`

### Other Platforms

- Heroku
- DigitalOcean
- AWS
- Google Cloud

See `SETUP.md` for step-by-step instructions.

## 📱 Environment Variables

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+1...
PORT=3000
NODE_ENV=production
```

See `.env.example` for template.

## 🐛 Troubleshooting

Common issues:

- **WhatsApp messages not delivered** → See TROUBLESHOOTING.md: "Critical: WhatsApp Messages Not Delivered"
- **Database connection error** → TROUBLESHOOTING.md: "Database Connection Errors"
- **OpenAI rate limit** → TROUBLESHOOTING.md: "OpenAI API Errors"
- **Fuzzy matching not working** → TROUBLESHOOTING.md: "Fuzzy Matching Issues"

## 📚 Documentation

- `SETUP.md` - Complete setup & deployment guide
- `API.md` - Full API reference with examples
- `TROUBLESHOOTING.md` - Debug guide for common issues
- `schema.sql` - Database schema

## 🔄 Request Flow

```
Customer WhatsApp
      ↓
Twilio Cloud
      ↓
POST /twilio
      ↓
Identify branch
      ↓
Get/create session
      ↓
Fetch menu
      ↓
OpenAI processes
      ↓
Fuzzy match items
      ↓
Update session/order
      ↓
Generate TwiML
      ↓
Return XML response
      ↓
Twilio sends to customer
```

## 📈 Scalability

**Current Setup:**

- Single Node.js process
- PostgreSQL database
- Stateless (scales horizontally)

**Future Improvements:**

- Load balancer
- Multiple workers
- Redis caching
- Message queue (RabbitMQ/Kafka)
- CDN for static files

## 🎓 Learning Resources

Used in this project:

- Express.js routing
- PostgreSQL transactions
- OpenAI API integration
- Twilio webhook handling
- Arabic NLP basics
- Multi-tenant architecture

## 📞 Support

1. Check `TROUBLESHOOTING.md`
2. Check logs: `npm start`
3. Test with cURL commands in `API.md`
4. Check Twilio logs
5. Verify `.env` file

## 📄 License

MIT License

## 🙏 Acknowledgments

- Twilio for WhatsApp API
- OpenAI for GPT models
- PostgreSQL team
- Express.js community

---

## 🎯 Roadmap

### Phase 2

- [ ] Order management dashboard
- [ ] Multi-language support (AR/EN/FR)
- [ ] Email/SMS notifications
- [ ] Payment integration (Stripe, Fawry)
- [ ] Analytics dashboard
- [ ] Customer ratings & reviews

### Phase 3

- [ ] Mobile app (iOS/Android)
- [ ] Admin panel
- [ ] Delivery tracking
- [ ] Loyalty program
- [ ] Inventory management

---

**Built with ❤️ for Egyptian restaurants**

Made with Node.js, PostgreSQL, OpenAI, and Twilio.
