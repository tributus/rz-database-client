const pg = require('pg');
const fs = require('fs');
const path = require('path');
const stdout = require('./STDOut');

module.exports = {
  getInterface: c => new (function PostgrSQLInterface(config) {
    const $this = this;
    this.config = config;
    const connection = config.connection;
    const baseQueryDir = config.queriesFolder || './queries/';
    const sqlCache = {};
    const stdOut = stdout.initialize({ logLevel: config.logLevel });
    const pool = new pg.Pool(connection);

    pool.on('error', (err, client) => {
      stdOut.error('idle client error', err, client);
    });

    const impl = {
      sanitizeSqlTemplate: sql => ($this.config.enableSQLSanitizing) ? (sql || '').replace(/(\n)+/g, ' ').replace(/(\t)+/g, ' ') : sql,
      readFile: file => new Promise((resolve, reject) => {
        if (sqlCache[file]) {
          resolve(sqlCache[file]);
        } else {
          fs.readFile(file, 'utf8', (error, data) => {
            if (!data) {
              stdOut.error(`The query file "${file}" is not found`);
              sqlCache[file] = null;
              reject(error);
            } else {
              data = impl.sanitizeSqlTemplate(data);
              sqlCache[file] = data;
              resolve(data);
            }
          });
        }
      }),
      resolveQuery: queryString => new Promise((resolve, reject) => {
        if (queryString.match(/^(fs:)(.+\.SQL)$/i)) {
          const fileName = path.join(baseQueryDir, queryString.substring(3));
          impl.readFile(fileName)
            .then(data => resolve(data))
            .catch(err => reject(err));
        } else {
          resolve(queryString);
        }
      }),
      findOne: (queryString, params) => new Promise((resolve, reject) => {
        impl.resolveQuery(queryString).then((queryText) => {
          let result;
          pool.connect((err, client, done) => {
            if (err) {
              stdOut.error(err);
              return reject(err);
            }
            const query = client.query(new pg.Query(queryText, params));
            query.on('row', (row) => {
              result = row;
            });
            query.on('end', () => {
              done();
              return resolve(result);
            });
            query.on('error', (qerr) => {
              stdOut.error('DB_ERROR', qerr);
              done();
              return reject(err);
            });
          });
        }).catch(err => reject(err));
      }),
      findAll: (queryString, params) => new Promise((resolve, reject) => {
        impl.resolveQuery(queryString).then((queryText) => {
          const results = [];
          pool.connect((err, client, done) => {
            if (err) {
              stdOut.error(err);
              return reject(err);
            }
            const query = client.query(new pg.Query(queryText, params));
            query.on('row', (row) => {
              results.push(row);
            });
            query.on('end', () => {
              done();
              return resolve(results);
            });
            query.on('error', (qerr) => {
              done();
              stdOut.error(qerr);
              return reject(qerr);
            });
          });
        }).catch(err => reject(err));
      }),
      executeNonQuery: (queryString, params) => new Promise((resolve, reject) => {
        impl.resolveQuery(queryString).then((queryText) => {
          pool.connect((err, client, done) => {
            if (err) {
              stdOut.error(err);
              return reject(err);
            }
            const query = client.query(new pg.Query(queryText, params));
            query.on('end', (result) => {
              done();
              return resolve(result.rowCount);
            });
            query.on('error', (qerr) => {
              done();
              return reject(qerr);
            });
          });
        });
      }),
    };


    // public interface
    this.prepareStatement = async sql => impl.resolveQuery(sql);
    this.findOne = async (query, queryParams) => impl.findOne(query, queryParams);
    this.findAll = async (query, queryParams) => impl.findAll(query, queryParams);
    this.executeNonQuery = async (query, queryParams) => impl.executeNonQuery(query, queryParams);

    stdOut.info('PostgreSQL Client 2.0.0');
  })(c),
};
