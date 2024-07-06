(() => {
  // lib/five-question-markdown.js
  var FIVE_QUESTION_MARKDOWN = `# I am grateful for...
1.  
2. 
3. 

# What would make today great?
* 1. 
* 2. 
* 3. 

# Daily affirmation
* [ ] Some ideas from [TheGoodTrade](https://www.thegoodtrade.com/features/positive-affirmations-morning-routine/)

# Highlights of the day
1. 
2. 
3. 

# What did I learn today?


`;

  // lib/plugin.js
  var plugin = {
    // --------------------------------------------------------------------------------------
    constants: {
      DEFAULT_NOTE_DATA_NAME: "Five Question Data",
      DEFAULT_NOTE_DATA_TAGS: ["daily-jots/five-questions"],
      TABLE_SECTION_NAME: `"Five Question" Daily Entries`,
      SETTING_KEY_NOTE_DATA: "Name of note where table is recorded",
      SETTING_KEY_DATE_FORMAT: "Date format, see plugin documentation",
      SETTING_KEY_TAG_APPLIED: "Tag(s) to apply to daily Five Question entries (default 'daily-jots/five-questions')"
    },
    // --------------------------------------------------------------------------
    // https://www.amplenote.com/help/developing_amplenote_plugins#dailyJotOption
    dailyJotOption: {
      "Five questions": {
        async run(app) {
          const note = await this._ensureDailyFiveQuestionNote(app);
          await this._visitDailyFiveQuestionNote(app, note);
          await this._queryRecordMoodLevel(app, note);
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
    appOption: {
      "Five question entry": async function(app) {
        const note = await this._ensureDailyFiveQuestionNote(app);
        await this._visitDailyFiveQuestionNote(app, note);
        await this._queryRecordMoodLevel(app, note);
      }
    },
    // --------------------------------------------------------------------------------------
    async _ensureDailyFiveQuestionNote(app) {
      const noteName = await this._noteName(app);
      let findArgument = { name: noteName };
      const tagsApplied = await this._noteTagArray(app);
      if (tagsApplied.length) {
        findArgument = { ...findArgument, tags: tagsApplied };
      }
      let note = await app.findNote(findArgument);
      if (note) {
        const firstLine = FIVE_QUESTION_MARKDOWN.split("\n")[0];
        const content = await note.content();
        if (content?.includes(firstLine)) {
          return note;
        }
      } else {
        note = await app.createNote(findArgument.name, findArgument.tags);
      }
      await note.insertContent(FIVE_QUESTION_MARKDOWN);
      return note;
    },
    // --------------------------------------------------------------------------------------
    async _queryRecordMoodLevel(app, fiveQuestionNote) {
      const noteDataTableName = await this._fetchNoteDataName(app);
      const moodOptions = [-2, -1, 0, 2, 2].map((value) => ({ value, label: value }));
      const result = await app.prompt("Today will be remembered as (optional)", { inputs: [
        { label: "Frivolous/terrible (-2) to successful/wonderful (+2)", type: "radio", options: moodOptions },
        { label: "Factors contributing to this rating?", type: "text" }
      ] });
      const dataNote = await this._fetchDataNote(app, { noteDataName: noteDataTableName });
      await this._persistData(app, fiveQuestionNote, dataNote, this.constants.TABLE_SECTION_NAME, result);
    },
    // --------------------------------------------------------------------------------------
    async _noteName(app) {
      const dateSetting = await app.settings[this.constants.SETTING_KEY_DATE_FORMAT];
      if (dateSetting?.length) {
        return `${(/* @__PURE__ */ new Date()).toLocaleString(dateSetting)} Five Questions`;
      } else {
        return `${(/* @__PURE__ */ new Date()).toLocaleString()} Five Questions`;
      }
    },
    // --------------------------------------------------------------------------------------
    async _noteTagArray(app) {
      const tagSetting = await app.settings[this.constants.SETTING_KEY_TAG_APPLIED];
      if (tagSetting?.length) {
        return tagSetting.split(",").map((tag) => tag.trim()).filter((n) => n);
      } else {
        return this.constants.DEFAULT_NOTE_DATA_TAGS;
      }
    },
    // --------------------------------------------------------------------------------------
    async _visitDailyFiveQuestionNote(app, note) {
      const tagArray = await this._noteTagArray(app);
      let navigateUrl;
      if (tagArray?.length) {
        navigateUrl = `https://www.amplenote.com/notes/jots?tag=${tagArray[0]}`;
      } else {
        navigateUrl = `https://www.amplenote.com/notes/${note.uuid}`;
      }
      await app.navigate(note);
    },
    // --------------------------------------------------------------------------------------
    async _persistData(app, dailyQuestionNote, dateTableNote, sectionName, userDayRatingResponse) {
      let existingTable = await this._tableData(app, dateTableNote, sectionName);
      if (!existingTable) {
        await app.insertNoteContent(dateTableNote, `# ${sectionName}
`);
        existingTable = "";
      }
      const receivedDayRating = Array.isArray(userDayRatingResponse) && userDayRatingResponse[0].length;
      let tableMarkdown = `# ${sectionName}
`;
      tableMarkdown += `| **Daily Questions Note** | **Day Rating** | **Precipitating events** |
| --- | --- | --- |
`;
      tableMarkdown += `| [[${dailyQuestionNote.name}]] | ${receivedDayRating ? userDayRatingResponse[0] : "See note"} | ${receivedDayRating ? userDayRatingResponse[1] : "See note"} |
`;
      tableMarkdown += existingTable;
      const dailyQuestionContent = await dailyQuestionNote.content();
      if (receivedDayRating && !dailyQuestionContent.includes("Day Rating")) {
        await dailyQuestionContent.insertContent(
          `# Day Rating
Rating given: ${userDayRatingResponse[0] || "N/A"}
${userDayRatingResponse[1]?.length ? `Rating precipitating factors: ${userDayRatingResponse[1]}` : ""}`
        );
      }
      await app.replaceNoteContent(dateTableNote, tableMarkdown, { heading: { text: sectionName, level: 2 } });
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
      let noteDataName = await app.settings[this.constants.SETTING_KEY_NOTE_DATA];
      if (!noteDataName) {
        const result = await app.prompt(
          `Enter the name of the note in which you'd like to record a table with links to your Five Question entries (leave blank for the default of "${this.constants.DEFAULT_NOTE_DATA_NAME}")`,
          { inputs: [{ type: "text" }] }
        );
        const noteName = result[0] || this.constants.DEFAULT_NOTE_DATA_NAME;
        noteDataName = noteName;
        await app.setSetting(this.constants.SETTING_KEY_NOTE_DATA, noteDataName);
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
