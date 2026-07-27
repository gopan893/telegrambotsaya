'use strict';

const crypto = require('crypto');
const STORE = {};

function get(key) { return STORE[key] || null; }
function set(key, value) { STORE[key] = value; return value; }
function del(key) { delete STORE[key]; return true; }
function keys() { return Object.keys(STORE); }
function getAll() { return { ...STORE }; }

module.exports = { get, set, del, keys, getAll };
