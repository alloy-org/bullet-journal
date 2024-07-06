(() => {
  // lib/plugin.js
  var plugin = {
    // --------------------------------------------------------------------------------------
    constants: {
      DEFAULT_NOTE_DATA_NAME: "Five Question Data",
      DEFAULT_NOTE_DATA_TAGS: ["daily-jots/five-questions"],
      TABLE_SECTION_NAME: `"Five Question" Daily Entries`,
      SETTING_KEY_NOTE_DATA: "Name of note where table is recorded",
      SETTING_KEY_DATE_FORMAT: "Date format, see plugin documentation"
    },
    // --------------------------------------------------------------------------
    // https://www.amplenote.com/help/developing_amplenote_plugins#dailyJotOption
    dailyJotOption: {
      "Five questions": {
        async run(app) {
          const note = await this._ensureDailyFiveQuestionNote(app);
          await this._visitDailyFiveQuestionNote(app, note);
          await this._queryRecordMoodLevel(app);
        },
        async check(app) {
          const note = await this._fetchDataNote(app);
          if (!note)
            return false;
          const tableMarkdown = await this._tableData(app, note, this.constants.TABLE_SECTION_NAME);
          if (!tableMarkdown)
            return false;
          const todayString = (/* @__PURE__ */ new Date()).toLocaleDateString();
          return !tableMarkdown.includes(todayString);
        }
      }
    },
    // --------------------------------------------------------------------------------------
    async _queryRecordMoodLevel(app) {
      const noteDataName = await this._fetchNoteDataName(app);
      const moodOptions = [-2, -1, 0, 2, 2].map((value) => ({ value, label: value }));
      const result = await app.prompt("Today will be remembered as", { inputs: [
        { label: "Frivolous/terrible (-2) to successful/wonderful (+2)", type: "radio", options: moodOptions },
        { label: "Factors contributing to this rating?", type: "text" }
      ] });
      const lifeDataNote = await this._fetchDataNote(app, { noteDataName });
      await this._persistData(app, lifeDataNote, this.constants.TABLE_SECTION_NAME, result);
    },
    // --------------------------------------------------------------------------------------
    async _ensureDailyFiveQuestionNote(app) {
    },
    // --------------------------------------------------------------------------------------
    async _visitDailyFiveQuestionNote(app, note) {
    },
    // --------------------------------------------------------------------------------------
    async _persistData(app, note, sectionName, result) {
      let existingTable = await this._tableData(app, note, sectionName);
      if (!existingTable) {
        await app.insertNoteContent(note, `# ${sectionName}
`);
        existingTable = "";
      }
      ;
      let tableMarkdown = `# ${sectionName}
`;
      tableMarkdown += `| **Date** | **Day Rating** | **Precipitating events** |
| --- | --- | --- |
`;
      tableMarkdown += `| [[${(/* @__PURE__ */ new Date()).toLocaleString()}]] | ${result[0]} | ${result[1]} |
`;
      tableMarkdown += existingTable;
      await app.replaceNoteContent(note, tableMarkdown, { heading: { text: sectionName, level: 2 } });
    },
    // --------------------------------------------------------------------------------------
    async _tableData(app, note, sectionName) {
      const content = await app.getNoteContent(note);
      let existingTable = "";
      if (content.includes(`# ${sectionName}`)) {
        existingTable = await this._sectionContent(content, sectionName);
        if (existingTable?.length) {
          const tableRows = existingTable.split("\n");
          while (tableRows.length) {
            const row = tableRows.shift();
            if (row.includes("**Date**")) {
              break;
            }
          }
          return tableRows.join("\n");
        }
      }
    },
    // --------------------------------------------------------------------------------------
    async _fetchDataNote(app, { noteDataName = null } = {}) {
      if (this._noteHandle)
        return this._noteHandle;
      noteDataName = noteDataName || await this._fetchNoteDataName(app);
      const existingNote = await app.findNote({ name: noteDataName });
      if (existingNote) {
        this._noteHandle = existingNote;
        return existingNote;
      }
      const note = await app.createNote(noteDataName, this.constants.DEFAULT_NOTE_DATA_TAGS);
      this._noteHandle = note;
      return note;
    },
    // --------------------------------------------------------------------------------------
    async _fetchNoteDataName(app) {
      let noteDataName = await app.settings[this.constants.NOTE_DATA_SETTING_KEY];
      if (!noteDataName) {
        const result = await app.prompt(
          `Enter the name of the note in which you'd like to record life data (default is "${this.constants.DEFAULT_NOTE_DATA_NAME}")`,
          { inputs: [{ type: "text" }] }
        );
        const noteName = result[0] || this.constants.DEFAULT_NOTE_DATA_NAME;
        noteDataName = noteName;
        await app.setSetting(this.constants.NOTE_DATA_SETTING_KEY, noteDataName);
      }
      return noteDataName;
    },
    // --------------------------------------------------------------------------------------
    // Return all of the markdown within a section that begins with `sectionHeadingText`
    // `sectionHeadingText` Text of the section heading to grab, with or without preceding `#`s
    // `depth` Capture all content at this depth, e.g., if grabbing depth 2 of a second-level heading, this will return all potential h3s that occur up until the next h1 or h2
    _sectionContent(noteContent, headingTextOrSectionObject) {
      console.debug(`_sectionContent()`);
      let sectionHeadingText;
      if (typeof headingTextOrSectionObject === "string") {
        sectionHeadingText = headingTextOrSectionObject;
      } else {
        sectionHeadingText = headingTextOrSectionObject.heading.text;
      }
      try {
        sectionHeadingText = sectionHeadingText.replace(/^#+\s*/, "");
      } catch (err) {
        if (err.name === "TypeError") {
          throw new Error(`${err.message} (line 1054)`);
        }
      }
      const { startIndex, endIndex } = this._sectionRange(noteContent, sectionHeadingText);
      return noteContent.slice(startIndex, endIndex);
    },
    // --------------------------------------------------------------------------------------
    // Return {startIndex, endIndex} where startIndex is the index at which the content of a section
    // starts, and endIndex the index at which it ends.
    _sectionRange(bodyContent, sectionHeadingText) {
      console.debug(`_sectionRange`);
      const sectionRegex = /^#+\s*([^#\n\r]+)/gm;
      const indexes = Array.from(bodyContent.matchAll(sectionRegex));
      const sectionMatch = indexes.find((m) => m[1].trim() === sectionHeadingText.trim());
      if (!sectionMatch) {
        console.error("Could not find section", sectionHeadingText, "that was looked up. This might be expected");
        return { startIndex: null, endIndex: null };
      } else {
        const level = sectionMatch[0].match(/^#+/)[0].length;
        const nextMatch = indexes.find((m) => m.index > sectionMatch.index && m[0].match(/^#+/)[0].length <= level);
        const endIndex = nextMatch ? nextMatch.index : bodyContent.length;
        return { startIndex: sectionMatch.index + sectionMatch[0].length + 1, endIndex };
      }
    }
  };
  var plugin_default = plugin;
})();
