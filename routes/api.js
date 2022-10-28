const express = require('express');

const router = express.Router();

const api = require('../controllers/api');

router.get('/list', api.getList);
router.get('/params', api.getParams);
router.post('/params', api.updateParams);
router.post('/filterConfig', api.updateFilterConfig);

module.exports = router;
