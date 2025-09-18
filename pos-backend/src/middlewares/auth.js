const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = (options = {}) => async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = auth;
