# Layla v2 - API Reference

## Base URL

```
http://localhost:3000 (development)
https://layla-v2.onrender.com (production)
```

---

## 📝 Authentication

Currently **no authentication required**. Future versions will use JWT tokens.

---

## 🎯 Endpoints

### Signup

**POST** `/api/signup`

Create a new restaurant account.

**Request:**

```json
{
  "name": "الشرقاوي",
  "phone": "+201001234567"
}
```

**Response (201):**

```json
{
  "success": true,
  "restaurantId": 1,
  "name": "الشرقاوي",
  "phone": "+201001234567",
  "message": "مرحبًا! تم التسجيل بنجاح 🎉"
}
```

**Errors:**

- `400`: Name or phone missing
- `409`: Phone number already registered

---

### Create Branch

**POST** `/api/branches`

Add a new branch to a restaurant.

**Request:**

```json
{
  "restaurantId": 1,
  "name": "الفرع الرئيسي",
  "phone": "+1234567890"
}
```

**Response (201):**

```json
{
  "success": true,
  "branch": {
    "id": 1,
    "name": "الفرع الرئيسي",
    "phone": "+1234567890"
  }
}
```

**Errors:**

- `400`: Missing fields
- `404`: Restaurant not found
- `409`: Phone already used for this restaurant

---

### Get Branches

**GET** `/api/branches/:restaurantId`

Fetch all branches for a restaurant.

**Response (200):**

```json
{
  "success": true,
  "branches": [
    {
      "id": 1,
      "restaurant_id": 1,
      "name": "الفرع الرئيسي",
      "phone": "+1234567890",
      "is_active": true,
      "created_at": "2026-04-29T10:00:00.000Z"
    }
  ]
}
```

---

### Upload Menu

**POST** `/api/menu`

Bulk upload menu items for a branch.

**Request:**

```json
{
  "branchId": 1,
  "items": [
    { "name": "برجر", "price": 50, "description": "برجر طازة" },
    { "name": "فرايز", "price": 20 },
    { "name": "عصير برتقال", "price": 15 }
  ]
}
```

**Response (201):**

```json
{
  "success": true,
  "count": 3,
  "items": [
    {
      "id": 1,
      "branch_id": 1,
      "name": "برجر",
      "price": "50.00",
      "is_available": true
    }
  ]
}
```

**Errors:**

- `400`: Invalid items format
- `404`: Branch not found

---

### Get Menu

**GET** `/api/menu/:branchId`

Fetch all menu items for a branch.

**Response (200):**

```json
{
  "success": true,
  "menu": [
    {
      "id": 1,
      "branch_id": 1,
      "name": "برجر",
      "price": "50.00",
      "description": null,
      "is_available": true,
      "created_at": "2026-04-29T10:00:00.000Z"
    }
  ]
}
```

---

### Add Menu Item

**POST** `/api/menu/item`

Add a single menu item.

**Request:**

```json
{
  "branchId": 1,
  "name": "شاورما دجاج",
  "price": 40,
  "description": "شاورما طازة مع الخبز"
}
```

**Response (201):**

```json
{
  "success": true,
  "item": {
    "id": 2,
    "branch_id": 1,
    "name": "شاورما دجاج",
    "price": "40.00"
  }
}
```

---

### Activate Restaurant

**POST** `/api/activate`

Activate a restaurant and make it live on WhatsApp.

**Requirements:**

- At least one branch
- At least one menu item

**Request:**

```json
{
  "restaurantId": 1
}
```

**Response (200):**

```json
{
  "success": true,
  "restaurant": {
    "id": 1,
    "name": "الشرقاوي",
    "is_active": true
  },
  "message": "You're live! 🎉"
}
```

**Errors:**

- `400`: No branches or menu items
- `404`: Restaurant not found

---

### Get Restaurant

**GET** `/api/restaurant/:restaurantId`

Fetch restaurant details with branches and menu counts.

**Response (200):**

```json
{
  "success": true,
  "restaurant": {
    "id": 1,
    "name": "الشرقاوي",
    "owner_phone": "+201001234567",
    "is_active": true,
    "created_at": "2026-04-29T10:00:00.000Z"
  },
  "branches": [
    {
      "id": 1,
      "name": "الفرع الرئيسي",
      "phone": "+1234567890",
      "menuCount": 5
    }
  ]
}
```

---

### Twilio Webhook

**POST** `/twilio`

Handles incoming WhatsApp messages from Twilio.

**Request (from Twilio):**

```
From: +201001234567
To: +1234567890
Body: عايز برجر
```

**Response (200 TwiML):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>تمام، واحد برجر. حاجة تانية؟</Message>
</Response>
```

**Processing Flow:**

1. Identify branch by `To` phone number
2. Get or create session for customer
3. Fetch branch menu
4. Process message with AI
5. Handle intents: place_order, confirm_order, etc.
6. Update session/orders in database
7. Return TwiML response

---

## 📊 Common Response Patterns

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "error": "Description of what went wrong"
}
```

### Validation Error (400)

```json
{
  "error": "Missing required field: name"
}
```

---

## 🔄 Full User Journey (API Calls)

### 1. Restaurant Signs Up

```bash
POST /api/signup
→ Get restaurantId
```

### 2. Add Branch

```bash
POST /api/branches
→ Get branchId
```

### 3. Upload Menu

```bash
POST /api/menu
→ Menu items created
```

### 4. Activate

```bash
POST /api/activate
→ Restaurant is live
```

### 5. Customer Sends Message

```
WhatsApp → /twilio endpoint
← AI processes order
← TwiML response sent
```

### 6. View Orders (Future)

```bash
GET /api/orders/:branchId
→ List of orders
```

---

## 🧪 Testing with cURL

### Test Signup

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "البرجر ماما",
    "phone": "+201001234567"
  }'
```

### Test Branch Creation

```bash
curl -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": 1,
    "name": "التجمع الخامس",
    "phone": "+20100999999"
  }'
```

### Test Menu Upload

```bash
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": 1,
    "items": [
      {"name": "برجر بيكون", "price": 65},
      {"name": "برجر دجاج", "price": 50},
      {"name": "بطاطس مقلية", "price": 20}
    ]
  }'
```

### Test Activation

```bash
curl -X POST http://localhost:3000/api/activate \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": 1
  }'
```

### Test Twilio Webhook

```bash
curl -X POST http://localhost:3000/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B201001234567&To=%2B20100999999&Body=السلام عليكم"
```

---

## 📈 Rate Limiting (Future)

Currently no rate limiting. Plan to add:

- 100 requests per minute per IP
- 1000 requests per hour per restaurant

---

## 🔐 Webhooks

### Twilio (Incoming Messages)

```
POST /twilio
Headers: application/x-www-form-urlencoded
```

**Future Webhooks:**

- Order updates to restaurant email
- Customer payment confirmations
- Delivery notifications

---

## 💾 Data Models

See `schema.sql` for complete schema

### Restaurant

- `id`: Auto-increment
- `name`: String
- `owner_phone`: String (unique)
- `is_active`: Boolean
- `created_at`: Timestamp

### Branch

- `id`: Auto-increment
- `restaurant_id`: Foreign key
- `name`: String
- `phone`: String (branch's WhatsApp number)
- `is_active`: Boolean
- `created_at`: Timestamp

### MenuItem

- `id`: Auto-increment
- `branch_id`: Foreign key
- `name`: String
- `price`: Decimal
- `description`: Text (optional)
- `is_available`: Boolean
- `created_at`: Timestamp

### Session

- `id`: Auto-increment
- `branch_id`: Foreign key
- `user_phone`: String
- `order_json`: JSONB array
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Order

- `id`: Auto-increment
- `branch_id`: Foreign key
- `user_phone`: String
- `items_json`: JSONB
- `total`: Decimal
- `status`: String (pending, confirmed, delivered)
- `created_at`: Timestamp
