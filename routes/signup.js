import * as db from "../db.js";
import { validatePhoneNumber, sanitizeInput } from "../utils.js";

export async function handleSignup(req, res) {
  try {
    const { name, phone } = req.body;

    // Validate input
    if (!name || !phone) {
      return res.status(400).json({
        error: "Name and phone are required",
      });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedPhone = sanitizeInput(phone);

    if (!validatePhoneNumber(sanitizedPhone)) {
      return res.status(400).json({
        error: "Invalid phone number",
      });
    }

    if (sanitizedName.length < 2) {
      return res.status(400).json({
        error: "Restaurant name must be at least 2 characters",
      });
    }

    // Create restaurant
    const restaurant = await db.createRestaurant(sanitizedName, sanitizedPhone);

    console.log(`✅ Restaurant signup: ${sanitizedName}`);

    return res.status(201).json({
      success: true,
      restaurantId: restaurant.id,
      name: restaurant.name,
      phone: restaurant.owner_phone,
      message: "مرحبًا! تم التسجيل بنجاح 🎉",
    });
  } catch (err) {
    console.error("❌ Signup error:", err.message);

    // Handle duplicate phone
    if (err.code === "23505") {
      return res.status(409).json({
        error: "This phone number is already registered",
      });
    }

    return res.status(500).json({
      error: "Failed to create restaurant",
    });
  }
}
