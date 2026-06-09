'use strict';

function classifyModelTask(input = '', context = {}, services = {}) {
  const text = String(input).toLowerCase();
  const ctx = String(context.purpose || context.type || '').toLowerCase();
  if (/mood|energy|life.?os|private|personal|my.?note/i.test(text) || /private/i.test(ctx)) return 'private_lifeos';
  if (/code|coding|implement|debug|fix|refactor|function|class|module|test/i.test(text) && /heavy|complex|full|large/i.test(text)) return 'coding_heavy';
  if (/code|coding|implement|debug|fix|refactor/i.test(text)) return 'coding_light';
  if (/research|riset|bandingkan|compare|analys|investigasi|teliti/i.test(text)) return 'research';
  if (/docs|dokumentasi|ringkas|summary|rangkum/i.test(text)) return 'docs_summary';
  if (/vision|image|gambar|photo|foto|gambar|ocr/i.test(text)) return 'vision';
  if (/evaluat|evaluasi|asses|score|grade|nilai/i.test(text)) return 'evaluation';
  if (/plan|rencana|strategy|strategi/i.test(text)) return 'planning';
  if (/security|secure|vulnerability|audit/i.test(text)) return 'security_review';
  if (/cost|budget|biaya|murah|ekonomis/i.test(text)) return 'cost_sensitive';
  if (/offline|local|tanpa.internet/i.test(text)) return 'offline_preferred';
  if (/classify|klasifikas|routing|router|intent/i.test(text)) return 'routing_classification';
  return 'simple_chat';
}

function estimateTaskComplexity(input = '', services = {}) {
  const text = String(input).toLowerCase();
  const words = text.split(/\s+/).length;
  if (words > 100 || /heavy|complex|full|complete|seluruh/i.test(text)) return 'high';
  if (words > 30 || /moderate|medium|beberapa|analyze|analisa/i.test(text)) return 'medium';
  return 'low';
}

function detectVisionTask(input = '', services = {}) {
  return /vision|image|gambar|photo|foto|picture|ocr|visual|lihat|gambar/i.test(String(input).toLowerCase());
}

function detectCodingTask(input = '', services = {}) {
  return /code|coding|implement|debug|fix|refactor|function|class|test|buat|bikin|tulis/i.test(String(input).toLowerCase());
}

function detectResearchTask(input = '', services = {}) {
  return /research|riset|bandingkan|compare|teliti|investigate|analisa|analys/i.test(String(input).toLowerCase());
}

function detectPrivateTask(input = '', services = {}) {
  return /mood|energy|life.?os|private|personal|my.?journal|my.?note|rahasia/i.test(String(input).toLowerCase());
}

function detectLowCostTask(input = '', services = {}) {
  const text = String(input).toLowerCase();
  return text.length < 50 || /simple|cepat|murah|quick|cheap|economy|ekonomis/i.test(text);
}

module.exports = { classifyModelTask, estimateTaskComplexity, detectVisionTask, detectCodingTask, detectResearchTask, detectPrivateTask, detectLowCostTask };
