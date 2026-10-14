// js/config.js
// Everything you may want to change lives here.

export const CONFIG = {
  // Nickname of the student. Must be on the allowlist in the Apps Script.
  NICKNAME: 'Zaim',

  // Secret token, must match the token in the Apps Script.
  TOKEN: '140514',

  // Google Apps Script web app URL. Fill this in after you deploy the script.
  // Example: 'https://script.google.com/macros/s/AKfy..../exec'
  ENDPOINT: '',

  // No countdown timer is shown. These values are only used to flag answers.
  SLOW_MS: 10000,      // a correct answer slower than this marks the topic as "pelan"
  GUESS_MS: 2000,      // answer faster than this is flagged as possibly a guess
  TOO_LONG_MS: 30000,  // answer slower than this is flagged as suspiciously slow

  QUESTIONS_PER_TOPIC: 2,   // diagnostic mode: 2 questions per topic (24 topics = 48)
  PRACTICE_LENGTH: 10,      // practice mode: questions per session
  NON_DIRECT_SHARE: 0.2,    // at least this share of questions is not a plain calculation

  SOUND_START_ON: true,     // sound effects on by default, the student can mute
};
