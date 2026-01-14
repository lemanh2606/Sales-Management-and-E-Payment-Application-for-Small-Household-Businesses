const mongoose = require("mongoose");
require("dotenv").config();

// Cleanup legacy indexes that may cause duplicate key errors
const cleanupLegacyIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection("inventory_vouchers");
    
    // Get current indexes
    const indexes = await collection.indexes();
    
    // Check for legacy index with 'store' instead of 'store_id'
    const legacyIndex = indexes.find(idx => 
      idx.key && idx.key.store !== undefined && idx.key.voucher_code !== undefined
    );
    
    if (legacyIndex && legacyIndex.name !== "store_id_1_voucher_code_1") {
      console.log(`⚠️ Found legacy index: ${legacyIndex.name}, dropping...`);
      await collection.dropIndex(legacyIndex.name);
      console.log(`✅ Dropped legacy index: ${legacyIndex.name}`);
    }
    
    // Also delete any vouchers with null store_id to clean up orphan data
    const orphanCount = await collection.countDocuments({ 
      $or: [
        { store_id: null },
        { store_id: { $exists: false } }
      ]
    });
    
    if (orphanCount > 0) {
      console.log(`⚠️ Found ${orphanCount} orphan vouchers with null store_id`);
      // Optionally delete them (uncomment if needed):
      // await collection.deleteMany({ $or: [{ store_id: null }, { store_id: { $exists: false } }] });
      // console.log(`✅ Deleted ${orphanCount} orphan vouchers`);
    }
    
  } catch (error) {
    // Silently ignore if collection doesn't exist or other non-critical errors
    if (!error.message.includes("ns not found")) {
      console.warn("⚠️ Warning during index cleanup:", error.message);
    }
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      retryWrites: true, // Retry write nếu fail
      w: "majority", // Majority write concern
    });
    console.log("✅ Kết nối MongoDB Compass thành công!");
    
    // Cleanup legacy indexes after connection
    await cleanupLegacyIndexes();
    
  } catch (error) {
    console.error("Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
