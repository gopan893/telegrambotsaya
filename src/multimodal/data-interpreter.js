'use strict';

const observability = require('../agents/observability');

/**
 * Data Interpreter (Phase 7)
 * Menangani parsing dan interpretasi data tabular (CSV, TSV, JSON, Spreadsheet).
 * Mengekstrak pola, insight numerik, dan ringkasan data.
 * 
 * CATATAN: Untuk file .xlsx diperlukan pustaka `xlsx` (lazy-loaded).
 * Jika belum terinstall, sistem menggunakan fallback CSV/TSV parsing.
 */

/**
 * Parse CSV / TSV menjadi array of objects
 */
function parseCSV(text, delimiter = ',') {
  if (!text || typeof text !== 'string') return { headers: [], rows: [], rowCount: 0 };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [], rowCount: 0 };

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  // Batasi hingga 200 baris untuk hemat RAM
  const maxRows = Math.min(lines.length, 201);
  for (let i = 1; i < maxRows; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows, rowCount: rows.length, truncated: lines.length > 201 };
}

/**
 * Mencoba parse file Excel (.xlsx) menggunakan pustaka xlsx (lazy load)
 */
function parseExcel(fileBuffer) {
  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (jsonData.length === 0) return { headers: [], rows: [], rowCount: 0 };

    const headers = jsonData[0].map(h => String(h || ''));
    const maxRows = Math.min(jsonData.length, 201);
    const rows = [];

    for (let i = 1; i < maxRows; i++) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = jsonData[i] ? String(jsonData[i][idx] || '') : '';
      });
      rows.push(row);
    }

    return { headers, rows, rowCount: rows.length, sheetName: firstSheet, truncated: jsonData.length > 201 };
  } catch (err) {
    return { headers: [], rows: [], rowCount: 0, error: `Parsing Excel gagal: ${err.message}` };
  }
}

/**
 * Parse JSON terstruktur menjadi representasi tabular
 */
function parseJSON(text) {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const headers = Object.keys(data[0]);
      const maxRows = Math.min(data.length, 200);
      return { headers, rows: data.slice(0, maxRows), rowCount: maxRows, truncated: data.length > 200 };
    }
    // JSON non-tabular: kembalikan sebagai string ringkasan
    return { headers: [], rows: [], rawPreview: JSON.stringify(data, null, 2).substring(0, 2000), rowCount: 0 };
  } catch (err) {
    return { headers: [], rows: [], rowCount: 0, error: `JSON parsing gagal: ${err.message}` };
  }
}

/**
 * Menganalisis pola dan insight dari data tabular
 */
function analyzeDataPatterns(traceId, parsedData) {
  observability.logEvent(traceId, 'DataInterpreter', 'PATTERN_ANALYSIS_START');

  const { headers, rows } = parsedData;
  if (!rows || rows.length === 0) {
    return { insights: ['Data kosong atau tidak dapat dibaca.'], stats: {} };
  }

  const insights = [];
  const stats = {};

  insights.push(`Dataset memiliki ${rows.length} baris dan ${headers.length} kolom.`);
  if (parsedData.truncated) {
    insights.push('⚠️ Data terpotong karena melebihi batas 200 baris. Hasil analisis hanya mencakup sebagian.');
  }

  // Hitung statistik dasar untuk kolom numerik
  for (const h of headers) {
    const values = rows.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
    if (values.length > rows.length * 0.5) {
      // Kolom ini mayoritas numerik
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      stats[h] = { count: values.length, avg: avg.toFixed(2), min, max };
      insights.push(`Kolom "${h}": rata-rata ${avg.toFixed(2)}, min ${min}, max ${max}.`);
    }
  }

  observability.logEvent(traceId, 'DataInterpreter', 'PATTERN_ANALYSIS_COMPLETE', {
    insightCount: insights.length
  });

  return { insights, stats };
}

/**
 * Membuat ringkasan konteks data untuk digabungkan ke pipeline utama
 */
function buildDataContext(traceId, parsedData, analysisResult, fileName) {
  const headerStr = (parsedData.headers || []).join(', ');
  const insightStr = (analysisResult.insights || []).join('\n');

  return {
    contentType: 'spreadsheet',
    fileName: fileName || 'data',
    primaryContent: `Kolom: ${headerStr}\n\n${insightStr}`,
    rowCount: parsedData.rowCount || 0,
    truncated: parsedData.truncated || false,
    extractedAt: Date.now()
  };
}

module.exports = {
  parseCSV,
  parseExcel,
  parseJSON,
  analyzeDataPatterns,
  buildDataContext
};
