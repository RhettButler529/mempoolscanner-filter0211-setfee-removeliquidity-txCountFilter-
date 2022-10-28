
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');

const app = express();
const cors = require('cors');
const config = require('./config');

app.server = require('http').createServer(app); // eslint-disable-line

// if(process.env.NODE_ENV === 'development') {
//   app.server = require('http').createServer(app); // eslint-disable-line
// } else {
//   const sslOptions = {
//     key: fs.readFileSync('config/cert/backend.key', 'utf8'),
//     cert: fs.readFileSync('config/cert/backend.pem', 'utf8'),
//   };
//   app.server = require('https').createServer(sslOptions, app); //eslint-disable-line
//   http.createServer((req, res) => {
//     res.writeHead(301, { 'Location': 'https://' + req.headers['host'] + req.url }); // eslint-disable-line
//     res.end();
//   });
// }

app.options('*', cors());
app.use(cors());
// Wide-open CORS configuration (change before this is considered production-ready)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  next();
});

app.use(require('morgan')('dev'));
app.use(require('body-parser').urlencoded({ limit: '50mb', extended: true }));
app.use(require('body-parser').json({ limit: '50mb' }));
app.use(require('express-session')({ secret: config.app.secret, resave: true, saveUninitialized: true }));
app.use(require('cookie-parser')());
app.use(require('express-ip')().getIpInfoMiddleware);

app.use(express.static(path.join(__dirname, '/public'))); //eslint-disable-line

module.exports = app;
