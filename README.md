# Math basic quiz (Latihan Matematika Dasar)

A small offline-first quiz web app for one grade 7 student in Indonesia.
It trains basic arithmetic, scores every answer, and sends the results to a
Google Sheet where the tutor reads them and plans the offline lesson.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

- App language: Indonesian. Code, comments and file names: English.
- One question per screen, multiple choice only (A to D, sometimes 2 or 3 options).
- Works offline after the first load. Answers are stored on the phone first, then sent.

## Files

```
index.html              the shell, all screens are drawn by js/ui.js
manifest.webmanifest    makes it installable on Android
sw.js                   service worker, makes it work offline
css/style.css           all styling
js/config.js            nickname, token, endpoint, timings, session sizes
js/topics.js            the 24 question generators and the question types
js/quiz.js              building a session and scoring it
js/store.js             phone storage and the send queue
js/ui.js                the screens, as HTML strings
js/app.js               the flow and all click handling
tests/                  automated checks, run with node
apps-script/Code.gs     the Google Apps Script that receives the rows
docs/                   guide for the tutor and the error tag list
```

## Run it locally

```
python -m http.server 8765
```

Then open http://localhost:8765/ in a browser.

## Tests

```
npm test
```

Three suites, no test framework, no dependencies:

- `tests/run-generators.mjs` builds 1000 questions per topic per question type
  (67 000 questions) and checks unique options, one correct option, the correct
  option in a changing position, error tags on every wrong option, and no
  English decimal point. It also recomputes the right answer from the question
  text for the topics where that is possible by machine.
- `tests/run-session.mjs` checks a diagnostic session has 24 questions (1 per
  topic), no repeated question, at least 20 percent of questions are not a plain
  calculation, all four question types appear, practice mode puts weak topics
  first, and the weak / medium / strong rule works.
- `tests/run-appsscript.mjs` runs `apps-script/Code.gs` against a fake
  spreadsheet using rows produced by the real app code, and checks the written
  rows, the token check, the nickname allowlist, the hourly rate limit, all six
  summary tabs, and the tutor page (served only with the right key, plain words
  instead of mistake codes, the chart, and the topic tiles). It writes a preview
  of the page to the temp folder so it can be looked at in a browser.

## The tutor page

The same script also serves one page for the tutor: totals, an accuracy chart
per session, the 24 topics in the same colours the student sees, and a "teach
this next" card. The numbers come from the same rows as the summary tabs, so
the page and the sheet cannot disagree.

The page is served by a second deployment of the same script, with access
"only myself", so Google handles the login. A key in the address
(`?tutor=...`, set in `DASHBOARD_KEY`) is a second lock. Without the key the
endpoint answers with a short json message instead.

`doGet` also answers `?action=health` and `?action=metrics` (the second one
needs the key).

## How the data flows

1. The student answers a question. The app stores one row in the phone
   (`localStorage`, key `mq_queue_v1`), so nothing is lost if the app closes.
2. When there is internet, the app posts all waiting rows to the Apps Script
   web app in one request, with the token in the body.
3. The script checks the token, checks the nickname against the allowlist, stops
   accepting rows after 200 per hour (the rest stay on the phone), writes the
   accepted rows to the `Data` tab, and counts refused rows in the `Rejected` tab.
4. After every accepted write the script rebuilds the summary tabs:
   `Sessions`, `Topics`, `Totals`, `Progress`, `Tutor`.

Rows older than a week are dropped by the app. The queue is capped at 800 rows.

## Changing things

- Nickname, token, endpoint, question counts and timing rules: `js/config.js`.
- Secret token and nickname allowlist in the script: top of `apps-script/Code.gs`.
- A new question type or topic: add a generator to `js/topics.js`, then run
  `npm test`. A topic needs an entry in `MEANING` (all topics have one) and may
  add `firstStep` and `mistake` builders.
- Styling: `css/style.css`.
- After changing app files, bump `VERSION` in `sw.js` so phones pick it up.

## Notes and known limits

- The app and the endpoint are public. The defence is the token, the allowlist,
  the hourly rate limit and a restricted Google Sheet. Anyone who opens the page
  can read the token, so keep the sheet itself private.
- The rate limit is counted over the whole sheet for the last hour, so it is a
  simple scan of the `Waktu` column. Fine for a few thousand rows.
- The summary tabs are rebuilt on every accepted write. If the Data tab ever
  grows past a few tens of thousands of rows, move `rebuildMetrics` to a time
  driven trigger instead.
- The `Progress` tab chart is created by the script. If the account refuses
  charts, the numbers are still written.
