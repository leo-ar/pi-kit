/**
 * Lazy tree-sitter initialization singleton.
 *
 * Only initializes WASM runtime on first use. Caches loaded grammars and
 * parser instances per language. Falls back gracefully if WASM fails to load.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAMMAR_DIR = join(__dirname, "grammars");

// We use dynamic import to avoid loading web-tree-sitter until needed
let Parser: any = null;
let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, any>();
const parserCache = new Map<string, any>();

const GRAMMAR_FILES: Record<string, string> = {
  elisp: "tree-sitter-elisp.wasm",
  php: "tree-sitter-php.wasm",
};

async function ensureInit(): Promise<void> {
  if (Parser) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mod = await import("web-tree-sitter");
    Parser = mod.default ?? mod;
    await Parser.init();
  })();

  return initPromise;
}

/**
 * Get a parser configured for the given language.
 * Returns null if the grammar is not available or fails to load.
 */
export async function getParser(lang: string): Promise<any | null> {
  const grammarFile = GRAMMAR_FILES[lang];
  if (!grammarFile) return null;

  if (parserCache.has(lang)) return parserCache.get(lang);

  try {
    await ensureInit();

    if (!languageCache.has(lang)) {
      const langObj = await Parser.Language.load(join(GRAMMAR_DIR, grammarFile));
      languageCache.set(lang, langObj);
    }

    const parser = new Parser();
    parser.setLanguage(languageCache.get(lang));
    parserCache.set(lang, parser);
    return parser;
  } catch {
    // Graceful fallback — tree-sitter unavailable
    return null;
  }
}

/**
 * Parse source code using tree-sitter.
 * Returns the root node, or null if parsing fails.
 */
export async function parseSource(lang: string, source: string): Promise<any | null> {
  const parser = await getParser(lang);
  if (!parser) return null;

  try {
    const tree = parser.parse(source);
    return tree.rootNode;
  } catch {
    return null;
  }
}
