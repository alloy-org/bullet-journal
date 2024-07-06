(() => {
  // lib/five-question-markdown.js
  var FIVE_QUESTION_MARKDOWN = `# I am grateful for...
1.  
2. 
3. 

###
# What would make today great?
1. 
2. 
3. 

###
# Daily affirmation
* [ ] Some ideas from [TheGoodTrade](https://www.thegoodtrade.com/features/positive-affirmations-morning-routine/)

###
# Highlights of the day
1. 
2. 
3. 

###
# What did I learn today?
* 

###
`;

  // lib/plugin.js
  var plugin = {
    // --------------------------------------------------------------------------------------
    constants: {
      DEFAULT_NOTE_DATA_NAME: "Bullet Journal Data",
      DEFAULT_QUESTION_NOTE_TAGS: ["daily-jots/bullet-journal"],
      TABLE_SECTION_NAME: `"Bullet Journal" Entries`,
      SETTING_KEY_NOTE_DATA: "Name of note where table is recorded",
      SETTING_KEY_DATE_FORMAT: "Date format, see plugin documentation",
      SETTING_KEY_TAG_APPLIED: "Tag(s) to apply to daily Daily Bullet entries (default 'daily-jots/bullet-journal')",
      SETTING_KEY_DATA_TAG_APPLIED: "Tag to apply to data note"
    },
    // --------------------------------------------------------------------------
    // https://www.amplenote.com/help/developing_amplenote_plugins#dailyJotOption
    dailyJotOption: {
      "Log Daily Entry": {
        async run(app) {
          await this._ensureBulletJournalNote(app);
          await this._visitBulletJournalNote(app);
          await this._queryRecordMoodLevel(app);
        },
        async check(app) {
          const tableDataRows = await this._tableDataRows(app, this.constants.TABLE_SECTION_NAME);
          if (!tableDataRows)
            return true;
          const todayString = (/* @__PURE__ */ new Date()).toLocaleDateString();
          return !tableDataRows.find((row) => row.includes(todayString));
        }
      }
    },
    // --------------------------------------------------------------------------------------
    appOption: {
      "Log daily entry": async function(app) {
        await this._ensureBulletJournalNote(app);
        await this._visitBulletJournalNote(app);
        await this._queryRecordMoodLevel(app);
      }
    },
    // --------------------------------------------------------------------------------------
    async _ensureBulletJournalNote(app) {
      const noteName = await this._noteName(app);
      let findArgument = { name: noteName };
      const tagsApplied = await this._bulletJournalTagArray(app);
      if (tagsApplied.length) {
        findArgument = { ...findArgument, tags: tagsApplied };
      }
      let note = await app.findNote(findArgument);
      if (note) {
        const firstLine = FIVE_QUESTION_MARKDOWN.split("\n")[0];
        const content = await app.getNoteContent(note);
        if (content?.includes(firstLine)) {
          console.log("Note content already includes journal, returning existing");
          this._bulletNoteHandle = note;
          return;
        }
      } else {
        const noteUUID = await app.createNote(findArgument.name, findArgument.tags || []);
        note = await app.findNote({ uuid: noteUUID });
      }
      await app.insertNoteContent({ uuid: note.uuid }, FIVE_QUESTION_MARKDOWN);
      this._bulletNoteHandle = note;
    },
    // --------------------------------------------------------------------------------------
    async _queryRecordMoodLevel(app) {
      const moodOptions = [-2, -1, 0, 1, 2].map((value) => ({ value: `${value}`, label: `${value}` }));
      const result = await app.prompt("Today will be remembered as (optional)", {
        inputs: [
          { label: "Frivolous/terrible (-2) to successful/wonderful (+2)", type: "radio", options: moodOptions, value: "0" },
          { label: "Factors contributing to this rating?", type: "text" }
        ]
      });
      await this._persistTableData(app, this.constants.TABLE_SECTION_NAME, result);
    },
    // --------------------------------------------------------------------------------------
    async _noteName(app) {
      const dateSetting = await app.settings[this.constants.SETTING_KEY_DATE_FORMAT];
      const userLocale = navigator?.language || "en-US";
      if (dateSetting?.length) {
        console.log("Using setting from user", dateSetting);
        return `${(/* @__PURE__ */ new Date()).toLocaleDateString(userLocale, dateSetting)} Bullet Journal`;
      } else {
        return `${(/* @__PURE__ */ new Date()).toLocaleDateString(userLocale, { year: "numeric", month: "long", day: "numeric" })} Bullet Journal`;
      }
    },
    // --------------------------------------------------------------------------------------
    async _bulletJournalTagArray(app) {
      const tagSetting = await app.settings[this.constants.SETTING_KEY_TAG_APPLIED];
      if (tagSetting?.length) {
        return tagSetting.split(",").map((tag) => tag.trim()).filter((n) => n);
      } else {
        let bulletJournalNoteTags = this.constants.DEFAULT_QUESTION_NOTE_TAGS;
        const baseTag = await this._rootDataTag(app);
        if (baseTag) {
          bulletJournalNoteTags.push(`${baseTag}/bullet-journal`);
        }
        return bulletJournalNoteTags;
      }
    },
    // --------------------------------------------------------------------------------------
    async _visitBulletJournalNote(app) {
      const tagArray = await this._bulletJournalTagArray(app);
      let navigateUrl;
      if (tagArray?.length) {
        navigateUrl = `https://www.amplenote.com/notes/${this._bulletNoteHandle.uuid}`;
      } else {
        navigateUrl = `https://www.amplenote.com/notes/${this._bulletNoteHandle.uuid}`;
      }
      await app.navigate(navigateUrl);
    },
    // --------------------------------------------------------------------------------------
    async _persistTableData(app, sectionName, userDayRatingResponse) {
      const existingTableRows = await this._tableDataRows(app, sectionName);
      let existingTable;
      if (existingTableRows) {
        console.debug(`Found ${existingTableRows.length} existing data table rows to preserve`);
        existingTable = existingTableRows.join("\n");
      } else {
        console.log("No existing data table could be found. Creating data table section");
        await app.insertNoteContent(await this._dataNote(app), `# ${sectionName}
`);
        existingTable = "";
      }
      const receivedDayRating = Array.isArray(userDayRatingResponse) && userDayRatingResponse[0].length;
      let tableMarkdown = `# ${sectionName}
`;
      tableMarkdown += `| **Bullet Journal Note** | **Day Rating** | **Precipitating events** | **Captured at** |
| --- | --- | --- | --- |
`;
      tableMarkdown += `| [${this._bulletNoteHandle.name}](/notes/${this._bulletNoteHandle.uuid}) | ${receivedDayRating ? userDayRatingResponse[0] : "See note"} | ${receivedDayRating ? userDayRatingResponse[1] : "See note"} | ${(/* @__PURE__ */ new Date()).toLocaleString()} |
`;
      tableMarkdown += existingTable;
      if (receivedDayRating) {
        const existingJournalContent = await app.getNoteContent(this._bulletNoteHandle);
        if (existingJournalContent?.includes("# Day Rating")) {
          const sectionContent = this._sectionContent(existingJournalContent, "Day Rating");
          console.debug("Appending to existing journal day rating content", sectionContent);
          await app.replaceNoteContent(
            this._bulletNoteHandle,
            `${sectionContent}
* Rating given at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}: ${userDayRatingResponse[0]}${userDayRatingResponse[1]?.length ? `
  * Precipitating factors: ${userDayRatingResponse[1]}` : ""}`,
            { heading: { text: "Day Rating", level: 1 } }
          );
        } else {
          await app.insertNoteContent(
            this._bulletNoteHandle,
            `# Day Rating
* Rating given at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}: ${userDayRatingResponse[0] || "N/A"}${userDayRatingResponse[1]?.length ? `
  * Precipitating factors: ${userDayRatingResponse[1]}` : ""}`,
            { atEnd: true }
          );
        }
      }
      const dataNote = await this._dataNote(app);
      console.debug("Constructed", tableMarkdown, "markdown to replace data note section");
      await app.replaceNoteContent(dataNote, tableMarkdown, { heading: { text: sectionName, level: 1 } });
    },
    // --------------------------------------------------------------------------------------
    // Return an array of the rows from the bullet journal data table (absent its two header rows), or undefined if
    // it doesn't exist
    async _tableDataRows(app, sectionName) {
      const dataNote = await this._dataNote(app);
      const content = await app.getNoteContent(dataNote);
      let existingTable = "";
      if (content.includes(`# ${sectionName}`)) {
        console.log("Table note content includes expected section name");
        existingTable = await this._sectionContent(content, sectionName);
        if (existingTable?.length) {
          console.log(`Data table note (${dataNote.name}) has existing table content length`, existingTable.length);
          const tableRows = existingTable.split("\n");
          while (tableRows.length) {
            if (tableRows[0].includes("Bullet Journal]")) {
              break;
            } else {
              const row = tableRows.shift();
            }
          }
          return tableRows;
        } else {
          console.log("No table content found in section", sectionName);
        }
      }
    },
    // --------------------------------------------------------------------------------------
    // Return a handle to the note data note, creating it with user-specified tags if it doesn't yet exist
    async _dataNote(app) {
      if (this._dataNoteHandle) {
        return this._dataNoteHandle;
      } else {
        const noteDataName = await this._dataNoteName(app);
        const existingNote = await app.findNote({ name: noteDataName });
        if (existingNote) {
          this._dataNoteHandle = existingNote;
          return existingNote;
        }
        const dataTagBase = await this._rootDataTag(app);
        let dataNoteTag = await app.settings[this.constants.SETTING_KEY_DATA_TAG_APPLIED];
        if (!dataNoteTag && dataTagBase) {
          dataNoteTag = [`${dataTagBase}/five-questions`];
        }
        let newNote = await app.createNote(noteDataName, dataNoteTag || []);
        console.debug("new data note is", newNote, "with tag", dataNoteTag);
        this._dataNoteHandle = await app.findNote({ uuid: newNote.uuid });
        console.debug("this._dataNoteHandle is", this._dataNoteHandle);
        return this._dataNoteHandle;
      }
    },
    // --------------------------------------------------------------------------------------
    async _dataNoteName(app) {
      let noteDataName = await app.settings[this.constants.SETTING_KEY_NOTE_DATA];
      if (!noteDataName) {
        const result = await app.prompt(
          `Enter the name of the note in which you'd like to record a table with links to your Bullet Journal entries (leave blank for the default of "${this.constants.DEFAULT_NOTE_DATA_NAME}")`,
          { inputs: [{ type: "text" }] }
        );
        noteDataName = result[0] || this.constants.DEFAULT_NOTE_DATA_NAME;
        await app.setSetting(this.constants.SETTING_KEY_NOTE_DATA, noteDataName);
      }
      return noteDataName;
    },
    // --------------------------------------------------------------------------------------
    // Return the base hierarchy tag in which to record bullet journal entries, based on attempt to find a tag
    // that is already in use by the user
    async _rootDataTag(app) {
      for (const tagBaseCandidate of ["personal", "me", "business", "biz"]) {
        const candidateNoteHandles = await app.filterNotes({ tag: tagBaseCandidate });
        if (candidateNoteHandles.length) {
          return tagBaseCandidate;
        } else {
          console.debug("No notes exist for tag", tagBaseCandidate);
        }
      }
      console.debug("No good base tag found for data note");
    },
    // --------------------------------------------------------------------------------------
    // Return all of the markdown within a section that begins with `sectionHeadingText`
    // `sectionHeadingText` Text of the section heading to grab, with or without preceding `#`s
    // `depth` Capture all content at this depth, e.g., if grabbing depth 2 of a second-level heading, this will return all potential h3s that occur up until the next h1 or h2
    _sectionContent(noteContent, headingTextOrSectionObject) {
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
