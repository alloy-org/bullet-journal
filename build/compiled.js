(() => {
  // lib/constants/misc.js
  var NOTE_OPTION_NAME = "Log Bullet Journal Entry";

  // lib/constants/note-names.js
  var DEFAULT_NOTE_NAME_DATA = "Bullet Journal Data";
  var DEFAULT_NOTE_NAME_GRATITUDE = `Themes of "Gratitude" from five-minute bullet journal`;
  var DEFAULT_NOTE_NAME_HIGHLIGHTS = `Themes of "Daily Highlights" from five-minute bullet journal`;
  var DEFAULT_NOTE_NAME_LEARNING = `Themes of "Learning" from five-minute bullet journal`;
  var DEFAULT_QUESTION_NOTE_TAGS = ["daily-jots/bullet-journal"];

  // lib/constants/settings.js
  var SETTING_KEY_NOTE_DATA = "Name of note where table is recorded";
  var SETTING_KEY_DATE_FORMAT = "Date format, see plugin documentation";
  var SETTING_KEY_TAG_APPLIED = `Tag(s) to apply to daily Daily Bullet entries (default "${DEFAULT_QUESTION_NOTE_TAGS[0]}")`;
  var SETTING_KEY_DATA_TAG_APPLIED = "Tag to apply to data note";
  var SETTING_KEY_GRATITUDE_NOTE = `Name of note that "Gratitude" heading links to (default "${DEFAULT_NOTE_NAME_GRATITUDE}")`;
  var SETTING_KEY_HIGHLIGHTS_NOTE = `Name of note that "Daily Highlights" heading links to (default "${DEFAULT_NOTE_NAME_HIGHLIGHTS}")`;
  var SETTING_KEY_LEARNING_NOTE = `Name of note that "What I Learned" heading links to (default "${DEFAULT_NOTE_NAME_LEARNING}")`;

  // lib/five-question-markdown.js
  var FIVE_QUESTION_MARKDOWN = `# [I am grateful for...](gratitude_link)
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
# [Highlights of the day](highlights_link)
1. 
2. 
3. 

###
# [What did I learn today?](learning_link)
* 

###
`;

  // lib/plugin.js
  var TABLE_SECTION_NAME = `"Bullet Journal" Entries`;
  var TAG_SUFFIX = "bullet-journal";
  var BACKLINK_NOTE_LABELS = ["gratitude", "highlights", "learning"];
  var plugin = {
    _backlinkNoteUuidFromLabel: {},
    // Object mapping BACKLINK_NOTE_LABELS to note UUIDs
    constants: {},
    // --------------------------------------------------------------------------
    // https://www.amplenote.com/help/developing_amplenote_plugins#dailyJotOption
    dailyJotOption: {
      [NOTE_OPTION_NAME]: {
        async run(app) {
          await this._logDailyEntry(app);
        },
        async check(app) {
          const tableDataRows = await this._tableDataRows(app, TABLE_SECTION_NAME);
          if (!tableDataRows)
            return true;
          const todayString = (/* @__PURE__ */ new Date()).toLocaleDateString();
          return !tableDataRows.find((row) => row.includes(todayString));
        }
      }
    },
    // --------------------------------------------------------------------------------------
    appOption: {
      [NOTE_OPTION_NAME]: async function(app) {
        await this._logDailyEntry(app);
      }
    },
    // --------------------------------------------------------------------------------------
    async _logDailyEntry(app) {
      await this._ensureBacklinkNotes(app);
      await this._ensureBulletJournalNote(app);
      await this._visitBulletJournalNote(app);
      await this._queryRecordMoodLevel(app);
    },
    // --------------------------------------------------------------------------------------
    // The bullet journal headings link to separate notes, so backlinks can be perused to extract themes that
    // can be analyzed/summarized in the backlink-holding note
    async _ensureBacklinkNotes(app) {
      const backlinkSets = [
        [SETTING_KEY_GRATITUDE_NOTE, DEFAULT_NOTE_NAME_GRATITUDE, "gratitude"],
        [SETTING_KEY_HIGHLIGHTS_NOTE, DEFAULT_NOTE_NAME_HIGHLIGHTS, "highlights"],
        [SETTING_KEY_LEARNING_NOTE, DEFAULT_NOTE_NAME_LEARNING, "learning"]
      ];
      for (const [settingKey, defaultValue, backlinkNoteLabel] of backlinkSets) {
        const noteName = await app.settings[settingKey] || defaultValue;
        if (noteName === "none")
          continue;
        const note = await app.findNote({ name: noteName });
        if (note) {
          console.debug(`Populated noteHandle`, backlinkNoteLabel, "with note", note);
          this._backlinkNoteUuidFromLabel[backlinkNoteLabel] = note.uuid;
        }
        const rootTag = await this._rootDataTag(app);
        let noteTag;
        if (rootTag) {
          noteTag = `${rootTag}/${TAG_SUFFIX}`;
        }
        const noteUUID = await app.createNote(noteName, noteTag ? [noteTag] : []);
        const persistedNote = await app.findNote({ uuid: noteUUID });
        this._backlinkNoteUuidFromLabel[backlinkNoteLabel] = persistedNote.uuid;
        await app.insertNoteContent(
          this._backlinkNoteUuidFromLabel[backlinkNoteLabel],
          `Periodically browse the "Backlinks" tab, and summarize any repeating patterns that you see:

\\

`
        );
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
      let journalNote = await app.findNote(findArgument);
      if (journalNote) {
        const content = await app.getNoteContent(journalNote);
        if (content?.length > 100) {
          console.log("Note content already populated. Not adding");
          this._bulletNoteHandle = journalNote;
          return;
        }
      } else {
        const noteUUID = await app.createNote(findArgument.name, findArgument.tags || []);
        journalNote = await app.findNote({ uuid: noteUUID });
      }
      let journalContent = FIVE_QUESTION_MARKDOWN;
      for (const backlinkNoteLabel of BACKLINK_NOTE_LABELS) {
        const backlinkNoteUuid = this._backlinkNoteUuidFromLabel[backlinkNoteLabel];
        console.debug("backlinkNoteUuid", backlinkNoteUuid, "for label", backlinkNoteLabel);
        if (backlinkNoteUuid) {
          journalContent = journalContent.replace(`${backlinkNoteLabel}_link`, `/notes/${backlinkNoteUuid}`);
        } else {
          const titleRegex = new RegExp(`/\\[([\\w\\s]+)\\]\\(${backlinkNoteLabel}_link\\)`);
          journalContent = journalContent.replace(titleRegex, "$1");
        }
      }
      await app.insertNoteContent({ uuid: journalNote.uuid }, journalContent);
      this._bulletNoteHandle = journalNote;
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
      await this._persistTableData(app, TABLE_SECTION_NAME, result);
    },
    // --------------------------------------------------------------------------------------
    async _noteName(app) {
      const dateSetting = await app.settings[SETTING_KEY_DATE_FORMAT];
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
      const tagSetting = await app.settings[SETTING_KEY_TAG_APPLIED];
      if (tagSetting?.length) {
        return tagSetting.split(",").map((tag) => tag.trim()).filter((n) => n);
      } else {
        let bulletJournalNoteTags = DEFAULT_QUESTION_NOTE_TAGS;
        const baseTag = await this._rootDataTag(app);
        if (baseTag) {
          bulletJournalNoteTags.push(`${baseTag}/${TAG_SUFFIX}`);
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
      const formattedRating = receivedDayRating ? this._formattedDayRating(userDayRatingResponse[0]) : null;
      if (receivedDayRating) {
        console.debug("Received day rating, formattedRating is", formattedRating);
      }
      let tableMarkdown = `# ${sectionName}
`;
      tableMarkdown += `| **Bullet Journal Note** | **Day Rating** | **Precipitating events** | **Captured at** |
| --- | --- | --- | --- |
`;
      tableMarkdown += `| [${this._bulletNoteHandle.name}](/notes/${this._bulletNoteHandle.uuid}) | ${formattedRating || "See note"} | ${receivedDayRating ? userDayRatingResponse[1].replace(/\n/g, "\\") : "See note"} | ${(/* @__PURE__ */ new Date()).toLocaleString()} |
`;
      tableMarkdown += existingTable;
      if (receivedDayRating) {
        const existingJournalContent = await app.getNoteContent(this._bulletNoteHandle);
        let insertContent = `- Rating as of ${(/* @__PURE__ */ new Date()).toLocaleTimeString(navigator.language, { hour: "2-digit", minute: "2-digit", hour12: true })}: ${formattedRating}${userDayRatingResponse[1]?.length ? `
    - Precipitating factors: ${userDayRatingResponse[1]}` : ""}`;
        console.log("Inserting", insertContent);
        if (!existingJournalContent?.includes("# Day Rating")) {
          insertContent = `
# Day Rating
${insertContent}`;
        }
        await app.insertNoteContent(this._bulletNoteHandle, insertContent, { atEnd: true });
      }
      const dataNote = await this._dataNote(app);
      await app.replaceNoteContent(dataNote, tableMarkdown, { heading: { text: sectionName } });
    },
    // --------------------------------------------------------------------------------------
    _formattedDayRating(userDayRating) {
      const numericBackgroundColor = { "-2": "12", "-1": "1", "1": "4", "2": "15" }[userDayRating];
      let formattedRating = `**${userDayRating}**`;
      if (numericBackgroundColor) {
        formattedRating = `**==${userDayRating}<!-- {"backgroundCycleColor":"${numericBackgroundColor}"} -->==**`;
      }
      return formattedRating;
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
        let dataNoteTag = await app.settings[SETTING_KEY_DATA_TAG_APPLIED];
        if (!dataNoteTag && dataTagBase) {
          dataNoteTag = [`${dataTagBase}/five-questions`];
        }
        const uuid = await app.createNote(noteDataName, dataNoteTag || []);
        console.debug("New data note uuid is", uuid, "with tag", dataNoteTag);
        this._dataNoteHandle = await app.findNote({ uuid });
        console.debug("this._dataNoteHandle is", this._dataNoteHandle);
        return this._dataNoteHandle;
      }
    },
    // --------------------------------------------------------------------------------------
    async _dataNoteName(app) {
      let noteDataName = await app.settings[SETTING_KEY_NOTE_DATA];
      if (!noteDataName) {
        const result = await app.prompt(
          `Enter the name of the note in which you'd like to record a table with links to your Bullet Journal entries (leave blank for the default of "${DEFAULT_NOTE_NAME_DATA}")`,
          { inputs: [{ type: "text" }] }
        );
        noteDataName = result[0] || DEFAULT_NOTE_NAME_DATA;
        await app.setSetting(SETTING_KEY_NOTE_DATA, noteDataName);
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
