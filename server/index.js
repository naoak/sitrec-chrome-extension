var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var api = require('./api');

app.use(bodyParser.json({limit: '50mb'}));

app.use('/api', api());

app.listen(8080);
