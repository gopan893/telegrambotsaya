'use strict';

const profiles = new Map();

function getProfile(key) {
  if (!key) return null;
  const entry = profiles.get(String(key));
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function setProfile(key, data) {
  if (!key) throw new Error('key is required');
  profiles.set(String(key), JSON.parse(JSON.stringify(data)));
}

function listProfiles() {
  const out = {};
  for (const [key, val] of profiles) {
    out[key] = JSON.parse(JSON.stringify(val));
  }
  return out;
}

function clearAll() {
  profiles.clear();
}

module.exports = {
  getProfile,
  setProfile,
  listProfiles,
  clearAll
};
