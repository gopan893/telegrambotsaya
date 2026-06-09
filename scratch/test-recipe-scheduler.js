'use strict';

const { recipeScheduler } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  recipeScheduler.clearAll();

  // scheduleRecipe
  const s1 = recipeScheduler.scheduleRecipe('recipe_1', '0 8 * * *');
  assert(s1.ok === true, 'scheduleRecipe returns ok');
  assert(s1.scheduleId > 0, 'scheduleRecipe returns scheduleId');

  const s2 = recipeScheduler.scheduleRecipe('recipe_1', '*/5 * * * *');
  assert(s2.ok === true, 'scheduleRecipe second entry ok');

  const s3 = recipeScheduler.scheduleRecipe('recipe_2', '0 9 * * 1');
  assert(s3.ok === true, 'scheduleRecipe third entry ok');

  // invalid cron
  const bad = recipeScheduler.scheduleRecipe('recipe_1', 'not-a-cron');
  assert(bad.ok === false, 'scheduleRecipe invalid cron fails');
  assert(bad.error === 'Invalid cron expression', 'invalid cron error');

  // getScheduledRecipes
  const all = recipeScheduler.getScheduledRecipes();
  assert(all.length === 3, 'getScheduledRecipes returns 3 schedules');
  assert(all[0].recipeId && all[0].cron, 'schedule items have recipeId and cron');

  // getSchedulesForRecipe
  const forRecipe1 = recipeScheduler.getSchedulesForRecipe('recipe_1');
  assert(forRecipe1.length === 2, 'getSchedulesForRecipe returns 2 for recipe_1');
  assert(forRecipe1.every(s => s.recipeId === 'recipe_1'), 'filtered by recipeId');

  // pauseSchedule
  const paused = recipeScheduler.pauseSchedule(s1.scheduleId);
  assert(paused === true, 'pauseSchedule returns true');
  const schedulesAfterPause = recipeScheduler.getScheduledRecipes();
  const pausedEntry = schedulesAfterPause.find(s => s.scheduleId === s1.scheduleId);
  assert(pausedEntry && pausedEntry.active === false, 'pauseSchedule sets active false');

  // resumeSchedule
  const resumed = recipeScheduler.resumeSchedule(s1.scheduleId);
  assert(resumed === true, 'resumeSchedule returns true');
  const schedulesAfterResume = recipeScheduler.getScheduledRecipes();
  const resumedEntry = schedulesAfterResume.find(s => s.scheduleId === s1.scheduleId);
  assert(resumedEntry && resumedEntry.active === true, 'resumeSchedule sets active true');

  // pause/resume nonexistent
  assert(recipeScheduler.pauseSchedule(999) === false, 'pauseSchedule nonexistent returns false');
  assert(recipeScheduler.resumeSchedule(999) === false, 'resumeSchedule nonexistent returns false');

  // unscheduleRecipe
  const removed = recipeScheduler.unscheduleRecipe(s3.scheduleId);
  assert(removed === true, 'unscheduleRecipe returns true');
  assert(recipeScheduler.getScheduledRecipes().length === 2, 'unscheduleRecipe removes entry');
  assert(recipeScheduler.unscheduleRecipe(999) === false, 'unscheduleRecipe nonexistent returns false');

  // clearAll
  recipeScheduler.clearAll();
  assert(recipeScheduler.getScheduledRecipes().length === 0, 'clearAll removes all schedules');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
