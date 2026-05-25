# export-org

A pi extension that exports the current session to an
[Org-mode](https://orgmode.org) file.

## Why?

Org-mode is a natural archival format for LLM sessions — headings map to turns,
source blocks map to tool calls, and properties drawers capture metadata. This
extension makes sessions reviewable and searchable in Emacs.

## How it works

Registers `/export-org` which walks the current session branch, converts
Markdown to Org syntax, and writes a `.org` file.

```
/export-org             → <cwd>/<session-id>.org
/export-org notes.org   → <cwd>/notes.org
```

Each turn becomes an Org heading. Tool calls render as `#+begin_src` blocks.
Token usage and metadata go in `:PROPERTIES:` drawers.

## What gets exported

| Content | Org rendering |
|---------|---------------|
| User turns | `* You [timestamp]` heading |
| Assistant turns | `* Assistant [timestamp]` with model/provider properties |
| Bash calls | `#+begin_src bash` + `#+begin_example` output |
| File reads/writes | `#+begin_src <lang>` (language inferred from extension) |
| Diffs | `#+begin_src diff` |
| Token totals | File-level `:PROPERTIES:` drawer |

## Commands

| Command | Effect |
|---------|--------|
| `/export-org` | Export to `<session-id>.org` in cwd |
| `/export-org path.org` | Export to specified path |

## Install

```bash
pi install git:github.com/leo-ar/pi-kit extensions/export-org
```

Or symlink for development:
```bash
ln -s /path/to/pi-kit/extensions/export-org ~/.pi/agent/extensions/export-org
```
