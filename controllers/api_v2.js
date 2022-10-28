/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
const _ = require('lodash');
const models = require('../models');
const config = require("../config");
const { errorResponse, reducedErrorMessage } = require('../modules/utils');
const fs = require('fs');
const { URLSearchParams } = require('url');

exports.updateBlackList = async(req, res) => {


    let { nameBlackList, contractBlackList} = req.body;
    const blackList = { nameBlackList, contractBlackList }
    try {
        let paramsData = process.env.PARAMS_DATA
        let params = JSON.parse(paramsData)
        console.log(params)
        params.blackList = blackList
        console.log(params)
        writeParams(params)
        return res.status(200).json({ blackList: blackList });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }

};

function writeParams(params) {
    let data = JSON.stringify(params)
    process.env.PARAMS_DATA = data
    fs.writeFileSync(process.env.PARAMS_FILENAME, data)      
}

exports.getParams = async(req, res) => {
    try {
        let paramsData = process.env.PARAMS_DATA
        let params = JSON.parse(paramsData)

        if(!paramsData) {
            return res.status(200).json({result: 'No param data!'})
        }

        if(!params) {
            return res.status(200).json({result: 'Invalid param data!'})
        }
    
        return res.status(200).json({...params});
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};

exports.updateEnableBuyBot = async(req, res) => {

    let enable_buy_bot = req.params.value;
    console.log('enable_buy_bot', enable_buy_bot)
    try {
        let paramsData = process.env.PARAMS_DATA
        let params = JSON.parse(paramsData)
        params.enable_buy_bot = enable_buy_bot
        writeParams(params)
        return res.status(200).json({ enable_buy_bot: enable_buy_bot });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};

exports.updateEthLimit = async(req, res) => {

    let eth_limit = req.params.value;
    try {
        let paramsData = process.env.PARAMS_DATA
        let params = JSON.parse(paramsData)
        params.eth_limit = eth_limit
        writeParams(params)
        return res.status(200).json({ eth_limit: eth_limit });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};

exports.updateAmountDivFactor = async(req, res) => {

    let amount_div_factor = req.params.value;
    try {
        let paramsData = process.env.PARAMS_DATA
        let params = JSON.parse(paramsData)
        params.amount_div_factor = amount_div_factor
        writeParams(params)
        return res.status(200).json({ amount_div_factor: amount_div_factor });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};



