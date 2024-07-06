import { FIVE_QUESTION_MARKDOWN } from "./five-question-markdown"

// --------------------------------------------------------------------------------------
// API Reference: https://www.amplenote.com/help/developing_amplenote_plugins
// Tips on developing plugins: https://www.amplenote.com/help/guide_to_developing_amplenote_plugins
const plugin = {
  // --------------------------------------------------------------------------------------
  constants: {
    DEFAULT_NOTE_DATA_NAME: "Five Question Data",
    DEFAULT_NOTE_DATA_TAGS: [ "daily-jots/five-questions" ],
    TABLE_SECTION_NAME: `"Five Question" Daily Entries`,
    SETTING_KEY_NOTE_DATA: "Name of note where table is recorded",
    SETTING_KEY_DATE_FORMAT: "Date format, see plugin documentation",
    SETTING_KEY_TAG_APPLIED: "Tag(s) to apply to daily Five Question entries (default 'daily-jots/five-questions')",
  },

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#dailyJotOption
  dailyJotOption: {
    "Five questions": {
      async run(app) {
        await this._ensureDailyFiveQuestionNote(app);
        await this._visitDailyFiveQuestionNote(app);
        await this._queryRecordMoodLevel(app);
      },
      async check(app) {
        const note = await this._fetchDataNote(app);
        if (!note) return false;
        const tableMarkdown = await this._tableData(app, note, this.constants.TABLE_SECTION_NAME);
        if (!tableMarkdown) return false;
        const todayString = (new Date()).toLocaleDateString();
        return !tableMarkdown.includes(todayString);
      }
    }
  },

  // --------------------------------------------------------------------------------------
  appOption: {
    "Capture five question entry": async function(app) {
      await this._ensureDailyFiveQuestionNote(app);
      await this._visitDailyFiveQuestionNote(app);
      await this._queryRecordMoodLevel(app);
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
      const content = await app.getNoteContent(note);
      if (content?.includes(firstLine)) {
        console.log("Note content already includes five questions, returning existing")
        this._dailyQuestionNoteHandle = note;
        return;
      }
    } else {
      const noteUUID = await app.createNote(findArgument.name, findArgument.tags);
      note = await app.findNote({ uuid: noteUUID });
    }
    await app.insertNoteContent({ uuid: note.uuid }, FIVE_QUESTION_MARKDOWN);
    this._dailyQuestionNoteHandle = note;
  },

  // --------------------------------------------------------------------------------------
  async _queryRecordMoodLevel(app) {
    const moodOptions = [ -2, -1, 0, 1, 2 ].map(value => ({ value, label: `${ value }` }));
    const result = await app.prompt("Today will be remembered as (optional)", {
      inputs: [
        { label: "Frivolous/terrible (-2) to successful/wonderful (+2)", type: "radio", options: moodOptions, value: "0" },
        { label: "Factors contributing to this rating?", type: "text" },
      ],
    });

    await this._persistTableData(app, this.constants.TABLE_SECTION_NAME, result);
  },

  // --------------------------------------------------------------------------------------
  async _noteName(app) {
    const dateSetting = await app.settings[this.constants.SETTING_KEY_DATE_FORMAT];
    const userLocale = navigator?.language || "en-US";
    if (dateSetting?.length) {
      console.log("Using setting from user", dateSetting);
      return `${ (new Date()).toLocaleDateString(userLocale, dateSetting) } Five Questions`
    } else {
      return `${ (new Date()).toLocaleDateString(userLocale, { year: "numeric", month: "long", day: "numeric" }) } Five Questions`
    }
  },

  // --------------------------------------------------------------------------------------
  async _noteTagArray(app) {
    const tagSetting = await app.settings[this.constants.SETTING_KEY_TAG_APPLIED];
    if (tagSetting?.length) {
      return tagSetting.split(",").map(tag => tag.trim()).filter(n => n);
    } else {
      return this.constants.DEFAULT_NOTE_DATA_TAGS;
    }
  },

  // --------------------------------------------------------------------------------------
  async _visitDailyFiveQuestionNote(app) {
    const tagArray = await this._noteTagArray(app);
    let navigateUrl;
    if (tagArray?.length) {
      navigateUrl = `https://www.amplenote.com/notes/jots?tag=${ tagArray[0] }`;
    } else {
      navigateUrl = `https://www.amplenote.com/notes/${ this._dailyQuestionNoteHandle.uuid }`;
    }

    await app.navigate(navigateUrl);
  },

  // --------------------------------------------------------------------------------------
  async _persistTableData(app, sectionName, userDayRatingResponse) {
    let existingTable = await this._tableData(app, sectionName);
    if(existingTable) {
      console.debug("Found existing data table content, length", existingTable.length);
    } else {
      console.log("No existing data table could be found. Creating data table section");
      await app.insertNoteContent(this._dataNoteHandle, `# ${ sectionName }\n`);
      existingTable = "";
    }
    const receivedDayRating = Array.isArray(userDayRatingResponse) && userDayRatingResponse[0].length;
    console.debug("userDayRatingResponse was", userDayRatingResponse)
    let tableMarkdown = `# ${ sectionName }\n`;
    tableMarkdown += `| **Daily Questions Note** | **Day Rating** | **Precipitating events** |\n| --- | --- | --- |\n`;
    tableMarkdown += `| [[${ this._dailyQuestionNoteHandle.name }]] | ${ receivedDayRating ? userDayRatingResponse[0] : "See note" } | ${ receivedDayRating ? userDayRatingResponse[1] : "See note" } |\n`;
    tableMarkdown += existingTable;

    const dailyQuestionContent = await app.getNoteContent(this._dailyQuestionNoteHandle);
    if (receivedDayRating && !dailyQuestionContent.includes("Day Rating")) {
      await app.insertNoteContent(this._dailyQuestionNoteHandle,
        `# Day Rating\nRating given: ${ userDayRatingResponse[0] || "N/A" }\n${ userDayRatingResponse[1]?.length ? `Rating precipitating factors: ${ userDayRatingResponse[1] }` : "" }`,
        { atEnd: true }
      );
    }

    await app.replaceNoteContent(this._dataNoteHandle, tableMarkdown, { heading: { text: sectionName, level: 2 }});
  },

  // --------------------------------------------------------------------------------------
  async _tableData(app, sectionName) {
    const content = await app.getNoteContent(this._dataNoteHandle);
    let existingTable = "";
    if (content.includes(`# ${ sectionName }`)) {
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
    if (this._dataNoteHandle) return this._dataNoteHandle;

    noteDataName = noteDataName || (await this._fetchNoteDataName(app));
    const existingNote = await app.findNote({ name: noteDataName });
    if (existingNote) {
      this._dataNoteHandle = existingNote;
      return existingNote;
    }
    const note = await app.createNote(noteDataName, this.constants.DEFAULT_NOTE_DATA_TAGS);
    this._dataNoteHandle = note;
    return note;
  },

  // --------------------------------------------------------------------------------------
  async _fetchNoteDataName(app) {
    let noteDataName = await app.settings[this.constants.SETTING_KEY_NOTE_DATA];
    if (!noteDataName) {
      const result = await app.prompt(`Enter the name of the note in which you'd like to record a table with links to your Five Question entries (leave blank for the default of "${ this.constants.DEFAULT_NOTE_DATA_NAME }")`,
        { inputs: [ { type: "text" } ] }
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
        throw(new Error(`${ err.message } (line 1054)`));
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
    const sectionMatch = indexes.find(m => m[1].trim() === sectionHeadingText.trim());
    if (!sectionMatch) {
      console.error("Could not find section", sectionHeadingText, "that was looked up. This might be expected");
      return { startIndex: null, endIndex: null };
    } else {
      const level = sectionMatch[0].match(/^#+/)[0].length;
      const nextMatch = indexes.find(m => m.index > sectionMatch.index && m[0].match(/^#+/)[0].length <= level);
      const endIndex = nextMatch ? nextMatch.index : bodyContent.length;
      return { startIndex: sectionMatch.index + sectionMatch[0].length + 1, endIndex };
    }
  },

};
export default plugin;
