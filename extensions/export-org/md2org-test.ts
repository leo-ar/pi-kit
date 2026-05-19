/**
 * md2org-test.ts — mirrors every ERT test in gptel-md2org-test.el
 *
 * Run with:  node --experimental-strip-types md2org-test.ts
 */

import { md2org } from "./md2org.ts";

let passed = 0;
let failed = 0;

function test(name: string, input: string, expected: string): void {
  const actual = md2org(input);
  if (actual === expected) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}`);
    console.error(`    input:    ${JSON.stringify(input)}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// gptel-md2org-test-headings
test("headings", "### My Heading\nSome text.", "*** My Heading\nSome text.");

// gptel-md2org-test-bold
test(
  "bold (including multiline)",
  "This is **really** important and **bold\nacross lines**.",
  "This is *really* important and *bold\nacross lines*.",
);

// gptel-md2org-test-inline-code
test("inline code", "Run `npm install` first.", "Run =npm install= first.");

// gptel-md2org-test-code-blocks
test(
  "fenced code blocks",
  "```python\nprint('hello')\n```",
  "#+begin_src python\nprint('hello')\n#+end_src",
);

// gptel-md2org-test-mixed-content
test(
  "mixed content",
  '## Setup\nRun `init` to start. Do **not** forget!\n```elisp\n(message "done")\n```',
  '** Setup\nRun =init= to start. Do *not* forget!\n#+begin_src elisp\n(message "done")\n#+end_src',
);

// gptel-md2org-test-italics
test(
  "italics (* and _)",
  "This is *italic* and this is _italic_ too.",
  "This is /italic/ and this is /italic/ too.",
);

// gptel-md2org-test-table
test(
  "table separators",
  "| Name | Status |\n|---|---|\n| Alice | **Active** |\n| Bob | `Offline` |",
  "| Name | Status |\n|---+---|\n| Alice | *Active* |\n| Bob | =Offline= |",
);

// gptel-md2org-test-lists
test(
  "lists and task lists",
  "* Item 1\n* Item 2\n  * Nested\n- [ ] Todo\n- [x] Done",
  "- Item 1\n- Item 2\n  - Nested\n- [ ] Todo\n- [X] Done",
);

// gptel-md2org-test-heading-not-converted-to-list
test(
  "heading not clobbered by list conversion",
  "# Title\nSome text.\n## Subtitle\n* Item 1",
  "* Title\nSome text.\n** Subtitle\n- Item 1",
);

// gptel-md2org-test-setext-h1
test(
  "setext H1 (===)",
  "My Heading\n==========\nSome text.",
  "* My Heading\nSome text.",
);

// gptel-md2org-test-setext-h2
test(
  "setext H2 (---)",
  "My Subheading\n-------------\nSome text.",
  "** My Subheading\nSome text.",
);

// gptel-md2org-test-setext-h2-not-hr
test(
  "bare --- is NOT setext H2",
  "Some text.\n---\nMore text.",
  "Some text.\n---\nMore text.",
);

// gptel-md2org-test-setext-in-mixed-content
test(
  "setext in mixed content",
  "You\n===\nRun `init` to start.\n\nAssistant\n=========\n## Result\nDo **not** forget!",
  "* You\nRun =init= to start.\n\n* Assistant\n** Result\nDo *not* forget!",
);

// gptel-md2org-test-setext-not-in-code-block
test(
  "setext not converted inside fenced code block",
  "```\nHeading\n=======\n```",
  "#+begin_src\nHeading\n=======\n#+end_src",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
