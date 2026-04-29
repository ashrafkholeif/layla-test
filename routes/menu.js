import * as db from "../db.js";
import {
  validateMenuItems,
  sanitizeMenuItemName,
  validatePrice,
} from "../utils.js";
import { csvToJson } from "./template.js";
import XLSX from "xlsx";

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

export async function handleUploadMenuFile(req, res) {
  try {
    if (!req.body.file) {
      return res.status(400).json({
        error: "No file provided",
      });
    }

    const { branchId } = req.query;
    const fileContent = req.body.file;
    const fileName = req.body.fileName || "file";

    if (!branchId) {
      return res.status(400).json({
        error: "branchId query parameter is required",
      });
    }

    // Verify branch exists
    const branch = await db.getBranchById(parseInt(branchId));
    if (!branch) {
      return res.status(404).json({
        error: "Branch not found",
      });
    }

    let items = [];

    // Handle CSV files
    if (fileName.toLowerCase().endsWith(".csv") || fileContent.includes(",")) {
      const csvText = fileContent;
      items = csvToJson(csvText);
    }
    // Handle Excel files (.xlsx)
    else if (
      fileName.toLowerCase().endsWith(".xlsx") ||
      fileName.toLowerCase().endsWith(".xls")
    ) {
      const buffer = Buffer.from(fileContent, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      items = data
        .map((row) => {
          // Handle both English and Arabic column names
          const name =
            row["اسم العنصر"] ||
            row["Name"] ||
            row["name"] ||
            row["Item Name"] ||
            row["Item"];
          const price =
            row["السعر"] || row["Price"] || row["price"] || row["PRICE"];
          const description =
            row["الوصف"] ||
            row["Description"] ||
            row["description"] ||
            row["DESCRIPTION"];

          if (name && price) {
            return {
              name: String(name).trim(),
              price: parseFloat(price),
              ...(description && { description: String(description).trim() }),
            };
          }
          return null;
        })
        .filter((item) => item && item.name && item.price > 0);
    } else {
      return res.status(400).json({
        error: "Unsupported file format. Use CSV or Excel (.xlsx)",
      });
    }

    if (items.length === 0) {
      return res.status(400).json({
        error: "No valid items found in file",
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
    const createdItems = await db.bulkCreateMenuItems(
      parseInt(branchId),
      sanitizedItems,
    );

    console.log(`✅ Menu file uploaded: ${createdItems.length} items`);

    return res.status(201).json({
      success: true,
      count: createdItems.length,
      items: createdItems,
    });
  } catch (err) {
    console.error("❌ Upload menu file error:", err.message);
    return res.status(500).json({
      error: "Failed to upload menu file: " + err.message,
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
