import * as db from "../db.js";
import { validatePhoneNumber, sanitizeInput } from "../utils.js";

export async function handleCreateBranch(req, res) {
  try {
    const { restaurantId, name, phone } = req.body;

    if (!restaurantId || !name || !phone) {
      return res.status(400).json({
        error: "restaurantId, name, and phone are required",
      });
    }

    // Verify restaurant exists
    const restaurant = await db.getRestaurant(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: "Restaurant not found",
      });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedPhone = sanitizeInput(phone);

    if (!validatePhoneNumber(sanitizedPhone)) {
      return res.status(400).json({
        error: "Invalid phone number",
      });
    }

    const branch = await db.createBranch(
      restaurantId,
      sanitizedName,
      sanitizedPhone,
    );

    console.log(`✅ Branch created: ${sanitizedName}`);

    return res.status(201).json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        phone: branch.phone,
      },
    });
  } catch (err) {
    console.error("❌ Create branch error:", err.message);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "This phone number is already used for this restaurant",
      });
    }

    return res.status(500).json({
      error: "Failed to create branch",
    });
  }
}

export async function handleGetBranches(req, res) {
  try {
    const { restaurantId } = req.params;

    const branches = await db.getBranchesForRestaurant(restaurantId);

    return res.status(200).json({
      success: true,
      branches,
    });
  } catch (err) {
    console.error("❌ Get branches error:", err.message);
    return res.status(500).json({
      error: "Failed to fetch branches",
    });
  }
}

export async function handleGetBranchById(req, res) {
  try {
    const { branchId } = req.params;

    const branch = await db.getBranchById(branchId);
    if (!branch) {
      return res.status(404).json({
        error: "Branch not found",
      });
    }

    return res.status(200).json({
      success: true,
      branch,
    });
  } catch (err) {
    console.error("❌ Get branch error:", err.message);
    return res.status(500).json({
      error: "Failed to fetch branch",
    });
  }
}
