'use strict';

const store = require('./memory-intelligence-store');

function detectConflicts(memories, options = {}) {
  if (!Array.isArray(memories) || memories.length < 2) {
    return { conflicts: [], conflictCount: 0, message: 'Need at least 2 memories to detect conflicts' };
  }

  const conflicts = [];
  const keywordConflicts = options.detectKeywordConflicts !== false;
  const temporalConflicts = options.detectTemporalConflicts !== false;
  const semanticConflicts = options.detectSemanticConflicts !== false;

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const memA = memories[i];
      const memB = memories[j];

      if (keywordConflicts) {
        const kwConflict = detectKeywordConflict(memA, memB);
        if (kwConflict) conflicts.push(kwConflict);
      }

      if (temporalConflicts) {
        const tempConflict = detectTemporalConflict(memA, memB);
        if (tempConflict) conflicts.push(tempConflict);
      }

      if (semanticConflicts) {
        const semConflict = detectSemanticConflict(memA, memB);
        if (semConflict) conflicts.push(semConflict);
      }
    }
  }

  const deduped = deduplicateConflicts(conflicts);

  for (const conflict of deduped) {
    store.storeConflictRecord(conflict.id, conflict);
  }

  return {
    conflicts: deduped,
    conflictCount: deduped.length,
    message: deduped.length > 0
      ? `Found ${deduped.length} conflict(s). All require manual resolution.`
      : 'No conflicts detected'
  };
}

function detectKeywordConflict(memA, memB) {
  const contentA = (memA.content || '').toLowerCase();
  const contentB = (memB.content || '').toLowerCase();

  const negationPatterns = [
    /\b(not|never|no|don't|doesn't|isn't|aren't|wasn't|weren't|cannot|can't|won't)\b/,
    /\b(true|false|yes|no|correct|incorrect|right|wrong|always|never)\b/
  ];

  for (const pattern of negationPatterns) {
    const matchA = contentA.match(pattern);
    const matchB = contentB.match(pattern);
    if (matchA && matchB && matchA[0] !== matchB[0]) {
      const termsA = new Set(contentA.split(/\s+/).filter(t => t.length > 3));
      const termsB = new Set(contentB.split(/\s+/).filter(t => t.length > 3));
      let commonTerms = 0;
      for (const term of termsA) {
        if (termsB.has(term)) commonTerms++;
      }
      if (commonTerms >= 2) {
        return {
          id: `conflict_${memA.id}_${memB.id}_keyword`,
          type: 'keyword_conflict',
          memoryA: memA.id,
          memoryB: memB.id,
          detail: `Negation mismatch: "${matchA[0]}" vs "${matchB[0]}"`,
          severity: 'high',
          resolved: false
        };
      }
    }
  }
  return null;
}

function detectTemporalConflict(memA, memB) {
  const contentA = (memA.content || '').toLowerCase();
  const contentB = (memB.content || '').toLowerCase();

  const timePatterns = [
    { pattern: /\b(today|now|current|present)\b/, label: 'present' },
    { pattern: /\b(yesterday|last|previous|ago)\b/, label: 'past' },
    { pattern: /\b(tomorrow|next|future|upcoming)\b/, label: 'future' }
  ];

  const temporalA = timePatterns.filter(tp => tp.pattern.test(contentA)).map(tp => tp.label);
  const temporalB = timePatterns.filter(tp => tp.pattern.test(contentB)).map(tp => tp.label);

  if (temporalA.length > 0 && temporalB.length > 0) {
    const overlap = temporalA.filter(t => temporalB.includes(t));
    if (overlap.length === 0 && temporalA[0] !== temporalB[0]) {
      const termsA = new Set(contentA.split(/\s+/).filter(t => t.length > 3));
      const termsB = new Set(contentB.split(/\s+/).filter(t => t.length > 3));
      let commonTerms = 0;
      for (const term of termsA) {
        if (termsB.has(term)) commonTerms++;
      }
      if (commonTerms >= 2) {
        return {
          id: `conflict_${memA.id}_${memB.id}_temporal`,
          type: 'temporal_conflict',
          memoryA: memA.id,
          memoryB: memB.id,
          detail: `Temporal mismatch: ${temporalA[0]} vs ${temporalB[0]}`,
          severity: 'medium',
          resolved: false
        };
      }
    }
  }
  return null;
}

function detectSemanticConflict(memA, memB) {
  if (memA.sensitivity !== memB.sensitivity && memA.sensitivity !== 'unknown' && memB.sensitivity !== 'unknown') {
    const contentA = (memA.content || '').toLowerCase();
    const contentB = (memB.content || '').toLowerCase();
    const termsA = new Set(contentA.split(/\s+/).filter(t => t.length > 3));
    const termsB = new Set(contentB.split(/\s+/).filter(t => t.length > 3));
    let commonTerms = 0;
    for (const term of termsA) {
      if (termsB.has(term)) commonTerms++;
    }
    if (commonTerms >= 3) {
      return {
        id: `conflict_${memA.id}_${memB.id}_semantic`,
        type: 'semantic_conflict',
        memoryA: memA.id,
        memoryB: memB.id,
        detail: `Sensitivity mismatch: ${memA.sensitivity} vs ${memB.sensitivity}`,
        severity: 'medium',
        resolved: false
      };
    }
  }
  return null;
}

function deduplicateConflicts(conflicts) {
  const seen = new Set();
  return conflicts.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function getUnresolvedConflicts() {
  return store.listConflictRecords({ resolved: false });
}

module.exports = { detectConflicts, getUnresolvedConflicts, detectKeywordConflict, detectTemporalConflict, detectSemanticConflict };
