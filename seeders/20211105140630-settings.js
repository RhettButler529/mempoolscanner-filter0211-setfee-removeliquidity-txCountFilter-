'use strict';

module.exports = {
    up: async(queryInterface, Sequelize) => {
        /**
         * Add seed commands here.
         *
         * Example:
         * await queryInterface.bulkInsert('People', [{
         *   name: 'John Doe',
         *   isBetaMember: false
         * }], {});
         */
        return queryInterface.bulkInsert('settings', [{
                id: 'filter_time',
                data: 4,
            },
            {
                id: 'min_holder_count',
                data: 15,
            },
            {
                id: 'min_init_pool',
                data: 7,
            },
            {
                id: 'sushi_filter_time',
                data: 4,
            },
            {
                id: 'sushi_min_holder_count',
                data: 15,
            },
            {
                id: 'sushi_min_init_pool',
                data: 7,
            },
        ], {});
    },

    down: async(queryInterface, Sequelize) => {
        /**
         * Add commands to revert seed here.
         *
         * Example:
         * await queryInterface.bulkDelete('People', null, {});
         */
        return queryInterface.bulkDelete('settings', null, {});

    }
};