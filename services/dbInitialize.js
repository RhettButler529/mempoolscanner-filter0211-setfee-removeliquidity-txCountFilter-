
module.exports = function(app) {
  const models = require('../models'); // eslint-disable-line
  app.set('sequelize', models.sequelize);
  app.set('models', models.sequelize.models);

  models.sequelize.sync()
    .then(() => console.log('Sequelize synced'))
    .catch((error) => {
      console.log(error);
    });
};
