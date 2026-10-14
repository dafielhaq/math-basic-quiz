# Apps Script folder

`Code.gs` is the whole server side. It is not part of the web app and it does
not run on GitHub Pages. It does two jobs:

- it receives the answered questions from the phone (`doPost`), and
- it serves the tutor summary page (`doGet`, with the key in `DASHBOARD_KEY`).

To install it, follow `docs/panduan-tutor.md` (section 2 for the endpoint,
section 7 for the tutor page) or, in short:

1. Open the progress spreadsheet.
2. Extensions, then Apps Script.
3. Replace the contents of `Code.gs` with this file, then save.
4. Deploy, New deployment, type: Web app, execute as: me, access: anyone.
5. Copy the `/exec` URL into `ENDPOINT` in `js/config.js`.
6. For the tutor page, add a second deployment of the same code with access
   "only myself", and bookmark its URL with `?tutor=<the key>`.

After later edits, use Deploy then Manage deployments then the pencil icon then
New version. Do not create a second public deployment, the app URL would change.

`tests/run-appsscript.mjs` runs this file against a fake spreadsheet, so the
sheet logic can be checked without deploying anything.
