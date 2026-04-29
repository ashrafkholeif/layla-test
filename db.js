import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Error handling
pool.on("error", (err) => {
  console.error("Database pool error:", err);
});

// ------------------
// 🏪 RESTAURANTS
// ------------------

export async function createRestaurant(name, ownerPhone) {
  try {
    const res = await pool.query(
      "INSERT INTO restaurants (name, owner_phone) VALUES ($1, $2) RETURNING *",
      [name, ownerPhone],
    );
    console.log(`✅ Restaurant created: ${name}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error creating restaurant:", err.message);
    throw err;
  }
}

export async function getRestaurant(id) {
  try {
    const res = await pool.query("SELECT * FROM restaurants WHERE id = $1", [
      id,
    ]);
    return res.rows[0] || null;
  } catch (err) {
    console.error("❌ Error fetching restaurant:", err.message);
    throw err;
  }
}

export async function activateRestaurant(id) {
  try {
    const res = await pool.query(
      "UPDATE restaurants SET is_active = true WHERE id = $1 RETURNING *",
      [id],
    );
    console.log(`✅ Restaurant activated: ${id}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error activating restaurant:", err.message);
    throw err;
  }
}

// ------------------
// 🌿 BRANCHES
// ------------------

export async function createBranch(restaurantId, name, phone) {
  try {
    const res = await pool.query(
      "INSERT INTO branches (restaurant_id, name, phone) VALUES ($1, $2, $3) RETURNING *",
      [restaurantId, name, phone],
    );
    console.log(`✅ Branch created: ${name}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error creating branch:", err.message);
    throw err;
  }
}

export async function getBranchesForRestaurant(restaurantId) {
  try {
    const res = await pool.query(
      "SELECT * FROM branches WHERE restaurant_id = $1 ORDER BY created_at DESC",
      [restaurantId],
    );
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching branches:", err.message);
    throw err;
  }
}

export async function getBranchById(id) {
  try {
    const res = await pool.query("SELECT * FROM branches WHERE id = $1", [id]);
    return res.rows[0] || null;
  } catch (err) {
    console.error("❌ Error fetching branch:", err.message);
    throw err;
  }
}

export async function getBranchByPhone(phone) {
  try {
    const res = await pool.query(
      "SELECT * FROM branches WHERE phone = $1 AND is_active = true",
      [phone],
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error("❌ Error fetching branch by phone:", err.message);
    throw err;
  }
}

// ------------------
// 📋 MENU ITEMS
// ------------------

export async function createMenuItem(
  branchId,
  name,
  price,
  description = null,
) {
  try {
    const res = await pool.query(
      "INSERT INTO menu_items (branch_id, name, price, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [branchId, name, price, description],
    );
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error creating menu item:", err.message);
    throw err;
  }
}

export async function bulkCreateMenuItems(branchId, items) {
  try {
    const values = items
      .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(",");

    const params = [branchId];
    items.forEach((item) => {
      params.push(item.name, item.price, item.description || null);
    });

    const query = `
      INSERT INTO menu_items (branch_id, name, price, description)
      VALUES ${values}
      RETURNING *
    `;

    const res = await pool.query(query, params);
    console.log(`✅ Bulk inserted ${res.rows.length} menu items`);
    return res.rows;
  } catch (err) {
    console.error("❌ Error bulk creating menu items:", err.message);
    throw err;
  }
}

export async function getMenuForBranch(branchId) {
  try {
    const res = await pool.query(
      "SELECT * FROM menu_items WHERE branch_id = $1 AND is_available = true ORDER BY created_at DESC",
      [branchId],
    );
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching menu:", err.message);
    throw err;
  }
}

// ------------------
// 💬 SESSIONS
// ------------------

export async function getOrCreateSession(branchId, userPhone) {
  try {
    // Try to fetch existing session
    let res = await pool.query(
      "SELECT * FROM sessions WHERE branch_id = $1 AND user_phone = $2",
      [branchId, userPhone],
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Create new session
    res = await pool.query(
      "INSERT INTO sessions (branch_id, user_phone, order_json) VALUES ($1, $2, $3) RETURNING *",
      [branchId, userPhone, JSON.stringify([])],
    );

    console.log(`✅ New session created for ${userPhone}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error managing session:", err.message);
    throw err;
  }
}

export async function updateSession(sessionId, orderJson) {
  try {
    const res = await pool.query(
      "UPDATE sessions SET order_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [JSON.stringify(orderJson), sessionId],
    );
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error updating session:", err.message);
    throw err;
  }
}

export async function clearSession(sessionId) {
  try {
    await pool.query(
      "UPDATE sessions SET order_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [JSON.stringify([]), sessionId],
    );
  } catch (err) {
    console.error("❌ Error clearing session:", err.message);
    throw err;
  }
}

// ------------------
// 📦 ORDERS
// ------------------

export async function createOrder(branchId, userPhone, itemsJson, total) {
  try {
    const res = await pool.query(
      "INSERT INTO orders (branch_id, user_phone, items_json, total) VALUES ($1, $2, $3, $4) RETURNING *",
      [branchId, userPhone, JSON.stringify(itemsJson), total],
    );
    console.log(`✅ Order created for ${userPhone}: ${total}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error creating order:", err.message);
    throw err;
  }
}

export async function getOrdersForBranch(branchId) {
  try {
    const res = await pool.query(
      "SELECT * FROM orders WHERE branch_id = $1 ORDER BY created_at DESC LIMIT 100",
      [branchId],
    );
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching orders:", err.message);
    throw err;
  }
}

// ------------------
// 🧹 CLEANUP
// ------------------

export async function closePool() {
  try {
    await pool.end();
    console.log("✅ Database pool closed");
  } catch (err) {
    console.error("❌ Error closing pool:", err.message);
    throw err;
  }
}
