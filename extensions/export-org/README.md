# pi-export-org

A [pi](https://pi.dev) extension that exports the current session branch to an
[Org-mode](https://orgmode.org) file.

## Usage

```
/export-org             → <cwd>/<session-id>.org
/export-org notes.org   → <cwd>/notes.org
```

Each conversation turn becomes an Org heading. Assistant tool calls (bash, read,
write, edit) are rendered as appropriate `#+begin_src` or `#+begin_example`
blocks. Token usage and session metadata are stored in `PROPERTIES` drawers.

## Install

```bash
pi install npm:pi-export-org
```

Or via git:

```bash
pi install git:github.com/leo-ar/pi-export-org
```

## What gets exported

- **User turns** — rendered as `* You [timestamp]` headings, with Markdown
  converted to Org syntax

- **Assistant turns** — rendered as `* Assistant [timestamp]` headings with
  model/provider in a `:PROPERTIES:` drawer

- **Bash calls** — command in `#+begin_src bash`, output in `#+begin_example`

- **File reads/writes** — syntax-highlighted `#+begin_src <lang>` blocks

- **Diffs** — `#+begin_src diff` blocks

- **Token totals** — accumulated across the session in the file-level
  `:PROPERTIES:` drawer

## Files

| File             | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `export-org.ts`  | Extension entry point — registers `/export-org`           |
| `md2org.ts`      | Markdown → Org-mode converter (mirrors `gptel-md2org.el`) |
| `md2org-test.ts` | Test suite (mirrors `gptel-md2org-test.el`)               |

**Run tests:**

```bash
node --experimental-strip-types md2org-test.ts
```

## License

LGPL v3 — see [LICENSE](LICENSE)
