const express = require('express');

const router = express.Router();

const api = require('../controllers/api_v2');

router.get('/params', api.getParams);
router.post('/enable_buy_bot/:value', api.updateEnableBuyBot);
router.post('/eth_limit/:value', api.updateEthLimit);
router.post('/amount_div_factor/:value', api.updateAmountDivFactor);
router.post('/black_list', api.updateBlackList);

module.exports = router;
