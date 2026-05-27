'use strict';

const { createStorageManager } = require('./storage-manager');
const { createPostgresStore } = require('./postgres-store');
const { createRedisStore } = require('./redis-store');
const database = require('./database');
const migrations = require('./migrations');

module.exports = {
  createStorageManager,
  createPostgresStore,
  createRedisStore,
  database,
  migrations
};
