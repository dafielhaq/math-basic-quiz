# Apps Script folder

`Code.gs` is the whole server side. It is not part of the web app and it does
not run on GitHub Pages.

To install it, follow `docs/panduan-tutor.md` (section 2) or, in short:

1. Open the progress spreadsheet.
2. Extensions, then Apps Script.
3. Replace the contents of `Code.gs` with this file, then save.
4. Deploy, New deployment, type: Web app, execute as: me, access: anyone.
5. Copy the `/exec` URL into `ENDPOINT` in `js/config.js`.

After later edits, use Deploy then Manage deployments then the pencil icon then
New version. Do not create a second deployment, the URL would change.

`tests/run-appsscript.mjs` runs this file against a fake spreadsheet, so the
sheet logic can be checked without deploying anything.
