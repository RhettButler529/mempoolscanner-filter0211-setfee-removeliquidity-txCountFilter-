const Sequelize = require('sequelize');

module.exports = function(sequelize) {
    const setting = sequelize.define('settings', {
        id: {
            primaryKey: true,
            type: Sequelize.STRING,
            unique: true,
        },
        data: {
            type: Sequelize.INTEGER,
        },
    }, {
        timestamp: true
    });

    setting.upsert = (values, condition) => (
        setting.findOne({ where: condition })
        .then((obj) => {
            if (obj) {
                return obj.update(values);
            }
            return setting.create(values);
        })
    );

    return setting;
};