# Utility Division Lookup

Two pages, both single-file HTML:

- `lookup.html`: one-screen finder. Enter an account number and get the utility and division. Electric
  accounts also need a city. Nothing is stored.
- `eversource-division-finder.html`: the same one-screen finder with Eversource branding. Fully
  self-contained (no fonts, scripts or network requests), so it works offline from a single file.
  Brand colors are approximations; change `--brand` and `--brand-accent` at the top of the file to match
  the brand guide.
- `index.html`: spreadsheet-style table for many accounts, with editable lists (saved in the browser).

Single-file HTML replacement for `Final Utility Division Template - Update.xlsx`.
Open `index.html` in any browser. No build step, no server, no dependencies.

## Rules (same as the workbook)

| Account prefix | Utility | Division |
| --- | --- | --- |
| `73` | Gas | `30` (city not needed) |
| `74` | Electric | `80` if the city is in the North list, `70` if it is in the South list |

North is checked first, as in the workbook's formula. City matching ignores capitals and extra spaces.

## Using it

- Type or paste account numbers and cities. Pasting two columns from Excel fills down.
- **Copy divisions** puts one column on the clipboard in row order, ready to paste back into Excel.
- **Copy table** copies account, city, utility and division as tab-separated text.
- The **Lists** tab edits the division numbers, the prefixes and the North, South and dropdown city lists.
  Everything is saved in the browser's local storage on that device.

## Differences from the workbook

- Electric accounts whose city is in neither list show a warning with one-click "Add to North / South"
  instead of a silent blank.
- `BARNSTABLE - BAR` is in the workbook's dropdown but was in neither list, so it returned a blank there.
  It is now in the South list (division 70).
- `Framingham` is in both lists. North wins (80), as in the workbook. The Lists tab flags the overlap.
- The first four rows are examples. Use **Clear examples** to start fresh.
