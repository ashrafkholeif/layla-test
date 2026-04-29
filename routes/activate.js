import * as db from "../db.js";

export async function handleActivateRestaurant(req, res) {
  try {
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        error: "restaurantId is required",
      });
    }

    const restaurant = await db.getRestaurant(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: "Restaurant not found",
      });
    }

    // Check if restaurant has at least one branch with menu items
    const branches = await db.getBranchesForRestaurant(restaurantId);
    if (branches.length === 0) {
      return res.status(400).json({
        error: "Add at least one branch before activating",
      });
    }

    let hasMenu = false;
    for (const branch of branches) {
      const menu = await db.getMenuForBranch(branch.id);
      if (menu.length > 0) {
        hasMenu = true;
        break;
      }
    }

    if (!hasMenu) {
      return res.status(400).json({
        error: "Add menu items to at least one branch before activating",
      });
    }

    const activated = await db.activateRestaurant(restaurantId);

    console.log(`🎉 Restaurant activated: ${restaurant.name}`);

    return res.status(200).json({
      success: true,
      restaurant: {
        id: activated.id,
        name: activated.name,
        is_active: activated.is_active,
      },
      message: "You're live! 🎉",
    });
  } catch (err) {
    console.error("❌ Activation error:", err.message);
    return res.status(500).json({
      error: "Failed to activate restaurant",
    });
  }
}

export async function handleGetRestaurant(req, res) {
  try {
    const { restaurantId } = req.params;

    const restaurant = await db.getRestaurant(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: "Restaurant not found",
      });
    }

    const branches = await db.getBranchesForRestaurant(restaurantId);

    // Get menu count per branch
    const branchesWithMenuCount = [];
    for (const branch of branches) {
      const menu = await db.getMenuForBranch(branch.id);
      branchesWithMenuCount.push({
        ...branch,
        menuCount: menu.length,
      });
    }

    return res.status(200).json({
      success: true,
      restaurant,
      branches: branchesWithMenuCount,
    });
  } catch (err) {
    console.error("❌ Get restaurant error:", err.message);
    return res.status(500).json({
      error: "Failed to fetch restaurant",
    });
  }
}
