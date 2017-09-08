module.exports = {
  getInterface:function(){
    return function(config){
      return new (function(config){
        var $this = this;
        var connection = config.connection;
        var logLevel = config.logLevel || "debug"
        var baseQueryDir = config.queriesFolder || './queries/';
        var pg = require('pg');
        var fs = require('fs');
        var path = require("path");
        var sqlCache = {};

        var displayLog = function() {
          console.log(Array.prototype.slice.call(arguments));
        }

        var displayError = function(){
          console.error(Array.prototype.slice.call(arguments));
        }

        var displayWarning = function(){
          console.warn(Array.prototype.slice.call(arguments));
        }

        
        var pool = new pg.Pool(connection);
        pool.on('error', function (err, client) {
          displayError('idle client error', err.message, err.stack)
        });

        var resolveQuery = function (queryString,callback) {
          //displayLog("resolving query for ", queryString);
          if(queryString.substring(0,3)=="fs:"){
            readFile(path.join(baseQueryDir,queryString.substring(3)),callback);
          }
          else{
            callback(queryString);
          }
        };

        var readFile = function (file,callback) {
          //displayLog("retrieving query content for ", file);
          if (sqlCache[file]) {
            callback(sqlCache[file]);
          } else {
            fs.readFile(file, "utf8", function(error, data) {
              if (!data) {
                displayLog("resolucao da query em " + file + " nao retornou conteudo da query");
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

        var sanitizeSqlTemplate = function(sql) {
          return sql; // (sql || "").replace(/(\n)+/g, " ").replace(/(\t)+/g, " ");
        }

        //impl
        var impl = {
          getSQLQuery: function (fname,callback) {
            readFile(baseQueryDir + fname,callback);
          },
          findAll: function (queryPath, params, success_callback, error_callback) {
            success_callback = success_callback || function(){};
            error_callback = error_callback || function(){};

            resolveQuery(queryPath, function (queryText) {
              var results = [];
              pool.connect(function (err, client, done) {
                if (err) {
                  displayLog(err);
                  error_callback({ error: "DATABASE_CONNECTION_ERROR" }, err);
                }
                else {
                  var query = client.query(new pg.Query(queryText, params));
                  query.on('row', function (row) {
                    results.push(row);
                  });
                  query.on('end', function () {
                    done();
                    success_callback(results);
                  });
                  query.on('error', function (err) {
                    done();
                    error_callback({ error: "GET_DATA_ERROR", query: query },err);
                    displayError(err);
                  });
                }

              });
            });
          },
          findOne: function (queryPath, params, success_callback, error_callback) {
            success_callback = success_callback || function(){};
            error_callback = error_callback || function(){};
            resolveQuery(queryPath, function (queryText) {
              var result = undefined;
              pool.connect(function (err, client, done) {

                if (err) {
                  displayLog(err);
                  error_callback({ error: "DATABASE_CONNECTION_ERROR" }, err);
                }
                else {
                  var query = client.query(new pg.Query(queryText, params));
                  query.on('row', function (row) {
                    result = row;
                  });
                  query.on('end', function () {
                    done();
                    success_callback(result);
                  });
                  query.on('error', function (err) {
                    displayError("DB_ERROR: " + err);
                    done();
                    error_callback({ error: "GET_DATA_ERROR" }, err);
                  });
                }

              });
            });
          },
          executeNonQuery: function (queryPath, params, success_callback, error_callback) {
            success_callback = success_callback || function(){};
            error_callback = error_callback || function(){};

            resolveQuery(queryPath, function (queryText) {
              pool.connect(function (err, client, done) {
                if (err) {
                  displayLog(err);
                  error_callback({ error: "DATABASE_CONNECTION_ERROR" }, err);
                }
                else {
                  var query = client.query(new pg.Query(queryText, params));
                  query.on('end', function (result) {
                    done();
                    success_callback(result.rowCount);
                  });
                  query.on('error', function (err) {
                    done();
                    if (err.code == 23505) {
                      error_callback({ error: "UNIQUE_VIOLATION" }, err);
                    }
                    else {
                      error_callback({ error: "SET_DATA_ERROR" }, err);
                    }
                  });
                }
              });
            });
          }
        };        
        //interface
        this.getSQLQuery = impl.getSQLQuery;
        this.findAll = impl.findAll;
        this.findOne = impl.findOne;
        this.executeNonQuery = impl.executeNonQuery;


      })(config)
    }
  }
}