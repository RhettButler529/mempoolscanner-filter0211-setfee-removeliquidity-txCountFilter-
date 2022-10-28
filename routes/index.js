const apiRouter = require('./api');
const apiV2Router = require('./api_v2');
const monitorRouter = require('./monitor');

module.exports = function(app) {

  app.use('/api/v1', apiRouter);
  app.use('/api/v2', apiV2Router);
  
  // deprecated
  app.use('/api/v1/monitor', monitorRouter);
};
