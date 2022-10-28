const { filterToken } = require('./filter');


const models = require('../models');
const { logger } = require('../modules/logger');
const config = require("../config");
const pairContractAbi = require('../modules/crypto/abis/Pair.json');
const erc20ContractAbi = require('../modules/crypto/abis/erc20.json');
const { uniswapV2FactoryContract, uniswapV2RouterContract, web3 } = require('../modules/crypto');
const BlocknativeSdk = require('bnc-sdk');
const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');
const { default: BigNumber } = require('bignumber.js');
const { info } = require('winston');
const BN = web3.utils.BN;
const axios = require('axios');
const { wethAddress, uniswapV2RouterAddress } = require('../config');
const { testPrivateKey, uniswapV3Router2Address, testPublicKey } = require('../config');
const { token } = require('morgan');
const EVENT_BLOCK = 'event_block';
const EVENT_PAIR_CREATED = 'PairCreated';
const EVENT_PAIR_SYNC = 'Sync';
const { N_WALLET } = require('../config');
const fs = require('fs');
const { param } = require('../routes/api_v2');
const { initParams } = require('request');
const { honeypotCheck } = require('./honeypot');

let walletKeys



// Blocknative sdk options
const blocknativeOptions = {
    dappId: config.blocknativeAPIKey,
    networkId: 1,
    system: 'ethereum', // optional, defaults to ethereum
    transactionHandlers: [event => null],
    ws: WebSocket, // only neccessary in server environments
    onerror: (error) => { } //optional, use to catch errors
};



const blocknative = new BlocknativeSdk(blocknativeOptions);

const tgBot = new TelegramBot(config.telegramBotToken);
const tgBuyBot = new TelegramBot(config.telegramBuyBotToken);

const tgTestBot = new TelegramBot(config.telegramTestBotToken);

let buyAmountMap = {}
let tokenData = {}
let fSuccessBuy = {}
let f3Pendings = {}
let successBuyTimeStamp= {}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function isHoneyPot(tokenAddress) {

    const api = 'https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot?chain=eth&token=';
    const honeyPotData = await axios(api + tokenAddress);
    return honeyPotData.data.IsHoneypot;
}


async function removeRowFromDB(token) {

    try{
        const rows = await models.lists.findAll({
            where: {
                token:token,
            }
        });
        if(rows.length == 0) {
            return
        }
        logger.info(`[removeRowFromDB] TokenName: ${token},row: ${rows[0]}`)
        let row = rows[0]
        const rowData = row.get()
        let id = rowData.id
        await models.lists.destroy({
            where: {
                id: id
            },
            force: true
        });
    } catch (err) {
        logger.info(`[removeRowFromDB][error] err, ${err}`)
    }
}
async function getTokenData(tokenAddress, pairAddress) {

    const tokenContract = new web3.eth.Contract(erc20ContractAbi, tokenAddress)
    let tokenName = await tokenContract.methods.name().call()
    let tokenSymbol = await tokenContract.methods.symbol().call()
    let totalSupply = await tokenContract.methods.totalSupply().call()
    let decimals = await tokenContract.methods.decimals().call()
    let tokenPairCreatedTime = new Date()
    return {
        pair: pairAddress,
        address: tokenAddress,
        name: tokenName,
        symbol: tokenSymbol,
        derivedETH: 0,
        tradeVolume: 0,
        totalLiquidity: 0,
        decimals,
        totalSupply,
        time: tokenPairCreatedTime
    };
}


async function approveUniswap(privateKey, publicKey, erc20Address) {

    if(process.env.MODE === 'Test') {
        return false
    }
    
    const erc20Contract = new web3.eth.Contract(erc20ContractAbi, erc20Address)

    let bnAmountToApprove = new BN('99999999999999999999999999999999999999999999999');


    let transaction = erc20Contract.methods.approve(
        uniswapV2RouterAddress,
        bnAmountToApprove
      );
    
     let estimatedGas = await transaction.estimateGas({from: publicKey});

      const options = {
        gas: Math.floor(estimatedGas * 1.5),
        to: transaction._parent._address,
        data: transaction.encodeABI(),
        // maxPriorityFeePerGas: 5000000000,
        //maxFeePerGas: 500000000000,
        type: 2
      };
      let signed = await web3.eth.accounts.signTransaction(options, privateKey);
      // let receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
      // return receipt;
      return await web3.eth.sendSignedTransaction(signed.rawTransaction)
}



async function swapETHForExactTokens(privateKey, publicKey, tokenAddress, bnTokenAmountToSwap, gasData) {
    
    let paramsData = process.env.PARAMS_DATA
    let params = JSON.parse(paramsData)
    let eth_limit = params.eth_limit
    if(!eth_limit || eth_limit === '0')
        eth_limit = '0.35'
    let weiAmount = web3.utils.toWei('' + eth_limit, 'ether')
    let bnPayLimit = new BN(weiAmount)

    if(process.env.MODE === 'Test') {
        return false
    }
    
    let routerContract = uniswapV2RouterContract.contract;
    let transaction = routerContract.methods.swapETHForExactTokens(
      bnTokenAmountToSwap,
      [wethAddress, tokenAddress],
      publicKey,
      Math.floor(Date.now() / 1000) + (60 * 10000), // deadline
    );
    
    let estimatedGas = await transaction.estimateGas({from: publicKey, value: bnPayLimit});
    if(estimatedGas >= 700000) {
        return 'Did not buy because gas > 700000'
    }
    //const nonce = await web3.eth.getTransactionCount(publicKey, 'latest')
    const options = {
      to: transaction._parent._address,
      gas: 500000,
      data: transaction.encodeABI(),
      value: bnPayLimit,
      maxPriorityFeePerGas: 51500000000,
      maxFeePerGas: 551000000000,
      type: 2
    };

    let signed = await web3.eth.accounts.signTransaction(options, privateKey);
    // let receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    // return receipt;
    return await web3.eth.sendSignedTransaction(signed.rawTransaction)
}
async function swapExactTokensForETHSupportingFeeOnTransferTokens(privateKey, publicKey, tokenAddress, bnTokenAmountToSwap, gasData) {
   
    if(process.env.MODE === 'Test') {
        return false
    }
    
    let routerContract = uniswapV2RouterContract.contract;
    let bnAmountOutMin = new BN('30000000000000000')
    //let bb = bnTokenAmountToSwap.div(new BN('10'))
    let transaction = routerContract.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
      bnTokenAmountToSwap,
      bnAmountOutMin,
      [tokenAddress, wethAddress ],
      publicKey,
      Math.floor(Date.now() / 1000) + (60 * 10000), // deadline
    );

    let estimatedGas = await transaction.estimateGas({from: publicKey});
    if(estimatedGas >= 700000) {
        return 'Did not sell because gas > 700000'
    }

    //const nonce = await web3.eth.getTransactionCount(publicKey, 'latest')
    const options = {
      to: transaction._parent._address,
      gas: 500000,
      data: transaction.encodeABI(),
      maxPriorityFeePerGas: 51500000000,
      maxFeePerGas: 551000000000,
      type: 2
    };
    let signed = await web3.eth.accounts.signTransaction(options, privateKey);
    // let receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    // return receipt;
    return await web3.eth.sendSignedTransaction(signed.rawTransaction)
}
async function estimateEthCost(token, amount) {



    let bnAmount = new BN('' + amount)
    let routerContract = uniswapV2RouterContract.contract;
    let response = null
    let jsbnAmountOut = null
    let jsbnPriceEth = null
    try {
        response = await routerContract.methods.getAmountsOut(bnAmount, [token, wethAddress]).call()
        if (response !== null) {
            jsbnAmountOut = new BigNumber(response[1])
            jsbnPriceEth = jsbnAmountOut.dividedBy(new BigNumber('' + 10).pow(new BigNumber('' + 18)))
        }
    } catch (err) {
        logger.info(err)
        jsbnPriceEth = 0;
    }
    return jsbnPriceEth
}




//buy using Univ2 function 9 
async function _botBuy(tokenAddress, from, to, amount, tokenName, deployer) {

    let monitor15minFlag = 0
    let paramsData = process.env.PARAMS_DATA
    let localParams = JSON.parse(paramsData)
    let amount_div_factor = Math.floor(Number(localParams.amount_div_factor))

    if (!amount_div_factor)
        amount_div_factor = '2'

    let bnAmount = new BN('' + amount)

    let bnRealAmount = bnAmount.div(new BN('' + amount_div_factor))
    //bnRealAmount = bnRealAmount.mul(new BN('' + nWallet))
    for(let i = from ; i < to; i ++) {

        let privateKey = walletKeys.wallets[i].private_key
        let publicKey = walletKeys.wallets[i].public_key

        swapETHForExactTokens(privateKey, publicKey, tokenAddress, bnRealAmount)
            .then(async (receipt) => {

                if(receipt === 'Did not buy because gas > 700000') {
                    let msg = ''
                    if(process.env.MODE === 'Test') {
                        msg += `TEST MODE\n\n`
                    }
                    msg += `❌MPTEST${i + 1} Didn't buy because gas is too high\n\n`
                    logger.info(msg)
                    tgTestBot.sendMessage(config.telegramTestChannelId, msg)
                    return              
                }

                if(monitor15minFlag === 0) {
                    monitorDeployer(deployer, tokenAddress)
                    monitorfor15minutes(tokenAddress)
                    monitor15minFlag = 1
                }

                let msg = ''
                if(process.env.MODE === 'Test') {
                    msg += `TEST MODE\n\n`
                }
                
                msg += `🟢MPTEST${i + 1} BUY SUCCESS\n\n`
                msg += `TOKEN: ${tokenName}\n\n`
                msg += `AMOUNT: ${bnRealAmount.toString()}\n\n`
                if(receipt.logs.length !== 0)
                    msg += `TX HASH:\nhttps://etherscan.io/tx/${receipt.logs[0].transactionHash}`
                tgTestBot.sendMessage(config.telegramTestChannelId, msg)

                approveUniswap(privateKey, publicKey, tokenAddress)
                .then((receiptApprove) => {
                    let msg = ''
                    if(process.env.MODE === 'Test') {
                        msg += `TEST MODE\n\n`
                    }
                    msg += `🟢MPTEST${i + 1} APPROVE SUCCESS\n\n`
                    msg += `TOKEN: ${tokenName}\n\n`
                    if(receiptApprove.logs.length !== 0)
                        msg += `TX HASH:\nhttps://etherscan.io/tx/${receiptApprove.logs[0].transactionHash}`
                    tgTestBot.sendMessage(config.telegramTestChannelId, msg)
                })
                .catch((err) => {
                    let msg = ''
                    if(process.env.MODE === 'Test') {
                        msg += `TEST MODE\n\n`
                    }
                    msg += `❌MPTEST${i + 1} APPROVE FAILED\n\nTOKEN: ${tokenName}\n\nERROR: ${err}\n\n`
                    tgTestBot.sendMessage(config.telegramTestChannelId, msg)
                })
                
                // let j = 1
                // for(j = 1 ; j <= 5; j ++) {   
                //     const bIsHoneypot = isHoneyPot(tokenAddress)
                //     if(bIsHoneypot === false) {

                //         break
                //     }
                //     await sleep(60 * 1000)
                // }  

                // if(j === 6) {
                //     logger.info(`Did not approve because ${tokenAddress} ${tokenName} is a honeypot`)
                // }
                // else {
                //     logger.info(`Approve because in ${j * ( j + 1) / 2 } minutes`)
                // }

            })
            .catch((err) => {
                let msg = ''
                if(process.env.MODE === 'Test') {
                    msg += `TEST MODE\n\n`
                }
                msg += `❌MPTEST${i + 1} BUY FAILED\n\nTOKEN: ${tokenName}\n\nERROR: ${err}\n\n`
                tgTestBot.sendMessage(config.telegramTestChannelId, msg)
            })
        }
}

//decide how many wallets are used to buy
async function botBuy(token, tokenName, amount, percentage, deployer) {
    let paramsData = process.env.PARAMS_DATA
    let params = JSON.parse(paramsData)
        
    if (percentage >= 0.05 && percentage <= 0.2) {

        await _botBuy(token, 0, N_WALLET , amount, tokenName, deployer)
        let msg = ''
        if(process.env.MODE === 'Test') {
            msg += `TEST MODE\n\n`
        }
        const pair = await uniswapV2FactoryContract.contract.methods.getPair(token, wethAddress).call();

        msg += `😀😀😀${N_WALLET} BUY TX CALLED\n\n`
        msg += `https://www.dextools.io/app/ether/pair-explorer/${pair}`
        msg += `TOKEN: ${tokenName}\n\n`
        msg += `CONTRACT: ${token}`
        tgTestBot.sendMessage(config.telegramTestChannelId, msg)
    }

    else if (percentage > 0.2 && percentage <= 0.5) {

        await _botBuy(token, 0, N_WALLET , amount, tokenName, deployer)
        let msg = ''
        if(process.env.MODE === 'Test') {
            msg += `TEST MODE\n\n`
        }
        const pair = await uniswapV2FactoryContract.contract.methods.getPair(token, wethAddress).call();

        msg += `😀😀😀${N_WALLET} BUY TX CALLED\n\n`
        msg += `https://www.dextools.io/app/ether/pair-explorer/${pair}`
        msg += `TOKEN: ${tokenName}\n\n`
        msg += `CONTRACT: ${token}`
        tgTestBot.sendMessage(config.telegramTestChannelId, msg)
    }
    else if (percentage > 0.5 && percentage <= 1) {

        await _botBuy(token, 0, N_WALLET/2 , amount, tokenName, deployer)
        let msg = ''
        if(process.env.MODE === 'Test') {
            msg += `TEST MODE\n\n`
        }
        const pair = await uniswapV2FactoryContract.contract.methods.getPair(token, wethAddress).call();

        msg += `😀😀😀${N_WALLET/2} BUY TX CALLED\n\n`
        msg += `https://www.dextools.io/app/ether/pair-explorer/${pair}`
        msg += `TOKEN: ${tokenName}\n\n`
        msg += `CONTRACT: ${token}`
        tgTestBot.sendMessage(config.telegramTestChannelId, msg)
    }
    else if (percentage > 1 && percentage <= 2) {

        await _botBuy(token, 0, N_WALLET/2 , amount, tokenName, deployer)
        let msg = ''
        if(process.env.MODE === 'Test') {
            msg += `TEST MODE\n\n`
        }
        const pair = await uniswapV2FactoryContract.contract.methods.getPair(token, wethAddress).call();

        msg += `😀😀😀${N_WALLET/2} BUY TX CALLED\n\n`
        msg += `https://www.dextools.io/app/ether/pair-explorer/${pair}`
        msg += `TOKEN: ${tokenName}\n\n`
        msg += `CONTRACT: ${token}`
        tgTestBot.sendMessage(config.telegramTestChannelId, msg)
    }       
    
}
async function botBuyWithHoneyPotFilter(token, tokenName, amount, percentage, deployer) {

    // let startTime = new Date()
    // let cnt = 0
    // while(new Date() - startTime <= 60000) {
    //     cnt ++
    //     if(await isHoneyPot(token) === false) {
    //         await botBuy(token, tokenName, amount, percentage)
    //         logger.info(`[honeypot filter] ${token} passed honeypot filter in ${cnt}th hoenypot check`)
    //         return
    //     }
    // }

    // logger.info(`[honeypot filter] ${token} not passed honeypot filter for ${cnt} checks for 60s`)

    // return
    botBuy(token, tokenName, amount, percentage, deployer)

}

async function reportSuccess(token, amount, txIndex) {
    
    
    logger.info(`reportSuccess called!\n`)

    let { totalSupply } = tokenData[token];
    let percentage = amount / totalSupply * 100
    logger.info(`estimateEthCost called!\n`)
    let jsbnPriceEth = await estimateEthCost(token, amount)
    logger.info(`estimateEthCost finsiehd!\n`)

    const bIsHoneypot = await isHoneyPot(token);
    let timestamp = new Date().toUTCString();

    let timeElapsed = new Date() - tokenData[token].time;
    let msg = ''
    if(process.env.MODE === 'Test') {
        msg += `TEST MODE\n\n`
    }
    

    msg += `Success Message(THIRD PENDING VERSION TEST): \n\n`
    msg += `Token Name: ${tokenData[token].name} (${tokenData[token].symbol})\n\n`
    if (bIsHoneypot === true) {
        logger.info(`${token} is a honeypot\n`);
        msg += `❌ POTENTIAL HONEYPOT \n\n`

    }
    else msg += `🟢 SAFE\n\n`

    msg += `➡️ CONTRACT: ${token}\n\n`
    msg += `➡️ AMOUNT: ${new BigNumber(amount).toFixed()}\n\n`
    msg += `Total Supply: ${new BigNumber(totalSupply).toFixed()}\n\n`
    msg += `Percentage: ${amount / totalSupply * 100}%\n\n`
    msg += `💰 ETH AMOUNT (Estimate): ${jsbnPriceEth.toFixed(10)}\n\n`
    msg += `Time since pair created: ${timeElapsed / 1000}s\n\n`

    msg += `First tx hash: ${buyAmountMap[token][txIndex[0]].hash}\n\n`
    msg += `Second tx hash: ${buyAmountMap[token][txIndex[1]].hash}\n\n`
    msg += `Third tx hash': ${buyAmountMap[token][txIndex[2]].hash}\n\n`
    msg += `UTC Timestamp: ${timestamp}\n\n`

    tgTestBot.sendMessage(config.telegramTestChannelId, msg)
    logger.info(msg)


}
async function sellToken(walletNumber, gasData, token) {

    const tokenContract = new web3.eth.Contract(erc20ContractAbi, token)
    let balance = await tokenContract.methods.balanceOf(walletKeys.wallets[walletNumber].public_key).call()
    // if(await estimateEthCost(token, balance) < 0.1) {
    //     return
    // }
    
    if (balance > 0) {
        let msg = `😡😡😡RemoveLiquidity Token Address: ${removeToken} AutoSell of MP00${walletNumber + 1} \n`
        tgTestBot.sendMessage(config.telegramTestChannelId, msg)

        let bnBalance = new BN(balance)
        swapExactTokensForETHSupportingFeeOnTransferTokens(walletKeys.wallets[walletNumber].private_key, walletKeys.wallets[walletNumber].public_key, token, bnBalance, gasData)
            .then((receipt) => {

                if(receipt === 'Did not sell because gas > 500000') {
                    let msg = ''
                    if(process.env.MODE === 'Test') {
                        msg += `TEST MODE\n\n`
                    }
                    msg += `❌MPTEST${walletNumber + 1} Didn't sell because gas is too high\n\n`
                    logger.info(msg)
                    tgTestBot.sendMessage(config.telegramTestChannelId, msg)
                    return              
                }
                let msg = ''
                if(process.env.MODE === 'Test') {
                    msg += `TEST MODE\n\n`
                }
                msg += `🟢MPTEST${walletNumber + 1} SELL SUCCESS\n\n`
                msg += `TOKENADDRESS: ${token}\n\n`
                msg += `AMOUNT: ${bnBalance.toString()}\n\n`
                if(receipt.logs.length !== 0)
                    msg += `TX HASH:\nhttps://etherscan.io/tx/${receipt.logs[0].transactionHash}`
                tgTestBot.sendMessage(config.telegramTestChannelId, msg)
            })
            .catch((err) => {
                let msg = ''
                if(process.env.MODE === 'Test') {
                    msg += `TEST MODE\n\n`
                }
                msg += `❌MPTEST${walletNumber + 1} SELL FAILED\n\nTOKENADDRESS: ${token}\n\nERROR: ${err}\n\n`
                logger.info(msg)
                tgTestBot.sendMessage(config.telegramTestChannelId, msg)
            })
    }

    
}

function findToken(token0, token1) {

    let token = null
    if(!token0 || !token1) {
        return
    }
    if (token0.toLowerCase() === config.wethAddress) {
        token = token1

    }
    if (token1.toLowerCase() === config.wethAddress) {
        token = token0

    }
    return token
}


async function autoBuyForMatchings(transaction) {
    
    
    let buyToken = null
    if (transaction.contractCall
        && transaction.contractCall.contractType === 'Uniswap V2: Router 2'
        && transaction.contractCall.methodName.includes('swap')) {

        let tokenA = transaction.contractCall.params.path[0]
        let tokenB = transaction.contractCall.params.path[1]
            
        buyToken = findToken(tokenA, tokenB)

    }


    if (!buyToken || tokenData[buyToken] === undefined || buyAmountMap[buyToken] === undefined) {
        return
    }

    if (fSuccessBuy[buyToken] === 1 && (new Date() - successBuyTimeStamp[buyToken] > 60000)) {
        
        delete buyAmountMap[buyToken];
        delete tokenData[buyToken]
        removeRowFromDB(buyToken)
        logger.info(`Monitor ended at token address: ${buyToken}\n`);
        return;
    }


    if (f3Pendings[buyToken] !== undefined) {
        return
    }


    let amount = 0
    switch (transaction.contractCall.methodName) {
        case "swapExactTokensForTokens":
            amount = transaction.contractCall.params.amountIn;
            break;
        case "swapExactTokensForETH":
            amount = transaction.contractCall.params.amountIn;
            break;
        case "swapTokensForExactTokens":
            amount = transaction.contractCall.params.amountOut;
            break;
        case "swapETHForExactTokens":
            amount = transaction.contractCall.params.amountOut;
            break;
        case "swapExactTokensForETHSupportingFeeOnTransferTokens":
            amount = transaction.contractCall.params.amountIn;
            break;
        case "swapExactTokensForTokensSupportingFeeOnTransferTokens":
            amount = transaction.contractCall.params.amountIn;
            break;

        default:
            break;
    }

    if (amount === 0) {
        return;
    }
    buyAmountMap[buyToken].push({ hash: transaction.hash, amount: amount });

    let txIndex = [];
    let cnt = 0;

    for (let j = 0; j < buyAmountMap[buyToken].length; j++) {
        if (amount === buyAmountMap[buyToken][j].amount) {
            txIndex.push(j)
            cnt++;
        }
    }
    if (cnt === 3) {
        logger.info(`[autoBuy] 3 matching pendings found TokenName:${tokenData[buyToken].name}\n`)
        f3Pendings[buyToken] = amount;
        if(fSuccessBuy[buyToken] === 1) {    
            logger.info(`[autoBuyForMatchings] Bot buy called, TokenName:${tokenData[buyToken].name}\n`)   
            let percentage = amount / tokenData[buyToken].totalSupply * 100
            botBuyWithHoneyPotFilter(buyToken, tokenData[buyToken].name, amount, percentage, tokenData[buyToken].deployer)
        }
        await reportSuccess(buyToken, amount, txIndex)
        if(fSuccessBuy[buyToken] === 1) {
            delete buyAmountMap[buyToken];
            removeRowFromDB(buyToken);
            delete tokenData[buyToken];
        }
    
    }
}


async function autoSellForRemoveLiquidity(transaction) {

    let removeToken = null

    if (transaction.contractCall
        && transaction.contractCall.contractType === 'Uniswap V2: Router 2'
        && transaction.contractCall.methodName.includes('removeLiquidity')) {
        if (transaction.contractCall.methodName.includes('removeLiquidityETH')) {
            removeToken = transaction.contractCall.params.token
        }
        else {

            let tokenA = transaction.contractCall.params.tokenA
            let tokenB = transaction.contractCall.params.tokenB
            removeToken = findToken(tokenA, tokenB)
        }
    }


    if(!removeToken) {
        return
    }
    amountToRemove = transaction.contractCall.params.liquidity
    logger.info(`[autoSellforRemoveL][amountToremove]: ${amountToRemove}, tx:${transaction.hash}`)
    if(!amountToRemove) {
        return
    }

    const pair = await uniswapV2FactoryContract.contract.methods.getPair(removeToken, wethAddress).call();
    if(!pair) {
        return
    }

    const pairContract = new web3.eth.Contract(pairContractAbi, pair)
    const balance = await pairContract.methods.totalSupply().call()
    logger.info(`[autoSellforRemoveL][balance of the pool]: ${balance}, tx:${transaction.hash}, pair: ${pair}\n`)

    if(!balance || balance == 0) {
        return
    }
    logger.info(`[autoSellForRemoveLiquidity][amountToRemove/balance]: ${amountToRemove}/ ${balance}\n`)
    if(amountToRemove / balance < 0.7) {
        return    
    }

    
    let gas = transaction.gas
    let maxFeePerGas = transaction.maxFeePerGas
    let maxPriorityFeePerGas = transaction.maxPriorityFeePerGas
    let gasData = { gas, maxFeePerGas, maxPriorityFeePerGas }
    let msg = `😡😡😡RemoveLiquidity TX:${transaction.hash}\n Token name: ${removeToken}\n`


    if(maxPriorityFeePerGas > 51500000000) {
        msg += `Did not sell becasue maxPriorityFeePerGas: ${maxPriorityFeePerGas}`
        tgTestBot.sendMessage(config.telegramTestChannelId, msg)
        logger.info(msg)
        return
    }
    //tgTestBot.sendMessage(config.telegramTestChannelId, msg)
    logger.info(msg)
    for (let i = 0; i < N_WALLET; i++) {
        sellToken(i, gasData, removeToken)
    }
    //need to change to delete when all successful

}
async function autoSellForSetFee(transaction, removeToken) {

    if(transaction.maxFeePerGas !== undefined) {
        delete transaction.maxFeePerGas
    }
    if(transaction.maxFeePerGasGwei !== undefined) {
        delete transaction.maxFeePerGasGwei
    }
    if(transaction.maxPriorityFeePerGas !== undefined) {
        delete transaction.maxPriorityFeePerGas
    }
    if(transaction.maxPriorityFeePerGasGwei !== undefined ) {
        delete transaction.maxPriorityFeePerGasGwei
    }
    
   
    if ((transaction.to.toLowerCase() === removeToken.toLowerCase())
        &&transaction.contractCall
        && (transaction.contractCall.methodName.toLowerCase().includes('fee')
            ||transaction.contractCall.methodName.toLowerCase().includes('tax'))) {
      if(transaction.contractCall.params) {
        let sum = 0
        const items = transaction.contractCall.params
        for (const item in items) {

            if(typeof(items[item]) === "string") {
              const txStr = items[item]
              if(txStr >= 0 && txStr <= 100) {
                  console.log(txStr)
                  sum += parseInt(txStr)
              }
            }
        }
        console.log(sum)
        if(sum >= 95 && sum <= 100) {
            logger.info(`Deployer changes fee for\n TX:${transaction.hash}\n ${removeToken}`)
            let gas = transaction.gas
            let maxFeePerGas = transaction.maxFeePerGas
            let maxPriorityFeePerGas = transaction.maxPriorityFeePerGas
            let gasData = { gas, maxFeePerGas, maxPriorityFeePerGas }
            let msg = `😡😡😡SetFee to ${sum} TX:${transaction.hash}\n Token name: ${removeToken}\n`

            if(maxPriorityFeePerGas > 51500000000) {
                msg += `Did not sell becasue maxPriorityFeePerGas: ${maxPriorityFeePerGas}`
                tgTestBot.sendMessage(config.telegramTestChannelId, msg)
                logger.info(msg)
                return
            }

            for (let i = 0; i < N_WALLET; i++) {
                sellToken(i, gasData, removeToken)
            }

            tgTestBot.sendMessage(config.telegramTestChannelId, msg)
            logger.info(msg)
        }
      }		
}


    if (transaction.contractCall
        && (transaction.contractCall.methodName.toLowerCase().includes('fee')
            ||transaction.contractCall.methodName.toLowerCase().includes('tax'))) {
        if((txStr.toLowerCase().includes('fee') 
            ||txStr.toLowerCase().includes('tax')) 
            && (txStr.toLowerCase().includes('100')
                ||txStr.toLowerCase().includes('99')
                ||txStr.toLowerCase().includes('98')
                ||txStr.toLowerCase().includes('97')
                ||txStr.toLowerCase().includes('96')
                ||txStr.toLowerCase().includes('95'))) {

        }
    }

}

async function monitorForSuccessfulBuy(transaction) {
    
    let buyToken = null
    if (transaction.contractCall
        && transaction.contractCall.contractType === 'Uniswap V2: Router 2'
        && transaction.contractCall.methodName.includes('swap')) {

        let tokenA = transaction.contractCall.params.path[0]
        let tokenB = transaction.contractCall.params.path[1]
            
        buyToken = findToken(tokenA, tokenB)

    }


    if (!buyToken || tokenData[buyToken] === undefined || buyAmountMap[buyToken] === undefined) {
        return
    }
    if(fSuccessBuy[buyToken] === 1) {
        return
    }


    if(transaction.status !== 'confirmed') {
        return
    }

    fSuccessBuy[buyToken] = 1
    successBuyTimeStamp[buyToken] = new Date()
    logger.info(`[autoBuy] 1 successful tx found, TokenName:${tokenData[buyToken].name}\ntx:${transaction.hash}\n`)
    
    if(f3Pendings[buyToken] !== undefined) {
        logger.info(`[monitorForSuccessfulBuy] botBuy called , TokenName:${tokenData[buyToken].name}\ntx:${transaction.hash}\n`)

        let percentage = f3Pendings[buyToken] / tokenData[buyToken].totalSupply * 100
        botBuyWithHoneyPotFilter(buyToken, tokenData[buyToken].name, f3Pendings[buyToken], percentage, tokenData[buyToken].deployer)
        delete buyAmountMap[buyToken];
        removeRowFromDB(buyToken);
        delete tokenData[buyToken];
    }

}

async function monitorUniswapV2Factory() {
    logger.info(`[monitorUniswapV2Factory] started\n`)

    try {
        const {
            emitter, // emitter object to listen for status updates
            details // initial account details which are useful for internal tracking: address
        } = blocknative.account(uniswapV2FactoryContract.address);

        emitter.on("txConfirmed", async transaction => {


            const { internalTransactions } = transaction;

            if (internalTransactions === undefined) return;

            let token0, token1, pair;

            for (let i = 0; i < internalTransactions.length; i++) {
                const internalTx = internalTransactions[i];

                if (internalTx.contractCall && internalTx.contractCall.contractType === 'Uniswap V2: Factory' && internalTx.contractCall.methodName === "createPair") {
                    token0 = internalTx.contractCall.params.tokenA;
                    token1 = internalTx.contractCall.params.tokenB;

                    newToken = findToken(token0, token1)
                    if(!newToken) {
                        return
                    }

                    pair = await uniswapV2FactoryContract.contract.methods.getPair(token0, token1).call();
                    if(!pair) {
                        return
                    }
                    for(let i = 0 ; i < 2 ; i ++) {
                        if(pair === "0x0000000000000000000000000000000000000000") {
                            await sleep(30 * 1000)
                            pair = await uniswapV2FactoryContract.contract.methods.getPair(token0, token1).call();
                        }
                        else {
                            break
                        }
                    }
                    if(pair === "0x0000000000000000000000000000000000000000") {
                        return
                    }

                    let tData
                    try {
                        tData = await getTokenData(newToken, pair)
                    } catch (err) {
                        logger.info(`[getTokenData][error]: ${err}\n`)
                    }
                    if(!tData) {
                        return
                    }
                    tData["deployer"] = transaction.from

                    const msg = `deployer of ${newToken} is ${transaction.from}`
                    // tgTestBot.sendMessage(config.telegramTestChannelId, msg)

                    
                    if(await filterToken(newToken, tData) === false) {
                        logger.info(`[filterToken]: [blackList token] address: ${newToken}`)
                        return
                    }

                    tokenData[newToken] = tData
                    buyAmountMap[newToken] = []
                    logger.info(`[MonitorUniswapV2Factory][pairCreated] TokenName: ${tokenData[newToken].name}\n`);
                    
                    try {
                        await models.lists.create({
                            token: newToken,
                            tokenData: JSON.stringify(tokenData[newToken]),
                        });
                    } catch (error) {
                        logger.info(`[MonitorUniswapV2Factory][models.lists.create] error: ${tokenData[newToken].name}`);
                    }

                    break;
                }
            }

        });

    } catch (err) {
        logger.info(`[MonitorUniswapV2Factory] error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    }
    logger.info('[monitorUniswapV2Factory] ended\n')

}
async function monitorDeployer(deployer, token) {
    logger.info(`[monitorDeployer] ${deployer} started\n`)

    try {
        const {
            emitter, // emitter object to listen for status updates
            details // initial account details which are useful for internal tracking: address
        } = blocknative.account(deployer);

        emitter.on("txPool", async transaction => {
            autoSellForSetFee(transaction, token)
        });

    } catch (err) {
        logger.info(`[monitorDeployer] error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    }
    logger.info(`[monitorDeployer] ${deployer} ended\n`)

}

async function monitorfor15minutes(token) {

    logger.info('[monitorfor15minutes] started\n')
    const pair = await uniswapV2FactoryContract.contract.methods.getPair(token, wethAddress).call();
    //const pair = token2pair[token]

    if(!pair) {
        return
    }
    let nTx = 0
    const monitorStartTime = new Date()

    try {
        const {
            emitter, // emitter object to listen for status updates
            details // initial account details which are useful for internal tracking: address
        } = blocknative.account(pair);

        emitter.on("txConfirmed", async transaction => {
            logger.info(`nTx:${nTx}`)
            nTx++

            const nowDate = new Date()
            for(let i = 1 ; i <= 5 ; i ++) {
                if(nowDate - monitorStartTime >= 180000 * i) {
                    if(nTx < 15 * i) {
                        let gasData = {
                            gas: 500000,
                            maxPriorityFeePerGas: 5000000000,
                            maxFeePerGas: 551000000000,
                        }


                        for (let i = 0; i < N_WALLET; i++) {
                            sellToken(i, gasData, token)
                        }
                        
                        const msg = `sellToken ${token} because less than ${15 * i}Txs in ${3 * i} min.`
                        tgTestBot.sendMessage(config.telegramTestChannelId, msg)
                        logger.info(msg)

                        blocknative.unsubscribe(pair)
                    }
                    if(i === 5) {
                        blocknative.unsubscribe(pair)
                        logger.info('[monitorFor15minutes] ended\n')                     
                    }
                    
                }
            }
        });

    } catch (err) {
        logger.info(`[monitorfor15minutes] error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    }


}


async function monitorUniswapV2Router() {

    logger.info(`[monitorUniswapRouter] started\n`)

    try {
        const {
            emitter, // emitter object to listen for status updates
            details // initial account details which are useful for internal tracking: address
        } = blocknative.account(uniswapV2RouterAddress);

        emitter.on("txPool", async transaction => {
            autoBuyForMatchings(transaction)
            autoSellForRemoveLiquidity(transaction)
        });

        emitter.on("txConfirmed", async transaction => {
            monitorForSuccessfulBuy(transaction)
        });


    } catch (err) {
        logger.info(`[MonitorUniswapV2Router] error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    }
    logger.info(`[monitorUniswapRouter] ended\n`)

}
async function fetchPool() {


    await initParamsData()
    await readTokenData()
    monitorUniswapV2Factory();
    monitorUniswapV2Router();
}

async function readTokenData() {

    logger.info('[readTokenData] started\n')


    try {
        const rows = await models.lists.findAll({
            order: [
                [`id`, 'ASC']
            ]
        });
        
        for (let i = 0; i < rows.length; i++) {
            let row = rows[i]
            const rowData = row.get()
            tokenData[rowData.token] = JSON.parse(rowData.tokenData)
            if(tokenData[rowData.token].pair === "0x0000000000000000000000000000000000000000") {
                continue
            }
            const pairContract = new web3.eth.Contract(pairContractAbi, tokenData[rowData.token].pair)
            let balance = null
            if(pairContract)
                balance = await pairContract.methods.totalSupply().call()

            if(balance == 0) {
                buyAmountMap[rowData.token] = []
                logger.info(`buyAmountMap[${tokenData[rowData.token].name} = 0`);
            }
        }

    } catch (err) {
        logger.info('Reading data error:' + err +'\n')
    }
    logger.info('[readTokenData] ended\n')

}

async function initParamsData() {
    logger.info('[initParamData] started\n')

    let KEY
    const { decryptFile } = require('./fetchPrivateKey')
    if(process.argv[2]) {
        KEY = Buffer.from(process.argv[2], "utf8");      
    }
    else {
        KEY = Buffer.from('ahgifdkfwkfsufab', "utf8");
    }
    const walletData = await decryptFile(KEY, "node-output.txt");
    walletKeys = JSON.parse(walletData)
    // for(let i = 0 ; i < N_WALLET; i ++) {
    //     console.log(`public key of ${i}th wallet: ${walletKeys.wallets[i].public_key}`)
    // }
    let paramsData = null
    let params = null
    try {
        paramsData = fs.readFileSync(process.env.PARAMS_FILENAME)
        params = JSON.parse(paramsData)
    }
    catch { }

    if (!paramsData || !params) {

        let data = {
            "enable_buy_bot": "true",
            "eth_limit": "0.25",
            "amount_div_factor": "1",
            "blackList": {
                "nameBlackList": [
                            "baby",
                            "mini"
                ],
                "contractBlackList": [
                            "cointoken"
                ]
            }
        }
        paramsData = JSON.stringify(data)
        fs.writeFileSync(process.env.PARAMS_FILENAME, paramsData)
    }
    process.env.PARAMS_DATA = paramsData

    logger.info('[initParamData] ended\n')

}

module.exports = async function () {


    //await _botBuy("0x2e3f5c10af3b7c2746e5f5964c02eab69d6973bf", 1, 100)
    //await swapETHForExactTokens(params.wallets[0].private_key, params.wallets[0].public_key, "0x2e3f5c10af3b7c2746e5f5964c02eab69d6973bf", 100)
    // let receipt = await approveUniswap(params.wallets[4].private_key, params.wallets[4].public_key, "0x111111111117dc0aa78b770fa6a738034120c302")
    // console.log(receipt)
    // return
    //sellToken(4,0,'0x111111111117dC0aa78b770fA6A738034120C302')
    // let gasData = {
    //         gas: 315158,
    //         maxFeePerGas: 199321973153,
    //         maxPriorityFeePerGas: 1500000000 
    //     }
    // for(let i = 0 ; i < 3 ; i ++) { 
    //     approveUniswap(params.wallets[i].private_key, params.wallets[i].public_key, '0xbea0937dfa85dfc47d33846c5f95f8f7f8c9a438')
    
    // }
    //await approveUniswap(params.wallets[0].private_key, params.wallets[0].public_key, '0x111111111117dc0aa78b770fa6a738034120c302')

    //swapExactTokensForETH(params.wallets[1].private_key, params.wallets[1].public_key, '0x111111111117dc0aa78b770fa6a738034120c302', , gasData )
    //await readTokenData();
    fetchPool();
    //await removeRowFromDB('2341234')
    // await readTokenData()
    // console.log('read data finished\n')
    // console.log('tokenData.lengh',Object.keys(tokenData).length)
    // for(let i = 0 ; i < Object.keys(tokenData).length ; i ++) {
    //     if(i % 5 == 4)  {
    //         removeRowFromDB(Object.keys(tokenData)[i])
    //     }
    // }
}