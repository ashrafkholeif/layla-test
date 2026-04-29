import * as db from "../db.js";
import {
  validateMenuItems,
  sanitizeMenuItemName,
  validatePrice,
} from "../utils.js";

export async function handleUploadMenu(req, res) {
  try {
    const { branchId, items } = req.body;

    if (!branchId || !items) {
      return res.status(400).json({
        error: "branchId and items are required",
      });
    }

    // Verify branch exists
    const branch = await db.getBranchById(branchId);
    if (!branch) {
      return res.status(404).json({
        error: "Branch not found",
      });
    }

    // Validate items
    try {
      validateMenuItems(items);
    } catch (err) {
      return res.status(400).json({
        error: err.message,
      });
    }

    // Sanitize items
    const sanitizedItems = items.map((item) => ({
      name: sanitizeMenuItemName(item.name),
      price: parseFloat(item.price),
      description: item.description ? item.description.slice(0, 500) : null,
    }));

    // Bulk create
    const createdItems = await db.bulkCreateMenuItems(branchId, sanitizedItems);

    console.log(`✅ Menu uploaded: ${createdItems.length} items`);

    return res.status(201).json({
      success: true,
      count: createdItems.length,
      items: createdItems,
    });
  } catch (err) {
    console.error("❌ Upload menu error:", err.message);
    return res.status(500).json({
      error: "Failed to upload menu",
    });
  }
}

export async function handleGetMenu(req, res) {
  try {
    const { branchId } = req.params;

    const branch = await db.getBranchById(branchId);
    if (!branch) {
      return res.status(404).json({
        error: "Branch not found",
      });
    }

    const menu = await db.getMenuForBranch(branchId);

    return res.status(200).json({
      success: true,
      menu,
    });
  } catch (err) {
    console.error("❌ Get menu error:", err.message);
    return res.status(500).json({
      error: "Failed to fetch menu",
    });
  }
}

export async function handleAddMenuItem(req, res) {
  try {
    const { branchId, name, price, description } = req.body;

    if (!branchId || !name || price === undefined) {
      return res.status(400).json({
        error: "branchId, name, and price are required",
      });
    }

    if (!validatePrice(price)) {
      return res.status(400).json({
        error: "Price must be a positive number",
      });
    }

    const branch = await db.getBranchById(branchId);
    if (!branch) {
      return res.status(404).json({
        error: "Branch not found",
      });
    }

    const item = await db.createMenuItem(
      branchId,
      sanitizeMenuItemName(name),
      parseFloat(price),
      description,
    );

    return res.status(201).json({
      success: true,
      item,
    });
  } catch (err) {
    console.error("❌ Add menu item error:", err.message);
    return res.status(500).json({
      error: "Failed to add menu item",
    });
  }
}
