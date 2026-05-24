'use strict';

const SECRET_PATTERN = /(token|api[_-]?key|secret|password|authorization|bearer)\s*[:=]\s*([^\s,'"{}]+)/gi;

function redact(value) {
  if (value === null || value === undefined) return value;
  const text = typeof value === 'string' ? value : safeStringify(value);
  return text.replace(SECRET_PATTERN, '$1=***');
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function createLogger(scope = 'app') {
  function write(level, args) {
    const line = [
      new Date().toISOString(),
      level.toUpperCase(),
      `[${scope}]`,
      ...args.map(redact)
    ];

    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(...line);
  }

  return {
    child(name) {
      return createLogger(`${scope}:${name}`);
    },
    info(...args) {
      write('info', args);
    },
    warn(...args) {
      write('warn', args);
    },
    error(...args) {
      write('error', args);
    },
    debug(...args) {
      if (process.env.LOG_LEVEL === 'debug') write('debug', args);
    }
  };
}

module.exports = {
  createLogger,
  redact
};
