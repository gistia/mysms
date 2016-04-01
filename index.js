'use strict';

const _ = require('lodash');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const moment = require('moment');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const port = process.env.PORT || 3030;
const router = express.Router();
const logger = (req, res, next) => {
  console.log('->', `[${req.method}]`, req.path);
  next();
};
const cors = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Request-Method", "*");
  res.header("Access-Control-Allow-Methods", "POST, PUT, DELETE, GET, OPTIONS");
  next();
};

let sequelize;
if (process.env.DATABASE_URL) {
  const url = require('url');
  const db_url = url.parse(process.env.DATABASE_URL);
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect:  'postgres',
    protocol: 'postgres',
    port:     db_url.port,
    host:     db_url.host,
    logging:  true //false
  })
} else {
  sequelize = new Sequelize('mysms', 'fcoury', null, { dialect: 'postgres' });
}

const Message = sequelize.define('messages', {
  from: Sequelize.STRING,
  message: Sequelize.STRING
});

router.post('/receive', (req, res, next) => {
  console.log('req.params', req.params);
  console.log('req.body', req.body);

  if (process.env.SMS_FORWARD_TO) {
    const client = require('twilio')(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
    client.sendMessage({
      from: process.env.SMS_FROM,
      to: process.env.SMS_FORWARD_TO,
      body: req.body.Body
    });
  }

  sequelize.sync().then(() => {
    return Message.create({
      from: req.body.From,
      message: req.body.Body
    });
  });

  res.send('<?xml version="1.0" encoding="UTF-8" ?><Response></Response>');
});

router.get('/', (req, res, next) => {
  Message.findAll({order: [['id', 'DESC']]}).then((messages) => {
    const rows = messages.map(m => {
      // const createdAt = moment(m.createdAt).format('YYYY-MM-DD hh:mm');
      const createdAt = moment(m.createdAt).fromNow();
      return `
        <tr>
          <td><code>${m.from}</code></td>
          <td><code>${m.message}</code></td>
          <td>${createdAt}</td>
        </tr>
      `;
    }).join('');

    const content = `
    <table class="table table-striped table-bordered">
      <thead>
        <tr>
          <th>From</th>
          <th>Message</th>
          <th>Received</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    `

    const html = `
    <!doctype html>
    <html>
      <head>
        <link rel="stylesheet" type="text/css" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css">
        <title>MySMS - Received</title>
      </head>
      <body>
        <nav id="myNavbar" class="navbar navbar-default navbar-inverse" role="navigation">
          <div class="container-fluid">
            <div class="navbar-header">
              <a class="navbar-brand" href="#">MySMS</a>
            </div>
          </div>
        </nav>

        <div class="container-fluid">
          <div class="row">
            <div class="col-xs-12">
              <center><h1>+14243478933</h1></center>

              ${content}
            </div>
          </div>
        </div>
      </body>
    </html>
    `;

    res.send(html);
  });
});

app.use(cors);
app.use(logger);
app.use('/sms', router);
app.use('/', (req, res, next) => res.redirect('/sms'));
app.listen(port);
console.log('Running on port', port);
