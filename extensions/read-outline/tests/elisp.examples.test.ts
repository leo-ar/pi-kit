import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateElispOutline } from "../src/languages/elisp.ts";

describe("generateElispOutline — examples", () => {
  it("detects defun", async () => {
    const lines = [
      "(defun my-func (arg1 arg2)",
      '  "Docstring."',
      "  (let ((x (+ arg1 arg2)))",
      '    (message "Result: %s" x)',
      "    x))",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "my-func");
    assert.strictEqual(result[0].kind, "fn");
    assert.strictEqual(result[0].startLine, 1);
    assert.strictEqual(result[0].endLine, 5);
    assert.strictEqual(result[0].exported, true);
  });

  it("detects defvar", async () => {
    const lines = [
      '(defvar my-var 42 "A variable.")',
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "my-var");
    assert.strictEqual(result[0].kind, "var");
    assert.strictEqual(result[0].startLine, 1);
    assert.strictEqual(result[0].endLine, 1);
  });

  it("detects defmacro", async () => {
    const lines = [
      "(defmacro my-macro (body)",
      "  `(progn ,body))",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "my-macro");
    assert.strictEqual(result[0].kind, "macro");
    assert.strictEqual(result[0].startLine, 1);
    assert.strictEqual(result[0].endLine, 2);
  });

  it("detects defcustom", async () => {
    const lines = [
      "(defcustom my-indent-level 2",
      '  "Number of spaces for indentation."',
      "  :type 'integer",
      "  :group 'my-mode)",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "my-indent-level");
    assert.strictEqual(result[0].kind, "var");
  });

  it("detects define-minor-mode", async () => {
    const lines = [
      "(define-minor-mode my-mode",
      '  "Toggle my-mode."',
      "  :lighter \" My\"",
      "  :keymap my-mode-map)",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "my-mode");
    assert.strictEqual(result[0].kind, "mode");
  });

  it("detects multiple top-level forms", async () => {
    const lines = [
      ";;; my-package.el --- Description",
      "",
      '(defvar my-var nil "A var.")',
      "",
      "(defun my-func (x)",
      '  "Increment x."',
      "  (1+ x))",
      "",
      "(defmacro my-mac (form)",
      "  `(progn ,form))",
      "",
      "(provide 'my-package)",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].name, "my-var");
    assert.strictEqual(result[1].name, "my-func");
    assert.strictEqual(result[2].name, "my-mac");
  });

  it("marks double-dash names as internal (not exported)", async () => {
    const lines = [
      "(defun my-pkg--internal ()",
      "  (message \"internal\"))",
      "",
      "(defun my-pkg-public ()",
      "  (message \"public\"))",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "my-pkg--internal");
    assert.strictEqual(result[0].exported, false);
    assert.strictEqual(result[1].name, "my-pkg-public");
    assert.strictEqual(result[1].exported, true);
  });

  it("returns empty for non-definition forms", async () => {
    const lines = [
      "(require 'cl-lib)",
      "",
      "(message \"hello\")",
      "",
      "(provide 'my-pkg)",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 0);
  });

  it("handles defconst", async () => {
    const lines = [
      '(defconst my-version "1.0.0"',
      '  "The current version.")',
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "my-version");
    assert.strictEqual(result[0].kind, "var");
  });

  it("handles a realistic init.el snippet", async () => {
    const lines = [
      ";;; init.el --- Personal configuration",
      "",
      "(defcustom my-theme 'modus-vivendi",
      '  "Default theme."',
      "  :type 'symbol)",
      "",
      "(defun my-reload-config ()",
      '  "Reload configuration."',
      "  (interactive)",
      '  (load-file user-init-file))',
      "",
      "(defvar my--cache (make-hash-table :test 'equal))",
      "",
      "(define-minor-mode my-writing-mode",
      '  "A mode for focused writing."',
      "  :lighter \" Write\"",
      "  (if my-writing-mode",
      "      (progn",
      "        (setq-local line-spacing 0.5)",
      "        (display-line-numbers-mode -1))",
      "    (kill-local-variable 'line-spacing)",
      "    (display-line-numbers-mode 1)))",
    ];
    const result = await generateElispOutline(lines);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].name, "my-theme");
    assert.strictEqual(result[0].kind, "var");
    assert.strictEqual(result[1].name, "my-reload-config");
    assert.strictEqual(result[1].kind, "fn");
    assert.strictEqual(result[2].name, "my--cache");
    assert.strictEqual(result[2].exported, false);
    assert.strictEqual(result[3].name, "my-writing-mode");
    assert.strictEqual(result[3].kind, "mode");
  });
});
