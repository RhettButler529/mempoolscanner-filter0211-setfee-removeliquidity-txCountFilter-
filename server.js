require('dotenv').config();

const config = require('./config');
const dbInitialize = require('./services/dbInitialize');
const cronService = require('./services/cron.service');
const routeInitialize = require('./routes');
const app = require('./app.js');
const { logger } = require('./modules/logger');

function sleeper(ms) {
  return function(x) {
    return new Promise(resolve => setTimeout(() => resolve(x), ms));
  };
}

const init = async () => {
  dbInitialize(app);
  routeInitialize(app);

  if(process.env.NODE_ENV !== 'test') {
    cronService();
  }

  if(process.env.NODE_ENV === 'development') {
    app.server.listen(config.app.port, () => {
      logger.info(`[server] Server listening at port ${config.app.port}`);
    });
  } else {
    app.server.listen(config.app.port, () => {
      logger.info(`[server] SSL server is running at ${config.app.port}`);
    });
  }
};

const preInit = async function() {
  try {
    await sleeper(500);
    init();
  } catch(err) {
    logger.error(`[server] error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    process.exit(1);
  }
};

preInit();

process.on('exit', () => {
  logger.error('[server] About to exit, waiting for remaining connections to complete');
  app.server.close();
});

module.exports = app;
