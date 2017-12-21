const pg = require('pg');
const fs = require('fs');
const path = require('path');

module.exports = {
  getInterface: () => config => new (() => {
    const connection = config.connection;
    const baseQueryDir = config.queriesFolder || './queries/';
    const sqlCache = {};

    const displayLog = () => {
      console.log(Array.prototype.slice.call(arguments));
    };

    const displayError = () => {
      console.error(Array.prototype.slice.call(arguments));
    };

    const displayWarning = () => {
      console.warn(Array.prototype.slice.call(arguments));
    };

    const pool = new pg.Pool(connection);
    pool.on('error', (err, client) => {
      displayError('idle client error', err.message, err.stack, client);
    });

    const sanitizeSqlTemplate = (sql) => {
      return sql; // (sql || "").replace(/(\n)+/g, " ").replace(/(\t)+/g, " ");
    };

    const readFile = (file, callback) => {
      if (sqlCache[file]) {
        callback(sqlCache[file]);
      } else {
        fs.readFile(file, 'utf8', (error, data) => {
          if (!data) {
            displayWarning('resolucao da query em " + file + " nao retornou conteudo da query');
            sqlCache[file] = null;
            callback(null);
          } else {
            data = sanitizeSqlTemplate(data);
            sqlCache[file] = data;
            callback(data);
          }
        });
      }
    };

    const resolveQuery = (queryString, callback) => {
      if (queryString.substring(0, 3) === 'fs:') {
        readFile(path.join(baseQueryDir, queryString.substring(3)), callback);
      } else {
        callback(queryString);
      }
    };

    // impl
    const impl = {
      getSQLQuery: (fname, callback) => {
        readFile(baseQueryDir + fname, callback);
      },
      findAll: (queryPath, params, success_callback, error_callback) => {
        resolveQuery(queryPath, (queryText) => {
          const results = [];
          pool.connect((err, client, done) => {
            if (err) {
              displayLog(err);
              error_callback({ error: 'DATABASE_CONNECTION_ERROR' }, err);
            } else {
              const query = client.query(new pg.Query(queryText, params));
              query.on('row', (row) => {
                results.push(row);
              });
              query.on('end', () => {
                done();
                success_callback(results);
              });
              query.on('error', (qerr) => {
                done();
                error_callback({ error: 'GET_DATA_ERROR', query: query }, qerr);
                displayError(qerr);
              });
            }
          });
        });
      },
      findOne: (queryPath, params, success_callback, error_callback) => {
        resolveQuery(queryPath, (queryText) => {
          let result;
          pool.connect((err, client, done) => {
            if (err) {
              displayLog(err);
              error_callback({ error: 'DATABASE_CONNECTION_ERROR' }, err);
            } else {
              const query = client.query(new pg.Query(queryText, params));
              query.on('row', (row) => {
                result = row;
              });
              query.on('end', () => {
                done();
                success_callback(result);
              });
              query.on('error', (qerr) => {
                displayError(`DB_ERROR: ${qerr}`);
                done();
                error_callback({ error: 'GET_DATA_ERROR' }, err);
              });
            }
          });
        });
      },
      executeNonQuery: (queryPath, params, success_callback, error_callback) => {
        resolveQuery(queryPath, (queryText) => {
          pool.connect((err, client, done) => {
            if (err) {
              displayLog(err);
              error_callback({ error: 'DATABASE_CONNECTION_ERROR' }, err);
            } else {
              const query = client.query(new pg.Query(queryText, params));
              query.on('end', (result) => {
                done();
                success_callback(result.rowCount);
              });
              query.on('error', (qerr) => {
                done();
                if (err.code === 23505) {
                  error_callback({ error: 'UNIQUE_VIOLATION' }, qerr);
                } else {
                  error_callback({ error: 'SET_DATA_ERROR' }, err);
                }
              });
            }
          });
        });
      },
    };

    // interface
    this.getSQLQuery = impl.getSQLQuery;
    this.findAll = impl.findAll;
    this.findOne = impl.findOne;
    this.executeNonQuery = impl.executeNonQuery;
  })(config),
};
