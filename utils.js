// ------------------
// 🔤 ARABIC NORMALIZATION
// ------------------

export function normalizeArabic(text) {
  if (!text) return "";

  return text
    .replace(/أ|إ|آ/g, "ا") // Alef variations
    .replace(/ة/g, "ه") // Teh Marbuta
    .replace(/ى/g, "ي") // Alef Maksura
    .replace(/ؤ/g, "و") // Waw with Hamza
    .replace(/ئ/g, "ي") // Yeh with Hamza
    .toLowerCase()
    .trim();
}

// Synonym mapping for common menu items
const synonyms = {
  burger: ["برجر", "برغر", "ساندوتش", "sandwich", "لحمة", "لحم", "meat"],
  pizza: ["بيتزا", "بيتسا", "فطيرة", "فطيره"],
  chicken: ["فراخ", "دجاج", "دجاج", "chick", "كنتاكي", "broiled"],
  fries: ["بطاطس", "فرايز", "chips", "بطاطه"],
  drink: ["مشروب", "عصير", "juice", "beverage"],
  salad: ["سلطة", "سلطه", "salaat"],
  dessert: ["حلويات", "حلوى", "sweet", "كيكة", "كعكة", "cake"],
};

export function getSynonyms(term) {
  const normalized = normalizeArabic(term);

  for (const [category, synonymList] of Object.entries(synonyms)) {
    if (
      synonymList.some((syn) => normalizeArabic(syn).includes(normalized)) ||
      normalized.includes(normalizeArabic(category))
    ) {
      return synonymList;
    }
  }

  return [];
}

// ------------------
// 🔍 FUZZY MATCHING
// ------------------

function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

export function findMenuItemFuzzy(menu, input, threshold = 0.6) {
  const normalizedInput = normalizeArabic(input);

  // Exact match first
  let match = menu.find((item) => {
    const normalizedName = normalizeArabic(item.name);
    return (
      normalizedName.includes(normalizedInput) ||
      normalizedInput.includes(normalizedName)
    );
  });

  if (match) return match;

  // Fuzzy match
  const scored = menu.map((item) => {
    const normalizedName = normalizeArabic(item.name);
    const score = similarity(normalizedInput, normalizedName);
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score >= threshold) {
    return scored[0].item;
  }

  return null;
}

// Legacy function for backward compatibility
export function findMenuItem(menu, input) {
  return findMenuItemFuzzy(menu, input);
}

// ------------------
// ✅ VALIDATION
// ------------------

export function validatePhoneNumber(phone) {
  // Accept format: +20XXXXXXXXXX or variations
  const phoneRegex =
    /^[\+]?[0-9]{1,3}?[-.\s]?[(]?[0-9]{1,4}?[)]?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}$/;
  return phoneRegex.test(phone);
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePrice(price) {
  return !isNaN(parseFloat(price)) && parseFloat(price) > 0;
}

export function validateMenuItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Menu items must be an array");
  }

  return items.every((item) => {
    if (!item.name || typeof item.name !== "string") {
      throw new Error("Each item must have a name (string)");
    }
    if (!validatePrice(item.price)) {
      throw new Error(`Invalid price for ${item.name}`);
    }
    return true;
  });
}

// ------------------
// 🛡️ SAFE JSON PARSING
// ------------------

export function safeJsonParse(jsonStr, fallback = null) {
  try {
    if (!jsonStr || typeof jsonStr !== "string") {
      return fallback;
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("JSON parse error:", err.message, "Input:", jsonStr);
    return fallback;
  }
}

export function safeJsonStringify(obj, fallback = "{}") {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    console.error("JSON stringify error:", err.message);
    return fallback;
  }
}

// ------------------
// 📝 TEXT FORMATTING
// ------------------

export function formatPrice(price) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
  }).format(price);
}

export function formatOrder(items) {
  return items
    .map(
      (item) =>
        `${item.item} x${item.qty} (${formatPrice(item.price * item.qty)})`,
    )
    .join("\n");
}

// ------------------
// 🔐 SECURITY
// ------------------

export function sanitizeInput(input) {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 500); // Max 500 chars
}

export function sanitizeMenuItemName(name) {
  return sanitizeInput(name).slice(0, 100); // Max 100 chars for names
}
