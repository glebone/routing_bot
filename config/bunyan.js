const bunyan = require('bunyan');

const log = bunyan.createLogger({ name: 'Tenderness' });

module.exports = {
  log,
};
