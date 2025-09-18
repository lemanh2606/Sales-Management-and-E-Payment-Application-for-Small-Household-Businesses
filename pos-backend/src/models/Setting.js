const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});
module.exports = mongoose.model('Setting', schema);
