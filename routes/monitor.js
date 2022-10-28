const express = require('express');

const router = express.Router();

const monitor = require('../controllers/monitor');

// uptime robot check
router.get('/', monitor.getMonitor);
router.get('/db', monitor.getMonitorDb);

module.exports = router;
