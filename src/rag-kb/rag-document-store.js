'use strict';

const docs = new Map();

function addDocument(doc) {
  const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    title: doc.title || 'Untitled',
    content: doc.content || '',
    source: doc.source || 'manual',
    type: doc.type || 'text',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    metadata: doc.metadata || {},
    chunkCount: doc.chunkCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  docs.set(id, entry);
  return entry;
}

function getDocument(docId) {
  return docs.get(String(docId)) || null;
}

function updateDocument(docId, updates) {
  const existing = docs.get(String(docId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: docId, updatedAt: new Date().toISOString() };
  docs.set(docId, updated);
  return updated;
}

function removeDocument(docId) {
  return docs.delete(String(docId));
}

function listDocuments(filter = {}) {
  let arr = Array.from(docs.values());
  if (filter.type) arr = arr.filter(d => d.type === filter.type);
  if (filter.source) arr = arr.filter(d => d.source === filter.source);
  if (filter.tag) arr = arr.filter(d => d.tags.includes(filter.tag));
  if (filter.query) {
    const q = filter.query.toLowerCase();
    arr = arr.filter(d => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q));
  }
  return arr;
}

function getDocumentCount() {
  return docs.size;
}

function resetStore() {
  docs.clear();
}

module.exports = { addDocument, getDocument, updateDocument, removeDocument, listDocuments, getDocumentCount, resetStore };
