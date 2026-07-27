'use strict';

function applyFilters(documents, filters = {}) {
  if (!filters || Object.keys(filters).length === 0) return documents;
  return documents.filter(doc => {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'tag' || key === 'tags') {
        const tags = Array.isArray(doc.tags) ? doc.tags : [];
        const filterTags = Array.isArray(value) ? value : [value];
        if (!filterTags.some(t => tags.includes(t))) return false;
      } else if (key === 'type') {
        if (doc.type !== value) return false;
      } else if (key === 'source') {
        if (doc.source !== value) return false;
      } else if (key === 'after' && doc.createdAt) {
        if (new Date(doc.createdAt) < new Date(value)) return false;
      } else if (key === 'before' && doc.createdAt) {
        if (new Date(doc.createdAt) > new Date(value)) return false;
      } else if (key === 'score') {
        if ((doc.score || 0) < value) return false;
      } else if (key in doc) {
        if (doc[key] !== value) return false;
      }
    }
    return true;
  });
}

function buildFilterFromQuery(query) {
  const filters = {};
  const parts = query.match(/@(\w+):([^\s]+)/g) || [];
  for (const part of parts) {
    const [, key, val] = part.match(/@(\w+):([^\s]+)/) || [];
    if (key && val) filters[key] = val;
  }
  return filters;
}

module.exports = { applyFilters, buildFilterFromQuery };
