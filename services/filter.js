const { CronJob } = require('cron');
const { info } = require('winston');

const BigNumber = require('bignumber.js');
const sequelize = require('sequelize');
const got = require('got');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;
const { honeypotCheck } = require('./honeypot');
const { parse } = require('node-html-parser');
const { logger } = require('../modules/logger');
const { request, gql } = require('graphql-request');
const TelegramBot = require('node-telegram-bot-api');
const erc20ContractAbi = require('../modules/crypto/abis/erc20.json');
const { web3 } = require('../modules/crypto');
const config = require('../config');

let passed = true;

const axios = require('axios');
const { token } = require('morgan');
const models = require('../models');
const { getParams } = require('../controllers/api_v2');
const { param } = require('../routes/api_v2');

async function isHoneyPot(tokenAddress) {

  const api = 'https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot?chain=eth&token=';
  const honeyPotData = await axios(api + tokenAddress);
  return honeyPotData.data.IsHoneypot;
}





async function nameFilter(token, tokenData) {

  let tokenName = tokenData.name.toLowerCase();
  let paramsData = process.env.PARAMS_DATA
  let params = JSON.parse(paramsData)
  let nameBlackList = params.blackList.nameBlackList
  let contractBlackList = params.blackList.contractBlackList


  try {


    for(let i = 0 ; i < nameBlackList.length; i ++) {
      if(tokenName.includes(nameBlackList[i].toLowerCase()))
        return false
    }

    let contractName = await getTokenContractName(token);
    if(!contractName) {
      return true;
    }
    contractName = contractName.toLowerCase()

    for(let i = 0 ; i < contractBlackList.length; i ++) {
      if(contractName.includes(contractBlackList[i].toLowerCase()))
        return false
    }

    logger.info(`[filterToken][nameFilter][contract]: ${contractName}, [tokenName]: ${tokenData.name}\n`)
  } catch(err) {
    logger.error(`[CRON][FILTER_TOKEN] error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
  }
  return true
}

const tgBot = new TelegramBot(config.telegramBotToken);

async function getTokenData(tokenAddress) {
  const query = gql`
      {
        token(id: "${tokenAddress}") {
            name
            symbol
            decimals
            derivedETH
            tradeVolume
            totalLiquidity
        }
      }
    `;

  const data = await request('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', query);

  if(data.token == null) {
    const tokenContract = new web3.eth.Contract(erc20ContractAbi, tokenAddress);
    const tokenName = await tokenContract.methods.name().call();
    return {
      name: tokenName,
      derivedETH: 0,
      tradeVolume: 0,
      totalLiquidity: 0
    };
  }
  return data.token;
}
async function getHolderCount(tokenAddress) {
  const response = await got(`https://etherscan.io/token/${tokenAddress}`);
  const dom = new JSDOM(response.body);

  const holderString = dom.window.document.getElementById('ContentPlaceHolder1_tr_tokenHolders').textContent;
  const arr = holderString.split('Holders:');
  holderCount = Number(arr[1]);
  return holderCount;
}

async function getTokenFullData(tokenAddress) {
  //const data = getTokenData(tokenAddress);
  //data.holderCount = getHolderCount(tokenAddress);
  data.address = tokenAddress;
  return data;

}

async function getEthPrice() {
  const query = gql`
        {
            bundle(id: "1" ) {
                ethPrice
            }
        }
    `;

  const data = await request('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', query);
  return data.bundle.ethPrice;
}

async function getTokenContractName(tokenAddress) {
  let contractName = null
  try {
    await got(`https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${tokenAddress}&apikey=${config.etherscanAPIKey}`).then(async (response) => {
      const data = JSON.parse(response.body);
      contractName = data.result[0].ContractName;
    })
  } catch (err) {
    logger.info(`[getTokenContractName][error]: ${err}`)
  }
  return contractName
}
async function filterToken(token, tokenData) {
  return await nameFilter(token, tokenData)
}

function onTick() {
  if(passed) {
    filterPool();
  }
}


module.exports = { filterToken }
