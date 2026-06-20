# LinguaLog Sheet Storage Logic

This app stores one language log entry as one Google Sheet row. The app copies and reads tab-separated values so the row can move between the converter, Google Sheets, the sheet preview page, and the log page without changing shape.

## Current Sheet Header

Use this header order in Google Sheets:

```tsv
EntryId	CreatedAt	UpdatedAt	Protected	SourceLanguage	SourceOtherLanguage	SourceText	SourceTransliteration	Tamil	English	Sanskrit	Hindi	Kannada	Malayalam	Telugu	French	OtherLanguage	Other	ExplanationHtml	TableData	Resource1Label	Resource1Value	Resource2Label	Resource2Value
```

## Main Row Fields

`EntryId` is a generated id used to keep an entry stable while editing.

`CreatedAt` is the first created timestamp. `UpdatedAt` is regenerated each time the row is copied.

`Protected` stores `Yes` or `No`. The log page hides protected rows until the user logs in.

`SourceLanguage` stores the original language selected in the converter. If the source is `Other`, `SourceOtherLanguage` stores the temporary language name.

`SourceText` stores the original sentence. `SourceTransliteration` stores the optional reading aid for the original sentence.

The language columns (`Tamil`, `English`, `Sanskrit`, `Hindi`, `Kannada`, `Malayalam`, `Telugu`, `French`, `Other`) store the source sentence and translations by language. When a language is `Other`, `OtherLanguage` stores the temporary language name and `Other` stores the sentence text.

## Rich Text Explanation

The explanation editor stores formatted notes as HTML in `ExplanationHtml`.

Before copying to the sheet, the app sanitizes and minifies the HTML. This removes unnecessary line breaks and spacing between tags so a value like this:

```html
Breakdown:<br />
<ul>
  <li><b>word</b> = meaning</li>
</ul>
```

is copied as:

```html
Breakdown:<br />
<ul>
  <li><b>word</b> = meaning</li>
</ul>
```

The explanation supports these common formats:

- Bold, italic, and strikethrough.
- Ordered and unordered lists.
- One level of list indentation and outdent.
- Text color and background color from the predefined color controls.

When the log page displays `ExplanationHtml`, it passes the value through the safe explanation HTML pipe before rendering. This keeps the stored HTML useful for formatting while avoiding arbitrary unsafe markup.

## Table Storage

The optional table is stored in `TableData` as compact JSON. The current shape is:

```json
{
  "v": 1,
  "t": "soft",
  "h": 1,
  "c": 0,
  "r": [
    ["Header", "Value"],
    ["Word", "Meaning"]
  ]
}
```

The keys mean:

- `v`: storage version. Current value is `1`.
- `t`: table theme. Supported values are `plain`, `soft`, and `grid`.
- `h`: bold first row. `1` means enabled, `0` means disabled.
- `c`: bold first column. `1` means enabled, `0` means disabled.
- `r`: table rows. Each inner array is one row.

The table is limited to 7 columns and 13 rows. Empty trailing rows and empty trailing cells are removed before copying so the JSON stays small.

Table cells may contain plain text or sanitized inline HTML. Highlighted words are stored inside a span, for example:

```html
<span style="background-color: yellow">highlighted words</span>
```

When the app retrieves a row, it parses `TableData`, restores the table options, and renders the cells. Cell HTML is sanitized again before display.

## Resources

Resources are stored as label/value pairs:

- `Resource1Label`
- `Resource1Value`
- `Resource2Label`
- `Resource2Value`

The label is optional. If it is blank, the log page displays a simple fallback label such as `Resource 1`. The value may be a URL, title, person, show, post, or other short source note. If the value looks like a URL, the log page renders it as a link that opens in a new tab.

## Copy And Preview Flow

The converter builds a `LinguaLogEntry` object from the form. `toSheetCells()` maps that object to the header order above. `toTsvRow()` escapes tabs, quotes, and new lines so complex explanation HTML and table JSON can be pasted safely into Google Sheets.

The sheet preview page parses pasted TSV. A single row can be pasted with or without the header. Multiple rows should include the header so the app can map columns correctly.

## Google Sheet Retrieval

The log page fetches the sheet through the Google Visualization API response. The first sheet row is treated as the header row when it matches known LinguaLog column names.

Rows are converted back into `LinguaLogEntry` objects. The log page then:

- Filters protected rows unless the user is logged in.
- Filters by selected language and source/translation mode.
- Searches source text, translations, explanation text, table text, and resources.
- Displays explanation HTML and table cell HTML through the safe HTML rendering path.
