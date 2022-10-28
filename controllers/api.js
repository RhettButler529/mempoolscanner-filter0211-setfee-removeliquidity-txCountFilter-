/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
const _ = require('lodash');
const models = require('../models');
const config = require("../config");
let updatefConfig = require("../services/filter.js").updateFilterConfig;
const { errorResponse, reducedErrorMessage } = require('../modules/utils');

exports.getParams = async(req, res) => {
    try {
        let filterTimeObj = await models.settings.findByPk('filter_time');
        let timeLimit;
        if (!filterTimeObj) {
            timeLimit = config.timeLimit;
        } else {
            timeLimit = filterTimeObj.data;
        }

        let minHolderCountObj = await models.settings.findByPk('min_holder_count');
        let minHolderCount;
        if (!minHolderCountObj) {
            minHolderCount = config.minHolderCount;
        } else {
            minHolderCount = minHolderCountObj.data;
        }

        let minInitPoolObj = await models.settings.findByPk('min_init_pool');
        let minInitPool;
        if (!minInitPoolObj) {
            minInitPool = config.minInitPool;
        } else {
            minInitPool = minInitPoolObj.data;
        }

        let sushiFilterTimeObj = await models.settings.findByPk('sushi_filter_time');
        let sushiTimeLimit;
        if (!sushiFilterTimeObj) {
            sushiTimeLimit = config.timeLimit;
        } else {
            sushiTimeLimit = sushiFilterTimeObj.data;
        }

        let sushiMinHolderCountObj = await models.settings.findByPk('sushi_min_holder_count');
        let sushiMinHolderCount;
        if (!sushiMinHolderCountObj) {
            sushiMinHolderCount = config.minHolderCount;
        } else {
            sushiMinHolderCount = sushiMinHolderCountObj.data;
        }

        let sushiMinInitPoolObj = await models.settings.findByPk('sushi_min_init_pool');
        let sushiMinInitPool;
        if (!sushiMinInitPoolObj) {
            sushiMinInitPool = config.minInitPool;
        } else {
            sushiMinInitPool = sushiMinInitPoolObj.data;
        }

        return res.status(200).json({ status: true, data: { timeLimit, minHolderCount, minInitPool, sushiTimeLimit, sushiMinHolderCount, sushiMinInitPool } });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};

exports.updateParams = async(req, res) => {
    let { timeLimit, minHolderCount, minInitPool, sushiTimeLimit, sushiMinHolderCount, sushiMinInitPool } = req.query;
    try {

        let filterTimeObj = await models.settings.findByPk('filter_time');
        if (!filterTimeObj) {
            filterTimeObj = await models.settings.create({
                id: 'filter_time',
                data: timeLimit
            });
        } else {
            await filterTimeObj.update({ data: timeLimit });
        }

        let minHolderCountObj = await models.settings.findByPk('min_holder_count');
        if (!minHolderCountObj) {
            minHolderCountObj = await models.settings.create({
                id: 'min_holder_count',
                data: minHolderCount
            });
        } else {
            await minHolderCountObj.update({ data: minHolderCount });
        }

        let minInitPoolObj = await models.settings.findByPk('min_init_pool');
        if (!minInitPoolObj) {
            minInitPoolObj = await models.settings.create({
                id: 'min_init_pool',
                data: minInitPool
            });
        } else {
            await minInitPoolObj.update({ data: minInitPool });
        }

        let sushiFilterTimeObj = await models.settings.findByPk('sushi_filter_time');
        if (!sushiFilterTimeObj) {
            sushiFilterTimeObj = await models.settings.create({
                id: 'sushi_filter_time',
                data: sushiTimeLimit
            });
        } else {
            await sushiFilterTimeObj.update({ data: sushiTimeLimit });
        }

        let sushiMinHolderCountObj = await models.settings.findByPk('sushi_min_holder_count');
        if (!sushiMinHolderCountObj) {
            sushiMinHolderCountObj = await models.settings.create({
                id: 'sushi_min_holder_count',
                data: sushiMinHolderCount
            });
        } else {
            await sushiMinHolderCountObj.update({ data: sushiMinHolderCount });
        }

        let sushiMinInitPoolObj = await models.settings.findByPk('sushi_min_init_pool');
        if (!sushiMinInitPoolObj) {
            sushiMinInitPoolObj = await models.settings.create({
                id: 'sushi_min_init_pool',
                data: sushiMinInitPool
            });
        } else {
            await sushiMinInitPoolObj.update({ data: sushiMinInitPool });
        }

        return res.status(200).json({ status: true });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};


// nameBlackList : [],
// contractBlackList : [],
// minimumLiquidity : 10,
// minimumHolderCount : 10,

exports.updateFilterConfig = async(req, res) => {
    let { nameBlackList, contractBlackList, minimumLiquidity, minimumHolderCount} = req.body;
    const newconfig = { nameBlackList, contractBlackList, minimumLiquidity, minimumHolderCount }
    updatefConfig(newconfig);  
    return res.status(200).json({msg:"update success"})
};

exports.getList = async(req, res) => {
    try {
        const configs = await models.config.findAll({
            order: [
                ['id', 'DESC']
            ]
        });
        const data = configs.map(o => _.omit(o.get(), ['createdAt', 'updatedAt']));

        return res.status(200).json({ status: true, data });
    } catch (err) {
        return errorResponse(res, reducedErrorMessage(err));
    }
};