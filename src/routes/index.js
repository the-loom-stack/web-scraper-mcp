'use strict';

const apiRoutes = require('./api.routes');

function mountRoutes(app) {
  app.use('/api', apiRoutes);
}

module.exports = mountRoutes;
