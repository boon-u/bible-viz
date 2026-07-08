# Note format — how to author Bible Viz study notes

Bible Viz is **read-only**: you don't type notes into the website. You author them
with an agentic AI (Claude, etc.), the AI emits them in one of the two formats
below, and you **Import** them on the Overview screen. The app then renders them,
links their cross-references, and plots them in the graph.

This doc is the contract. Point your AI at it: *"Produce Bible Viz notes for
Romans 8 in the JSON format described in docs/NOTE_FORMAT.md."*

**Reference templates:** [`sample-notes.json`](sample-notes.json) is a ready set of
9 worked examples (verse / passage / chapter / book / topic notes, with tags and
cross-references). Read it to see the format in practice, import it directly, or
hit **Load sample notes** on the Overview to keep them in the app for reference.

---

## Format A — JSON (canonical)

A single object with a `notes` array. This is what Import expects for `.json`.

```json
{
  "notes": [
    {
      "title": "God works all things for good",
      "book": "Romans",
      "chapter": 8,
      "verseStart": 28,
      "verseEnd": 30,
      "category": "application",
      "tags": ["providence", "assurance", "predestination"],
      "body": "Paul's climax of assurance. The 'good' is defined in v29 as being\nconformed to Christ. See the golden chain: foreknew → predestined → called →\njustified → glorified.\n\nCompare [[Genesis 50:20]] and [[Jeremiah 29:11]].",
      "refs": ["Genesis 50:20", "Jeremiah 29:11", "Ephesians 1:4-5"]
    }
  ]
}
```

### Fields

| field        | required | meaning |
|--------------|----------|---------|
| `title`      | yes      | Short heading. |
| `book`       | no       | Bible book name (see naming below). Omit for a pure **topic** note. |
| `chapter`    | no       | Requires `book`. Omit for a **book-level** note. |
| `verseStart` | no       | Requires `chapter`. Omit for a **chapter-level** note. |
| `verseEnd`   | no       | Defaults to `verseStart` when absent (single verse). |
| `category`   | no       | One of: `intro`, `background`, `history`, `word-study`, `application`, `sermon`, `cross-ref`, `topic`, `general`. Free text is allowed but presets get filter chips. Defaults to `general`. |
| `tags`       | no       | Topics. These become nodes in the graph — reuse tag spellings to connect notes. |
| `body`       | no       | **Markdown.** GitHub-flavored (headings, lists, tables, quotes, `**bold**`). |
| `refs`       | no       | Cross-references — passages this note points to. Strings like `"John 3:16"`, `"Rom 8:28-30"`, `"1 Cor 13"`. They become clickable chips + graph edges. |

**Anchor is inferred from which location fields you set:**

- `book` + `chapter` + `verseStart` → verse / passage note
- `book` + `chapter` → whole-chapter note
- `book` only → whole-book note (intros, backgrounds, outlines)
- none → topic note (lives in the graph by its `tags`/`refs` only)

### Inline references in `body`

Write a cross-reference inside the text as `[[Book C:V]]` and the app auto-links it,
e.g. `[[John 3:16]]`, `[[Romans 8:28-30]]`, `[[Psalm 23]]`. You can list the same
refs in `refs` to guarantee they appear as chips + graph edges even if not inlined.

---

## Format B — Markdown with YAML front-matter (Obsidian-friendly)

Import also accepts a `.md` file. One note per file, or several notes in one file
separated by a `---` fence between front-matter blocks.

```markdown
---
title: God works all things for good
book: Romans
chapter: 8
verseStart: 28
verseEnd: 30
category: application
tags: [providence, assurance, predestination]
refs: [Genesis 50:20, Jeremiah 29:11, Ephesians 1:4-5]
---

Paul's climax of assurance. The "good" is defined in v29 as being conformed to
Christ. Compare [[Genesis 50:20]] and [[Jeremiah 29:11]].
```

The front-matter keys are exactly the JSON field names. The body (everything after
the closing `---`) is the Markdown note.

---

## Book naming

Use full KJV book names (`Genesis`, `1 Samuel`, `Song of Solomon`, `Revelation`).
Common abbreviations in `refs` / `[[...]]` are resolved automatically
(`Gen`, `Ps`/`Psalm`, `Rom`, `1 Cor`, `Rev`, `Jn`, `Matt`, …). If a reference
can't be resolved to a real book/chapter it's still stored and shown, just not
clickable.

---

## Round-tripping

**Export** on the Overview produces the same JSON shape (plus your reading data and
per-verse read counts) and a combined Markdown file — so notes you export drop
straight back into an AI prompt, Obsidian, or a fresh import. Re-importing is
idempotent when notes carry an `id`; notes without an `id` are added as new.
