module.exports = {
    up(queryInterface, Sequelize) {
        return queryInterface.createTable('lists', {
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
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });
    },
    down(queryInterface /* , Sequelize */ ) {
        return queryInterface.dropTable('lists');
    }
};
