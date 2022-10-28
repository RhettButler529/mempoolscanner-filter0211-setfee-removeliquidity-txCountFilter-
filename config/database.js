require('dotenv').config();
const { db } = require('../config');

module.exports = {
  development: db,
  test: db,
  production: db
};
