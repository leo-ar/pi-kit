/** Find closing brace for languages with { } blocks */
export function findBlockEnd(lines: string[], startIdx: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") { depth++; foundOpen = true; }
      if (ch === "}") { depth--; }
      if (foundOpen && depth === 0) return i;
    }
  }

  // If no braces found, it's a single-line declaration
  if (!foundOpen) return startIdx;

  // Unclosed block — return end of file
  return lines.length - 1;
}

/** Find end of a statement (handles multi-line const = ... ) */
export function findStatementEnd(lines: string[], startIdx: number): number {
  let depth = 0;
  let parenDepth = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (ch === "(") parenDepth++;
      if (ch === ")") parenDepth--;
    }
    // Statement ends when we're back to zero depth and line doesn't end with comma/operator
    if (i > startIdx && depth === 0 && parenDepth === 0) {
      const trimmed = line.trim();
      if (!trimmed.endsWith(",") && !trimmed.endsWith("(") && !trimmed.endsWith("{")) {
        return i;
      }
    }
  }
  return startIdx;
}

/** Find end of a Python block (indentation-based) */
export function findPythonBlockEnd(lines: string[], startIdx: number): number {
  const startIndent = lines[startIdx].length - lines[startIdx].trimStart().length;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue; // Skip blank lines
    const indent = line.length - line.trimStart().length;
    if (indent <= startIndent) return i - 1;
  }

  return lines.length - 1;
}

/** Find end of a Ruby block (end keyword based) */
export function findRubyBlockEnd(lines: string[], startIdx: number): number {
  const startIndent = lines[startIdx].length - lines[startIdx].trimStart().length;
  let depth = 1;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (/^(class|module|def|do|if|unless|case|begin|while|until|for)\b/.test(trimmed) && indent >= startIndent) {
      depth++;
    }
    if (trimmed === "end" || trimmed.startsWith("end ")) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return lines.length - 1;
}
