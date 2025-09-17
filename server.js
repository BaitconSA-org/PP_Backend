const cds = require('@sap/cds');
const express = require('express');
const bodyParser = require('body-parser');

cds.on('bootstrap', app => {
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
});

module.exports = cds.server;
