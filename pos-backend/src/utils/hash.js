const bcrypt = require('bcryptjs');
const hash = async (plain) => bcrypt.hash(plain, 10);
const compare = async (plain, hashed) => bcrypt.compare(plain, hashed);
module.exports = { hash, compare };
