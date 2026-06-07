# Habit Tracker

`src/lifeos/habit-tracker.js` provides a lightweight habit tracker.

Supported operations:

- create habit
- update habit
- log daily check-in
- calculate streak
- summarize habits
- suggest gentle adjustment

Habit language must stay supportive:

- missed days should not be framed as failure
- target increases should be gradual
- small habits are preferred over overloaded routines

Habit records are workspace/user scoped and sanitized before storage.
