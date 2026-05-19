/**
 * md2org.ts — Markdown → Org-mode converter
 *
 * Mirrors gptel-md2org.el step-for-step, including the same protection
 * mechanism (protected regions are tracked by character offset ranges and
 * skipped by subsequent passes, just as Emacs text-properties do).
 *
 * Pass order (matches the Elisp):
 *  1. Fenced code blocks   (```lang … ```)  → #+begin_src lang … #+end_src
 *  2. Inline code          (`code`)          → =code=
 *  3. Links                ([T](U))          → [[U][T]]
 *  4. Bold                 (**t**)           → *t*
 *  4b. Italics             (*t* / _t_)       → /t/
 *  4c. Setext headings     text\n===         → * text   (before ATX + lists)
 *  5. ATX headings         ### Heading       → *** Heading
 *  5b. Lists               * item / [x]      → - item / [X]
 *  6. Table separators     |---|---| rows    → |---+---|
 */

// ---------------------------------------------------------------------------
// Protection tracker
// ---------------------------------------------------------------------------

/** A sorted list of [start, end) byte-offset ranges that must not be touched
 *  by later passes.  "end" is exclusive. */
type Protected = Array<[number, number]>;

function isProtected(pos: number, ranges: Protected): boolean {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
    if (s > pos) break; // sorted
  }
  return false;
}

function protect(ranges: Protected, start: number, end: number): void {
  ranges.push([start, end]);
  ranges.sort((a, b) => a[0] - b[0]);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function md2org(input: string): string {
  let s = input;
  const prot: Protected = [];

  // ------------------------------------------------------------------
  // 1. Fenced code blocks:  ```lang\n…\n```  →  #+begin_src lang\n…\n#+end_src
  // ------------------------------------------------------------------
  {
    // Match opening fence: optional leading blanks, ```, optional lang, EOL
    const openRe = /^[^\S\n]*```([^\s]*)[^\S\n]*$/gm;
    let m: RegExpExecArray | null;
    while ((m = openRe.exec(s)) !== null) {
      if (isProtected(m.index, prot)) continue;

      const lang = m[1];
      const openStart = m.index;
      const openEnd = m.index + m[0].length;

      // Find closing fence after the opening
      const closingRe = /^[^\S\n]*```[^\S\n]*$/gm;
      closingRe.lastIndex = openEnd + 1; // skip past opening line
      const mc = closingRe.exec(s);
      if (!mc) break;

      const closeStart = mc.index;
      const closeEnd = mc.index + mc[0].length;

      const openRepl = lang ? `#+begin_src ${lang}` : `#+begin_src`;
      const closeRepl = `#+end_src`;

      // Replace close first (higher index) so offsets stay valid for open
      s = s.slice(0, closeStart) + closeRepl + s.slice(closeEnd);

      s = s.slice(0, openStart) + openRepl + s.slice(openEnd);

      // Protect the whole block in the new string
      const blockEnd =
        openStart + openRepl.length + (closeStart - openEnd) + closeRepl.length;
      protect(prot, openStart, blockEnd);

      // Restart search from beginning of this block (length may have changed)
      openRe.lastIndex = openStart;
    }
  }

  // ------------------------------------------------------------------
  // 2. Inline code:  `code`  →  =code=
  // ------------------------------------------------------------------
  {
    const re = /`(.+?)`/gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const repl = `=${m[1]}=`;
      s = s.slice(0, m.index) + repl + s.slice(m.index + m[0].length);
      protect(prot, m.index, m.index + repl.length);
      re.lastIndex = m.index + repl.length;
    }
  }

  // ------------------------------------------------------------------
  // 3. Links:  [Text](URL)  →  [[URL][Text]]
  // ------------------------------------------------------------------
  {
    const re = /\[([^\]]+?)\]\(([^)]+?)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const repl = `[[${m[2]}][${m[1]}]]`;
      s = s.slice(0, m.index) + repl + s.slice(m.index + m[0].length);
      re.lastIndex = m.index + repl.length;
    }
  }

  // ------------------------------------------------------------------
  // 4. Bold:  **text**  →  *text*
  // ------------------------------------------------------------------
  {
    const re = /\*\*(.+?)\*\*/gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const repl = `*${m[1]}*`;
      s = s.slice(0, m.index) + repl + s.slice(m.index + m[0].length);
      protect(prot, m.index, m.index + repl.length);
      re.lastIndex = m.index + repl.length;
    }
  }

  // ------------------------------------------------------------------
  // 4b. Italics:  *text*  or  _text_  →  /text/
  //     Must come after bold so **bold** is already consumed.
  //     Single-line only (no newline inside), matching * or _ delimiters.
  // ------------------------------------------------------------------
  {
    const re = /([*_])([^*_\n]+?)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const repl = `/${m[2]}/`;
      s = s.slice(0, m.index) + repl + s.slice(m.index + m[0].length);
      re.lastIndex = m.index + repl.length;
    }
  }

  // ------------------------------------------------------------------
  // 4c. Setext headings
  //     text line not ending in [.!?:,]  followed by ===… or ---…
  //     ===…  →  * text
  //     ---…  →  ** text
  //     Must come before ATX headings and list conversion.
  // ------------------------------------------------------------------
  {
    // The Elisp guard: last char of text must NOT be in ".!?:,"
    const re = /^([^\n]+[^.!?:,\n])\n(=+|-+)[^\S\n]*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const text = m[1];
      const ul = m[2];
      const level = ul[0] === "=" ? "*" : "**";
      const repl = `${level} ${text}`;
      s = s.slice(0, m.index) + repl + s.slice(m.index + m[0].length);
      protect(prot, m.index, m.index + repl.length);
      re.lastIndex = m.index + repl.length;
    }
  }

  // ------------------------------------------------------------------
  // 5. ATX headings:  ### Heading  →  *** Heading
  // ------------------------------------------------------------------
  {
    const re = /^(#+)[ \t]+/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const stars = "*".repeat(m[1].length) + " ";
      s = s.slice(0, m.index) + stars + s.slice(m.index + m[0].length);
      protect(prot, m.index, m.index + stars.length);
      re.lastIndex = m.index + stars.length;
    }
  }

  // ------------------------------------------------------------------
  // 5b-i. Lists:  ^(spaces)* item  →  (spaces)- item
  // ------------------------------------------------------------------
  {
    const re = /^([ \t]*)\*[ \t]+/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      const repl = `${m[1]}- `;
      s = s.slice(0, m.index) + repl + s.slice(m.index + m[0].length);
      re.lastIndex = m.index + repl.length;
    }
  }

  // ------------------------------------------------------------------
  // 5b-ii. Task checkboxes:  [x] / [X]  →  [X]
  // ------------------------------------------------------------------
  {
    const re = /\[[xX]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      s = s.slice(0, m.index) + "[X]" + s.slice(m.index + m[0].length);
      re.lastIndex = m.index + 3;
    }
  }

  // ------------------------------------------------------------------
  // 6. Table separators:  |---|---| row  →  replace - | - with - + -
  // ------------------------------------------------------------------
  {
    const re = /^[ \t]*\|[-: |]+$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (isProtected(m.index, prot)) {
        continue;
      }
      // Replace every  -|  or  |-  boundary with  -+  / +-
      // Elisp does: replace (group "-") "|" (group "-") with \1+\2
      const orig = m[0];
      const repl = orig.replace(/(-)\|(-)/g, "$1+$2");
      if (repl !== orig) {
        s = s.slice(0, m.index) + repl + s.slice(m.index + orig.length);
        re.lastIndex = m.index + repl.length;
      }
    }
  }

  return s;
}
