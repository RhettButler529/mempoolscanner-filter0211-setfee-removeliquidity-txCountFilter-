// const _ = require('lodash');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { getIp } = require('../modules/utils');
const config = require('../config');


const skipPathList = [
  '/api/v1/auth/token',
];
let skipIpList;
try {
  skipIpList = JSON.parse(config.rateLimitSkipIps) || [];
} catch(err) {
  skipIpList = [];
}
/**
 *
 * @param {integer} points
 * @param {integer} duration default 1 mins
 */
const getRateLimiterMemory = (points, duration = 60 * 1) => new RateLimiterMemory(
  {
    points,
    duration,
  },
);
// TODO -- skip function will be added later in needed
const getRateLimiterMiddleware = (rateLimiter, prefix = '', consumePointsFunc = null) => (req, res, next) => {
  const ip = getIp(req);
  const key = `${prefix}${ip}`;
  // const key = req.user ? `${prefix}${req.user.id}` : `${prefix}${getIp(req)}`;

  const pointsToConsume = consumePointsFunc ? consumePointsFunc(req) : 1;

  // check skip list
  if(skipPathList.includes(req.path)) {
    return next();
  }
  if(skipIpList.includes(ip)) {
    return next();
  }
  // skip if test mode
  if(process.env.NODE_ENV === 'test') {
    return next();
  }

  return rateLimiter.consume(key, pointsToConsume)
    .then((rateLimiterRes) => {
      res.header('Retry-After', rateLimiterRes.msBeforeNext / 1000);
      res.header('X-RateLimit-Limit', rateLimiterRes.remainingPoints + rateLimiterRes.consumedPoints); // opts.points
      res.header('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      res.header('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext));

      next();
    })
    .catch((rateLimiterRes) => {
      res.header('Retry-After', rateLimiterRes.msBeforeNext / 1000);
      res.header('X-RateLimit-Limit', rateLimiterRes.remainingPoints + rateLimiterRes.consumedPoints); // opts.points
      res.header('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      res.header('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext));
      res.status(429).send('Too Many Requests');
    });
};

module.exports = {
  statsRateLimiter: getRateLimiterMiddleware(getRateLimiterMemory(1, 3), 'stats_'), // 1 point per 3 seconds
};
