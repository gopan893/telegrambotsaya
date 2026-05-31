'use strict';

const { createStorageManager } = require('./storage-manager');
const { createPostgresStore } = require('./postgres-store');
const { createRedisStore } = require('./redis-store');
const { createJsonRepositories } = require('./json-repositories');
const { createPostgresRepositories } = require('./postgres-repositories');
const database = require('./database');
const migrations = require('./migrations');
const schema = require('./schema');

module.exports = {
  createJsonRepositories,
  createPostgresRepositories,
  createStorageManager,
  createPostgresStore,
  createRedisStore,
  database,
  migrations,
  schema
};
