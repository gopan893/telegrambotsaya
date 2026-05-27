'use strict';

const { createStorageManager } = require('./storage-manager');
const { createPostgresStore } = require('./postgres-store');
const { createRedisStore } = require('./redis-store');
const migrations = require('./migrations');

module.exports = {
  createStorageManager,
  createPostgresStore,
  createRedisStore,
  migrations
};
