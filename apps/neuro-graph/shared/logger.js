/**
 * Logger Utility for NeuroGraph
 * 
 * Centralized logging with log levels.
 * In production, debug logs are disabled.
 * 
 * Usage:
 *   logger.info('Message');
 *   logger.warn('Warning');
 *   logger.error('Error');
 *   logger.debug('Debug info'); // Only in development
 */

(function(global) {
  const LOG_LEVEL = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };

  // Set log level based on environment
  const isProduction = global.location && !global.location.hostname.includes('localhost');
  const currentLevel = isProduction ? LOG_LEVEL.WARN : LOG_LEVEL.DEBUG;

  function log(level, levelName, args) {
    if (level < currentLevel) return;
    
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = `[NeuroGraph ${levelName} ${timestamp}]`;
    
    if (level === LOG_LEVEL.ERROR) {
      console.error(prefix, ...args);
    } else if (level === LOG_LEVEL.WARN) {
      console.warn(prefix, ...args);
    } else if (level === LOG_LEVEL.INFO) {
      console.info(prefix, ...args);
    } else if (level === LOG_LEVEL.DEBUG) {
      console.log(prefix, ...args);
    }
  }

  const logger = {
    debug: function(...args) {
      log(LOG_LEVEL.DEBUG, 'DEBUG', args);
    },
    info: function(...args) {
      log(LOG_LEVEL.INFO, 'INFO', args);
    },
    warn: function(...args) {
      log(LOG_LEVEL.WARN, 'WARN', args);
    },
    error: function(...args) {
      log(LOG_LEVEL.ERROR, 'ERROR', args);
    },
    setLevel: function(level) {
      // Allow runtime override if needed
      if (typeof level === 'number' && level >= 0 && level <= 4) {
        currentLevel = level;
      }
    }
  };

  // Export for both browser and Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
  } else {
    global.NeuroGraphLogger = logger;
  }

})(typeof window !== 'undefined' ? window : this);
