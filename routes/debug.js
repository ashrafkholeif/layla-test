import * as db from "../db.js";

export async function handleDebugBranches(req, res) {
  try {
    const { restaurantId } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId required" });
    }

    console.log(`\n📋 DEBUG: Checking restaurant ${restaurantId}`);

    // Get branches
    const branches = await db.getBranchesForRestaurant(parseInt(restaurantId));
    console.log(`   Found ${branches.length} branches`);

    for (const branch of branches) {
      console.log(
        `   - ID: ${branch.id}, Name: ${branch.name}, Active: ${branch.is_active}`,
      );

      // Manually activate
      await db.activateBranch(branch.id);
      console.log(`   ✅ Activated branch ${branch.id}`);
    }

    // Fetch again to confirm
    const updated = await db.getBranchesForRestaurant(parseInt(restaurantId));
    console.log(`\n   After activation:`);
    for (const branch of updated) {
      console.log(
        `   - ID: ${branch.id}, Name: ${branch.name}, Active: ${branch.is_active}`,
      );
    }

    return res.json({
      success: true,
      message: "Branches activated",
      branches: updated,
    });
  } catch (err) {
    console.error("❌ Debug error:", err);
    return res.status(500).json({ error: err.message });
  }
}
