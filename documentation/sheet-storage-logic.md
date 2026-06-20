# LinguaLog Sheet Storage Logic

This app stores one language log entry as one Google Sheet row. The converter copies tab-separated values, Google Sheets stores those cells, and the log page reads the same shape back through gviz.

## Sheet Header

Use this header order in Google Sheets:

```tsv
EntryId	CreatedAt	UpdatedAt	Protected	SourceLanguage	SourceOtherLanguage	SourceText	SourceTransliteration	Tamil	English	Sanskrit	Hindi	Kannada	Malayalam	Telugu	French	OtherLanguage	Other	ExplanationHtml	TableData	Resource1Label	Resource1Value	Resource2Label	Resource2Value	TableName
```

`TableData` was added after `ExplanationHtml`. `TableName` is the last column. Headerless single-row paste still supports older rows that do not contain `TableData`.

## Main Fields

`EntryId` is generated once and stays with the row.

`CreatedAt` stores the first created time. `UpdatedAt` is refreshed when the row is copied again.

`Protected` stores `Yes` or `No`. The log page hides protected rows until login.

`SourceLanguage` stores the original sentence language. If it is `Other`, `SourceOtherLanguage` stores the temporary language name.

`SourceText` stores the original sentence. `SourceTransliteration` stores the optional reading aid.

The language columns store the source sentence and translations by language. When a language is `Other`, `OtherLanguage` stores the temporary language name and `Other` stores the sentence text.

Resources are stored as label/value pairs:

- `Resource1Label`
- `Resource1Value`
- `Resource2Label`
- `Resource2Value`

The label is optional display text. The value is the actual link or source reference.

## Rich Text Explanation

Formatted explanation content is stored as sanitized HTML in `ExplanationHtml`.

The editor supports:

- Bold, italic, and strikethrough.
- Ordered and unordered lists.
- One level of list indent and outdent.
- Predefined text colors and background colors.

When the log page displays this field, it sanitizes again through the safe HTML pipe before rendering.

## Table Data

The optional table is stored in `TableData` as compact JSON:

```json
{
  "v": 1,
  "t": "soft",
  "h": 1,
  "c": 0,
  "r": [
    ["Word", "Meaning"],
    ["<span style=\"background-color: yellow; color: #102114\">hola</span>", "hello"]
  ]
}
```

`TableName` stores an optional display name for the table. If it is blank, the UI displays `Table`.

The keys are:

- `v`: table storage version. Current value is `1`.
- `t`: theme. Supported values are `plain`, `soft`, and `grid`.
- `h`: bold header row. `1` is enabled, `0` is disabled.
- `c`: bold first column. `1` is enabled, `0` is disabled.
- `r`: rows. Each inner array is one row.

Limits:

- Maximum 7 columns.
- Maximum 13 rows.
- Empty trailing rows and cells are removed when copying.

Table cells may contain sanitized inline HTML. The table highlighter wraps selected words in a span with yellow background and dark text:

```html
<span style="background-color: yellow; color: #102114">highlighted text</span>
```

The dark text color is stored with the highlight so highlighted words remain readable in dark mode. Older saved table cells that only have `background-color: yellow` are normalized to add `color: #102114` when they are sanitized for display or editing. On edit and `/sheet-preview`, the JSON is decoded back into the editor table and rendered through `safeTableCellHtml` after table-cell sanitization. On the log page, each cell is rendered through the same safe HTML pipe used by explanations.

## Highlight Selection Logic

The table highlight action does not use `document.execCommand`. Browser formatting commands were causing the first-click issue where the toolbar click removed the table selection and moved the cursor to the start of the cell.

Instead, the editor:

1. Captures the active table cell selection on mouseup or keyup.
2. Prevents the Highlight button mousedown from stealing focus.
3. Restores the captured range if the live selection was lost.
4. Wraps the selected range in the highlight span.
5. Syncs the changed cell HTML back into the table model.
6. Reselects the highlighted text after Angular updates the table DOM.

## Copy And Paste

`toTsvHeader()` copies the header above.

`toTsvRow()` maps the entry to the same header order and escapes tabs, quotes, and new lines. This allows rich explanation HTML and `TableData` JSON to stay inside the correct Google Sheet cells.

The sheet preview page can parse one row with or without a header. Multiple rows should include the header.

## Google Sheet Retrieval

The log page fetches gviz JSON from Google Sheets. The sheet service resolves headers from either the first row or gviz column labels. Each row is converted back into a `LinguaLogEntry`.

After retrieval, the app:

- Hides protected rows unless the user is logged in.
- Filters by language and source/translation mode.
- Searches source text, translations, explanation text, table text, and resources.
- Renders explanation HTML and table cell HTML through the safe HTML rendering path.
