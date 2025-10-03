
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Đăng ký Manager (khách hàng mua phần mềm)
exports.registerManager = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    // Check tồn tại username hoặc email
    const existUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existUser) {
      return res.status(400).json({ message: "Username hoặc email đã tồn tại" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      phone,
      password_hash,
      role: "MANAGER", // Chỉ cho phép tạo MANAGER ở bước đăng ký
    });

    await newUser.save();

    res.status(201).json({
      message: "Đăng ký Manager thành công",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// Login cho cả Manager & Staff
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Sai username hoặc password" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Sai username hoặc password" });
    }

    user.last_login = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
