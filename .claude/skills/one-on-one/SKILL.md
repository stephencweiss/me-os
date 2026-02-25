---
name: one-on-one
description: Process and manage 1:1 meeting notes. Supports voice notes, handwritten notes (images), markdown files, and text input. Stores notes and generates structured summaries.
user-invocable: true
---

# /one-on-one - 1:1 Meeting Notes Management

Process voice notes, handwritten notes, markdown files, or text into structured 1:1 summaries with history tracking per direct report.

## Usage

- `/one-on-one <name>` - Start or continue 1:1 with person
- `/one-on-one <name> add <file-path>` - Process voice/image/markdown file
- `/one-on-one <name> note` - Add text notes interactively
- `/one-on-one <name> summary` - Generate summary from today's notes
- `/one-on-one <name> history` - View past 1:1s
- `/one-on-one list` - List all direct reports

## Data Storage

Notes are stored in `data/one-on-ones/<person>/`:
- `YYYY-MM-DD-raw.md` - Raw transcript/notes
- `YYYY-MM-DD-summary.md` - Structured summary

Index file: `data/one-on-ones/index.json`

## Instructions

When the user invokes this skill:

### For `/one-on-one <name>` (starting a 1:1)

1. Check if person exists in the index (case-insensitive search)
2. If new person:
   - Create them with `addPerson(name)` from `lib/one-on-one.ts`
   - Confirm: "Created new profile for [Name]. Ready to add notes."
3. If existing person:
   - Load their last 1:1 summary (if exists)
   - Show: "Last 1:1 with [Name]: [date]"
   - If summary exists, show key points
4. Offer options:
   - "Add notes" - prompt for file path or text
   - "View history" - show past entries
   - "Generate summary" - summarize today's notes

### For `/one-on-one <name> add <file-path>`

1. Determine file type from extension:
   - `.m4a`, `.mp3`, `.wav`, `.ogg` → voice note
   - `.jpg`, `.jpeg`, `.png`, `.heic` → handwritten notes
   - `.md`, `.txt` → markdown/text file

2. **For voice notes**:
   - Use the Read tool to read the audio file
   - Claude will automatically transcribe it
   - Save transcript using `saveRawNotes(personId, transcript, "voice", filePath)`
   - Show transcript preview
   - Ask: "Generate summary now? [Yes/No]"

3. **For handwritten notes (images)**:
   - Use the Read tool to read the image file
   - Claude will interpret the handwriting using vision
   - Save interpretation using `saveRawNotes(personId, interpretation, "handwritten", filePath)`
   - Show interpretation preview
   - Ask user to confirm accuracy or make corrections

4. **For markdown files**:
   - Read the file content
   - Save using `saveRawNotes(personId, content, "markdown", filePath)`
   - Show content preview
   - Ask: "Generate summary now? [Yes/No]"

### For `/one-on-one <name> note`

1. Prompt user: "Please type or paste your 1:1 notes:"
2. Wait for user input
3. Save using `saveRawNotes(personId, content, "text")`
4. Confirm: "Notes saved for [date]"
5. If there are already notes for today, they will be appended

### For `/one-on-one <name> summary`

1. Load today's raw notes using `loadRawNotes(personId)`
2. If no notes exist:
   - Error: "No notes found for today. Add notes first with `/one-on-one <name> add` or `/one-on-one <name> note`"
3. Generate structured summary with these sections:
   ```markdown
   # 1:1 Summary: [Name] - [Date]

   ## Key Topics
   - [Main discussion points]

   ## Action Items
   - [ ] [Person]: [Action] by [deadline if mentioned]
   - [ ] Me: [Action]

   ## Notes
   - [Important observations, feedback, concerns]

   ## Follow-up
   - [Items to revisit next time]
   ```
4. Save using `saveSummary(personId, summary)`
5. Show the summary

### For `/one-on-one <name> history`

1. Load history using `getHistory(personId)`
2. If empty: "No 1:1 history found for [Name]"
3. Display list:
   ```
   ## 1:1 History with [Name]

   1. **February 24, 2026** (voice) - Summary available
   2. **February 17, 2026** (text) - Raw notes only
   ...
   ```
4. Ask: "Would you like to view a specific entry? Enter the number or 'done' to exit"
5. If user selects an entry, show the summary (or raw notes if no summary)

### For `/one-on-one list`

1. Load all people using `listPeople()`
2. Display:
   ```
   ## Direct Reports

   - **Alice Smith** (weekly) - Last 1:1: February 24, 2026
   - **Bob Johnson** (biweekly) - Last 1:1: February 20, 2026
   - **Charlie Brown** - Last 1:1: Never
   ```
3. If empty: "No direct reports configured yet. Start with `/one-on-one <name>` to add someone."

## Summary Template

When generating summaries, use this structure:

```markdown
# 1:1 Summary: [Name] - [Full Date]

## Key Topics
- Topic 1: Brief description
- Topic 2: Brief description

## Action Items
- [ ] [Name]: Action item with deadline if known
- [ ] Me: Action item I need to take

## Notes
- Important observation or feedback point
- Career/growth related discussion
- Team or project concerns raised

## Follow-up
- Topic to revisit next 1:1
- Pending items to check on
```

## Example Session

```
User: /one-on-one Alice

Claude: Created new profile for Alice. Ready to add notes.

What would you like to do?
- Add notes (provide file path or type directly)
- View history
- Generate summary

User: /one-on-one alice add ~/Downloads/1on1-notes.m4a

Claude: Transcribing voice note...

[Shows transcript preview]

Saved to data/one-on-ones/alice/2026-02-24-raw.md

Would you like me to generate a summary now? [Yes/No]

User: yes

Claude:
# 1:1 Summary: Alice - February 24, 2026

## Key Topics
- Q1 project progress
- Career growth discussion

## Action Items
- [ ] Alice: Send updated timeline by Friday
- [ ] Me: Review promotion criteria doc

## Notes
- Feeling confident about delivery
- Interested in taking on more leadership

## Follow-up
- Check in on timeline next week

Summary saved to data/one-on-ones/alice/2026-02-24-summary.md
```

## Prerequisites

- No external API keys required
- Uses Claude's native audio/vision capabilities
- Data stored locally in `data/one-on-ones/`