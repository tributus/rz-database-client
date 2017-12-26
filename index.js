const postgres = require('./postgres');

module.exports = {
  postgres: postgres.getInterface,
};
