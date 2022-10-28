
require('dotenv').config();

const dbInitialize = require('./services/dbInitialize');
const cronService = require('./services/cron.service');
const app = require('./app.js');

dbInitialize(app);

cronService();
