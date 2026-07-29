'use strict';

/**
 * Learning Loop — feedback negatif → analisa → rewrite → commit
 */

const sourceExplorer = require('./source-explorer');
const refactorEngine = require('./refactor-engine');
const gitCommit = require('./git-commit');
const { ROOT } = require('./source-explorer');

/**
 * Proses feedback negatif
 * Cari file relevan → AI analisa kesalahan → fix → commit
 */
async function processNegativeFeedback(userId, userText, botAnswer, services) {
  const results = [];

  //── 1. Analisa feedback ──
  const analysisPrompt = [
    'Seorang user memberi koreksi/kritik terhadap jawaban bot.',
    '',
    `User: "${userText}"`,
    `Jawaban bot sebelumnya: "${botAnswer}"`,
    '',
    'Analisa:',
    '1. Apakah ini bug logika di kode? (kesalahan pola, handler error, logic flaw)',
    '2. Apakah ini gap pengetahuan? (bot gak tahu sesuatu)',
    '3. Apakah ini masalah konfigurasi? (env, settings)',
    '4. Apakah ini masalah prompt/response style?',
    '',
    'Jawab format JSON:',
    '{"type":"bug|knowledge|config|style","summary":"penjelasan singkat","fileHint":"nama file yang relevan atau kosong","codeSnippet":"kode yang salah/kurang atau kosong","fixSuggestion":"saran fix atau kosong"}'
  ].join('\n');

  const analysisRaw = await services.askAI(
    'Kamu adalah debug engineer. Analisa feedback dalam JSON.',
    analysisPrompt,
    { temperature: 0.2, maxTokens: 800 }
  );

  let analysis;
  try {
    analysis = JSON.parse(analysisRaw.replace(/```(?:json)?\s*|\s*```/g, '').trim());
  } catch (_) {
    results.push({ label: '⚠️', ok: false, detail: 'Gagal parse analisis feedback' });
    return { results };
  }

  results.push({ label: '🔍', ok: true, detail: `[${analysis.type}] ${analysis.summary}` });

  if (analysis.type === 'bug' && analysis.fileHint) {
    //── 2. Cari file ──
    const files = sourceExplorer.scanSourceFiles();
    const keyword = analysis.fileHint.replace(/\.js$/i, '').toLowerCase();
    const candidates = files.filter(f => f.name.toLowerCase().includes(keyword) || f.path.toLowerCase().includes(keyword));

    let targetFile = candidates[0]?.path;
    if (!targetFile && analysis.codeSnippet) {
      // Cari by content
      for (const f of files) {
        const data = sourceExplorer.readFileSafe(f.path);
        if (data.ok && data.content.includes(analysis.codeSnippet.slice(0, 60))) {
          targetFile = f.path;
          break;
        }
      }
    }

    if (targetFile) {
      results.push({ label: '📄', ok: true, detail: `Target: ${targetFile}` });

      //── 3. Auto-fix ──
      const issues = refactorEngine.analyzeFile(targetFile);
      const fixResult = await refactorEngine.refactorPipeline(targetFile, services);

      if (fixResult.ok) {
        results.push({ label: '✅', ok: true, detail: 'Auto-fix applied' });

        //── 4. Commit ──
        gitCommit.stageAll(ROOT);
        if (gitCommit.hasChanges(ROOT)) {
          const pushed = gitCommit.commitAndPush(ROOT, `fix: learning loop — ${analysis.summary.slice(0, 50)}`);
          results.push({ label: '📦', ok: true, detail: pushed.pushed ? 'Committed ✅' : 'Committed' });
        }
      } else {
        results.push({ label: '⚠️', ok: false, detail: `Auto-fix gagal: ${fixResult.error || 'unknown'}` });
      }
    } else {
      results.push({ label: '🔍', ok: false, detail: 'Tidak menemukan file relevan untuk di-fix' });
    }
  } else if (analysis.type === 'knowledge') {
    // Gap pengetahuan — catat aja, butuh data external
    results.push({ label: '📝', ok: true, detail: 'Knowledge gap tercatat. Butuh training data tambahan.' });
  } else if (analysis.type === 'style') {
    // Style issue — bisa rewrite prompt
    results.push({ label: '🎨', ok: true, detail: 'Style feedback. Bisa improve response template.' });
  } else {
    results.push({ label: 'ℹ️', ok: true, detail: 'Tidak perlu auto-modify kode.' });
  }

  return { results, analysis };
}

module.exports = {
  processNegativeFeedback
};
