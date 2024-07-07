import { jest } from "@jest/globals"
import { NOTE_OPTION_NAME } from "./constants/misc"
import { DEFAULT_NOTE_NAME_DATA, DEFAULT_NOTE_NAME_GRATITUDE, DEFAULT_NOTE_NAME_HIGHLIGHTS,
  DEFAULT_NOTE_NAME_LEARNING } from "./constants/note-names"
import { FIVE_QUESTION_MARKDOWN } from "./five-question-markdown"
import { mockAppWithContent, mockPlugin } from "./test-helpers.js"

// --------------------------------------------------------------------------------------
describe("This here plugin", () => {
  const plugin = mockPlugin();
  plugin.constants.isTestEnvironment = true;

  it("should run a test", async () => {
    const { app, note } = mockAppWithContent(`To be, or not to be, that is the cool question`);
    await plugin.noteOption[NOTE_OPTION_NAME](app, note.uuid);
    for (const noteName of [ DEFAULT_NOTE_NAME_DATA, DEFAULT_NOTE_NAME_GRATITUDE, DEFAULT_NOTE_NAME_HIGHLIGHTS,
        DEFAULT_NOTE_NAME_LEARNING ]) {
      expect(plugin.findNote({ name: noteName })).toBeTruthy();
    }
  })
});
