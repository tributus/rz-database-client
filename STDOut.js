module.exports = {
  initialize: c => new (function STDOut(s) {
    const settings = s || { logLevel: 'debug' };
    settings.logLevel = settings.logLevel || 'debug';
    const logLevels = {
      debug: 0,
      info: 1,
      warning: 2,
      error: 3,
      none: 4,
    };

    const terminalColors = {
      red: '\x1b[31m%s\x1b[0m',
      green: '\x1b[32m%s\x1b[0m',
      yellow: '\x1b[33m%s\x1b[0m',
      blue: '\x1b[34m%s\x1b[0m',
      white: '\x1b[37m%s\x1b[0m',
      magenta: '\x1b[35m%s\x1b[0m',
      cyan: '\x1b[36m%s\x1b[0m',
    };

    const getColor = color => (settings.disableColors) ? '' : terminalColors[color];

    const printErrObject = (err) => {
      console.log(getColor('red'), `\nmessage:\n${err.message}\n\nstack trace:\n${err.stack}\n`); // eslint-disable-line no-console
    };

    const printObjects = (list) => {
      list.forEach((element) => {
        try {
          if (element instanceof Error) {
            printErrObject(element);
          } else {
            console.log(getColor('white'), `\n${JSON.stringify(element, Object.getOwnPropertyNames(element), '  ')}\n`); // eslint-disable-line no-console
          }
        } catch (e) {
          console.log(getColor('white'), `\n${element}\n`); // eslint-disable-line no-console
        }
      });
    };

    const printString = (escape, tag, list) => {
      console.log(escape, tag, new Date().toLocaleString(), '-', list.reduce((ant, at) => `${ant} ${at}`)); // eslint-disable-line no-console
    };

    const print = (escape, tag, ...args) => {
      const argsText = args[0].filter(o => typeof o === 'string');
      const argsObj = args[0].filter(o => typeof o === 'object');
      if (argsText && argsText.length > 0) printString(getColor(escape), tag, argsText);
      if (argsObj && argsObj.length > 0) printObjects(argsObj);
    };

    // loglevel 0
    this.debug = (...args) => {
      if (logLevels[settings.logLevel] === 0) {
        print('blue', '[DBG]', args);
      }
    };

    // loglevel 1
    this.info = (...args) => {
      if (logLevels[settings.logLevel] <= 1) {
        print('green', '[INF]', args);
      }
    };

    // loglevel 2
    this.warn = (...args) => {
      if (logLevels[settings.logLevel] <= 2) {
        print('yellow', '[WRN]', args);
      }
    };

    // loglevel 3
    this.error = (...args) => {
      if (logLevels[settings.logLevel] <= 3) {
        print('red', '[ERR]', args);
      }
    };

    this.enableColors = () => {
      settings.disableColors = false;
    };

    this.disableColors = () => {
      settings.disableColors = true;
    };
  })(c),
};
