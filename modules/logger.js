
const winston = require('winston');
const { dirname } = require('path');

const LOGLEVEL = (process.env.LOGLEVEL || 'debug').toLowerCase();
const appDir = dirname(require.main.filename);

let fileName = new Date().toLocaleDateString('ko-KR').slice(0, -1)

const logTransports = [
  new (winston.transports.Console)({
    timestamp: () => new Date().toISOString(),
    formatter: options => (
      `${options.timestamp()}  ${options.level.toUpperCase()}: ${options.message ? options.message : ''} ${(options.meta && Object.keys(options.meta).length ? `\n\t${JSON.stringify(options.meta)}` : '')}` // eslint-disable-line
    ),
  }),
  new winston.transports.File({ filename: `${appDir}/log/error${fileName}.log`, level: 'error' }),
  new winston.transports.File({ filename: `${appDir}/log/log${fileName}.log` }),
];
exports.logger = winston.createLogger({
  transports: logTransports,
  level: LOGLEVEL,
});
