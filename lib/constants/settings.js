import {
  DEFAULT_NOTE_NAME_GRATITUDE,
  DEFAULT_NOTE_NAME_HIGHLIGHTS,
  DEFAULT_NOTE_NAME_LEARNING,
  DEFAULT_QUESTION_NOTE_TAGS
} from "./note-names.js";

export const SETTING_KEY_NOTE_DATA = "Name of note where table is recorded";
export const SETTING_KEY_DATE_FORMAT = "Date format, see plugin documentation";
export const SETTING_KEY_TAG_APPLIED = `Tag(s) to apply to daily Daily Bullet entries (default "${ DEFAULT_QUESTION_NOTE_TAGS[0] }")`;
export const SETTING_KEY_DATA_TAG_APPLIED = "Tag to apply to data note";
export const SETTING_KEY_GRATITUDE_NOTE = `Name of note that "Gratitude" heading links to (default "${ DEFAULT_NOTE_NAME_GRATITUDE }")`;
export const SETTING_KEY_HIGHLIGHTS_NOTE = `Name of note that "Daily Highlights" heading links to (default "${ DEFAULT_NOTE_NAME_HIGHLIGHTS }")`;
export const SETTING_KEY_LEARNING_NOTE = `Name of note that "What I Learned" heading links to (default "${ DEFAULT_NOTE_NAME_LEARNING }")`;
