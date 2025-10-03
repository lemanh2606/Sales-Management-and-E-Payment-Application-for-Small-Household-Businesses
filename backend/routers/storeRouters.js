const express = require("express");
const router = express.Router();
const { createStore, getStoresByManager } = require("../controllers/storeController");
const { verifyToken, isManager } = require("../middlewares/authMiddleware");

router.post("/", verifyToken, isManager, createStore); //tạo store
router.get("/mine", verifyToken, isManager, getStoresByManager); //lấy danh sách store của manager

module.exports = router;
