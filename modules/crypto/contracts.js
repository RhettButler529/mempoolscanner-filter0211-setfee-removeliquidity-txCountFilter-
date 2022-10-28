/* eslint-disable quote-props */
/* eslint-disable max-len */
const { web3 } = require('./web3');
const factoryContractAbi = require('./abis/FactoryContract.json');
const routerContractAbi = require('./abis/RouterContract.json');
 
const config = require('../../config');

const univ2FactoryContractAddress = config.uniswapV2FactoryAddress;
const univ2FactoryContract = new web3.eth.Contract(factoryContractAbi, univ2FactoryContractAddress);

const sushiFactoryContractAddress = config.sushiswapFactoryAddress;
const sushiFactoryContract = new web3.eth.Contract(factoryContractAbi, sushiFactoryContractAddress);

const univ2RouterContractAddress = config.uniswapV2RouterAddress;
const univ2RouterContract = new web3.eth.Contract(routerContractAbi, univ2RouterContractAddress);



module.exports = {
    uniswapV2FactoryContract: {
        address: univ2FactoryContractAddress,
        contractAbi: factoryContractAbi,
        contract: univ2FactoryContract
    },

    sushiFactoryContract: {
        address: sushiFactoryContractAddress,
        contractAbi: factoryContractAbi,
        contract: sushiFactoryContract
    },

    uniswapV2RouterContract: {
        address: univ2RouterContractAddress,
        contractAbi: routerContractAbi,
        contract: univ2RouterContract
    },


};