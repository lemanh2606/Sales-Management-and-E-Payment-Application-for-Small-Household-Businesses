const express = require("express");
const router = express.Router();
const { registerManager, login } = require("../controllers/userController");

router.post("/register", registerManager);
router.post("/login", login);

module.exports = router;
