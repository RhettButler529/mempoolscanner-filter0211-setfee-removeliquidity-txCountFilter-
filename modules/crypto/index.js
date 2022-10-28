const web3 = require('./web3');
const constracts = require('./contracts');
const utils = require('./utils');

module.exports = {
  ...web3,
  ...constracts,
  utils,
};
