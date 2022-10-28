const Sequelize = require('sequelize');

module.exports = function(sequelize) {
    const list = sequelize.define('lists', {
        id: {
            primaryKey: true,
            type: Sequelize.INTEGER,
            autoIncrement: true,
        },
        token: {
            type: Sequelize.STRING,
        },
        tokenData: {
            type: Sequelize.STRING,
        },
        fSuccessfulFirstSwap: {
            type: Sequelize.BOOLEAN,
        },
    }, {
        timestamp: true
    });

    list.upsert = (values, condition) => (
        list.findOne({ where: condition })
            .then((obj) => {
                if (obj) {
                    return obj.update(values);
                }
                return list.create(values);
            })
    );

    return list;
};
