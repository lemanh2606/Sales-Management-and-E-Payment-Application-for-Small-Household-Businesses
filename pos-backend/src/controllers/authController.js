const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { compare, hash } = require('../utils/hash');

const login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const payload = { sub: user._id, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({ token, user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role } });
};

const register = async (req, res) => {
  const { username, password, fullName, role, store } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ message: 'Username exists' });
  const passwordHash = await hash(password);
  const user = await User.create({ username, passwordHash, fullName, role, store });
  res.status(201).json({ id: user._id, username: user.username });
};

module.exports = { login, register };
