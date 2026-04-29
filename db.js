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

export async function activateBranch(id) {
  try {
    const res = await pool.query(
      "UPDATE branches SET is_active = true WHERE id = $1 RETURNING *",
      [id],
    );
    console.log(`✅ Branch activated: ${id}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error activating branch:", err.message);
    throw err;
  }
}

// ------------------
// 🌿 BRANCHES
// ------------------

export async function createBranch(restaurantId, name, phone) {
  try {
    const res = await pool.query(
      "INSERT INTO branches (restaurant_id, name, phone, twilio_number) VALUES ($1, $2, $3, $4) RETURNING *",
      [restaurantId, name, phone, phone],
    );
    console.log(`✅ Branch created: ${name} (twilio_number: ${phone})`);
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
      "SELECT * FROM branches WHERE twilio_number = $1 AND is_active = true",
      [phone],
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error("❌ Error fetching branch by phone:", err.message);
    throw err;
  }
}

export async function getAllActiveBranches() {
  try {
    const res = await pool.query(
      `SELECT b.*, r.name as restaurant_name
       FROM branches b
       JOIN restaurants r ON b.restaurant_id = r.id
       WHERE b.is_active = true AND r.is_active = true
       ORDER BY r.name, b.name`
    );
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching active branches:", err.message);
    throw err;
  }
}

export async function searchBranchesByName(searchTerm) {
  try {
    const res = await pool.query(
      `SELECT b.*, r.name as restaurant_name
       FROM branches b
       JOIN restaurants r ON b.restaurant_id = r.id
       WHERE b.is_active = true AND r.is_active = true
       AND (LOWER(b.name) LIKE LOWER($1) OR LOWER(r.name) LIKE LOWER($1))
       ORDER BY r.name, b.name
       LIMIT 10`,
      [`%${searchTerm}%`]
    );
    return res.rows;
  } catch (err) {
    console.error("❌ Error searching branches:", err.message);
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
      .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
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
    let res = await pool.query(
      "SELECT * FROM sessions WHERE branch_id = $1 AND user_phone = $2",
      [branchId, userPhone],
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    res = await pool.query(
      "INSERT INTO sessions (branch_id, user_phone, order_json) VALUES ($1, $2, $3) RETURNING *",
      [branchId, userPhone, JSON.stringify([])],
    );

    console.log(`✅ New session created for ${userPhone} (branch: ${branchId})`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error managing session:", err.message);
    throw err;
  }
}

export async function getOrCreateGlobalSession(userPhone) {
  try {
    // Look for existing global session (branch_id IS NULL)
    let res = await pool.query(
      "SELECT * FROM sessions WHERE user_phone = $1 AND branch_id IS NULL",
      [userPhone],
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    res = await pool.query(
      "INSERT INTO sessions (user_phone, order_json, context) VALUES ($1, $2, $3) RETURNING *",
      [userPhone, JSON.stringify([]), JSON.stringify({})],
    );

    console.log(`✅ New global session created for ${userPhone}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error managing global session:", err.message);
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

export async function updateSessionBranch(sessionId, branchId) {
  try {
    // Check if a session already exists for this branch+phone
    const phoneRes = await pool.query(
      "SELECT user_phone FROM sessions WHERE id = $1",
      [sessionId],
    );
    const userPhone = phoneRes.rows[0]?.user_phone;

    if (userPhone) {
      const existing = await pool.query(
        "SELECT * FROM sessions WHERE branch_id = $1 AND user_phone = $2",
        [branchId, userPhone],
      );

      if (existing.rows.length > 0) {
        // There's already a session for this branch+phone.
        // Delete the global session and return the existing one.
        await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
        console.log(
          `🔄 Merged global session into existing branch session ${existing.rows[0].id}`,
        );
        return existing.rows[0];
      }
    }

    // Safe to update — no duplicate
    const res = await pool.query(
      "UPDATE sessions SET branch_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [branchId, sessionId],
    );
    console.log(`✅ Session ${sessionId} assigned to branch ${branchId}`);
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error updating session branch:", err.message);
    throw err;
  }
}

export async function updateSessionContext(sessionId, context) {
  try {
    const res = await pool.query(
      "UPDATE sessions SET context = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [JSON.stringify(context), sessionId],
    );
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error updating session context:", err.message);
    throw err;
  }
}

export async function clearSession(sessionId) {
  try {
    await pool.query(
      "UPDATE sessions SET order_json = $1, pending_item = $2, context = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
      [JSON.stringify([]), null, JSON.stringify({}), sessionId],
    );
  } catch (err) {
    console.error("❌ Error clearing session:", err.message);
    throw err;
  }
}

export async function setPendingItem(sessionId, itemName, itemPrice, qty = 1) {
  try {
    const res = await pool.query(
      "UPDATE sessions SET pending_item = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [JSON.stringify({ name: itemName, price: itemPrice, qty }), sessionId],
    );
    return res.rows[0];
  } catch (err) {
    console.error("❌ Error setting pending item:", err.message);
    throw err;
  }
}

export async function getPendingItem(sessionId) {
  try {
    const res = await pool.query(
      "SELECT pending_item FROM sessions WHERE id = $1",
      [sessionId],
    );
    return res.rows[0]?.pending_item || null;
  } catch (err) {
    console.error("❌ Error getting pending item:", err.message);
    throw err;
  }
}

export async function clearPendingItem(sessionId) {
  try {
    await pool.query(
      "UPDATE sessions SET pending_item = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [null, sessionId],
    );
  } catch (err) {
    console.error("❌ Error clearing pending item:", err.message);
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
