/**
 * Lightweight regex-based syntax highlighter.
 *
 * Output is a list of tokens with kinds — the editor renders them as spans
 * and looks up colors via the `tokenClass` table. The tokenizer is line-aware
 * (newlines are emitted as separate "newline" tokens) so the editor can
 * render line numbers cheaply by counting them.
 *
 * Languages share a small set of token kinds; ordering of patterns inside
 * each language matters (comment > string > number > keyword > identifier).
 */

export type TokenKind =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "boolean"
  | "type"
  | "function"
  | "operator"
  | "punctuation"
  | "tag"
  | "attribute"
  | "property"
  | "heading"
  | "link"
  | "code"
  | "text"
  | "newline";

export interface Token {
  kind: TokenKind;
  value: string;
}

export type Language = "javascript" | "typescript" | "json" | "python" | "css" | "html" | "markdown" | "plaintext";

interface Rule {
  kind: TokenKind;
  re: RegExp;
}

const JS_KEYWORDS = new Set([
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "finally", "for", "from", "function", "if", "implements", "import", "in",
  "instanceof", "interface", "let", "new", "of", "package", "private", "protected",
  "public", "readonly", "return", "static", "super", "switch", "this", "throw",
  "try", "type", "typeof", "var", "void", "while", "with", "yield",
]);
const JS_TYPES = new Set([
  "string", "number", "boolean", "any", "unknown", "never", "void", "object",
  "Array", "Map", "Set", "Promise", "Date", "RegExp", "Error",
]);
const JS_BOOLEANS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);

const PY_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield",
]);
const PY_BOOLEANS = new Set(["True", "False", "None"]);

const CSS_KEYWORDS = new Set([
  "important", "inherit", "initial", "unset", "auto", "none", "block", "inline",
  "flex", "grid", "absolute", "relative", "fixed", "sticky", "static",
]);

/**
 * Detect a language from filename or mime type. Returns "plaintext" if
 * nothing matches.
 */
export function detectLanguage(name: string, mime?: string): Language {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (mime) {
    if (mime.includes("javascript")) return "javascript";
    if (mime.includes("typescript")) return "typescript";
    if (mime === "application/json") return "json";
    if (mime === "text/css") return "css";
    if (mime === "text/html") return "html";
    if (mime === "text/markdown") return "markdown";
  }
  return "plaintext";
}

/**
 * CSS class assigned to each token kind. The values are tuned for a dark
 * editor theme but only use neutral Tailwind colors so they read fine on
 * any wallpaper / system theme.
 */
export const tokenClass: Record<TokenKind, string> = {
  comment: "text-emerald-300/60 italic",
  string: "text-amber-200",
  number: "text-orange-300",
  keyword: "text-pink-300",
  boolean: "text-orange-300",
  type: "text-cyan-300",
  function: "text-sky-300",
  operator: "text-slate-300",
  punctuation: "text-slate-400",
  tag: "text-rose-300",
  attribute: "text-amber-200",
  property: "text-cyan-200",
  heading: "text-sky-300 font-semibold",
  link: "text-sky-300 underline",
  code: "text-amber-200",
  text: "text-[#cdd6f4]",
  newline: "",
};

const JS_RULES: Rule[] = [
  { kind: "comment", re: /\/\*[\s\S]*?\*\// },
  { kind: "comment", re: /\/\/[^\n]*/ },
  { kind: "string", re: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/ },
  { kind: "number", re: /\b(?:0x[0-9a-fA-F]+|0b[01]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/ },
  { kind: "function", re: /\b[A-Za-z_$][\w$]*(?=\s*\()/ },
  { kind: "keyword", re: /\b[A-Za-z_$][\w$]*\b/ },
  { kind: "operator", re: /[+\-*/%=!<>&|^~?:]+/ },
  { kind: "punctuation", re: /[{}[\]().,;]/ },
];

const PY_RULES: Rule[] = [
  { kind: "comment", re: /#[^\n]*/ },
  { kind: "string", re: /(?:r|b|rb|br)?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/i },
  { kind: "number", re: /\b\d+(?:\.\d+)?\b/ },
  { kind: "function", re: /\b[A-Za-z_][\w]*(?=\s*\()/ },
  { kind: "keyword", re: /\b[A-Za-z_][\w]*\b/ },
  { kind: "operator", re: /[+\-*/%=!<>&|^~]+/ },
  { kind: "punctuation", re: /[{}[\]().,;:]/ },
];

const JSON_RULES: Rule[] = [
  { kind: "string", re: /"(?:\\.|[^"\\\n])*"/ },
  { kind: "number", re: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i },
  { kind: "boolean", re: /\b(?:true|false|null)\b/ },
  { kind: "punctuation", re: /[{}[\]:,]/ },
];

const CSS_RULES: Rule[] = [
  { kind: "comment", re: /\/\*[\s\S]*?\*\// },
  { kind: "string", re: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/ },
  { kind: "number", re: /-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?\b/ },
  { kind: "tag", re: /(?<![\w-])[#.][\w-]+/ },
  { kind: "property", re: /\b[a-z-]+(?=\s*:)/ },
  { kind: "keyword", re: /\b[A-Za-z-]+\b/ },
  { kind: "operator", re: /[>+~*]/ },
  { kind: "punctuation", re: /[{};:,()]/ },
];

const HTML_RULES: Rule[] = [
  { kind: "comment", re: /<!--[\s\S]*?-->/ },
  { kind: "string", re: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/ },
  { kind: "tag", re: /<\/?[A-Za-z][\w-]*/ },
  { kind: "attribute", re: /\b[A-Za-z-]+(?==)/ },
  { kind: "punctuation", re: /[<>/=]/ },
];

const MD_RULES: Rule[] = [
  { kind: "code", re: /```[\s\S]*?```/ },
  { kind: "code", re: /`[^`\n]+`/ },
  { kind: "heading", re: /^#{1,6} [^\n]*/m },
  { kind: "link", re: /\[[^\]]+\]\([^)]+\)/ },
  { kind: "keyword", re: /\*\*[^*\n]+\*\*|__[^_\n]+__/ },
  { kind: "string", re: /\*[^*\n]+\*|_[^_\n]+_/ },
  { kind: "punctuation", re: /^[-*+] /m },
];

const RULES_FOR: Record<Language, Rule[]> = {
  javascript: JS_RULES,
  typescript: JS_RULES,
  python: PY_RULES,
  json: JSON_RULES,
  css: CSS_RULES,
  html: HTML_RULES,
  markdown: MD_RULES,
  plaintext: [],
};

/**
 * Refine a "keyword" token into keyword / boolean / type for the languages
 * that use the same identifier rule for all three (JS / TS / Python).
 */
function refineKeyword(lang: Language, value: string): TokenKind {
  if (lang === "javascript" || lang === "typescript") {
    if (JS_KEYWORDS.has(value)) return "keyword";
    if (JS_BOOLEANS.has(value)) return "boolean";
    if (JS_TYPES.has(value)) return "type";
    return "text";
  }
  if (lang === "python") {
    if (PY_KEYWORDS.has(value)) return "keyword";
    if (PY_BOOLEANS.has(value)) return "boolean";
    return "text";
  }
  if (lang === "css") {
    if (CSS_KEYWORDS.has(value)) return "keyword";
    return "text";
  }
  return "text";
}

/**
 * Tokenize `source` into a flat list of tokens. Newlines become standalone
 * "newline" tokens so the renderer can map tokens 1:1 to lines.
 */
export function tokenize(source: string, lang: Language): Token[] {
  if (lang === "plaintext" || RULES_FOR[lang].length === 0) {
    return splitOnNewlines(source).map((part) =>
      part === "\n" ? { kind: "newline", value: "\n" } : { kind: "text", value: part },
    );
  }
  const rules = RULES_FOR[lang];
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\n") {
      out.push({ kind: "newline", value: "\n" });
      i++;
      continue;
    }
    let matched: { kind: TokenKind; value: string } | null = null;
    for (const rule of rules) {
      // Always anchor matches at index `i`.
      const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`);
      re.lastIndex = i;
      const m = re.exec(source);
      if (m && m.index === i) {
        let kind = rule.kind;
        if (kind === "keyword") kind = refineKeyword(lang, m[0]);
        matched = { kind, value: m[0] };
        break;
      }
    }
    if (matched) {
      // Multi-line tokens (e.g. block comments, template strings, triple-quoted
      // strings) need their internal newlines hoisted out so the line counter
      // stays accurate. Split the match on newlines and emit alternating
      // value-segment / newline tokens.
      if (matched.value.includes("\n")) {
        const parts = matched.value.split("\n");
        for (let p = 0; p < parts.length; p++) {
          if (parts[p] !== "") out.push({ kind: matched.kind, value: parts[p] });
          if (p < parts.length - 1) out.push({ kind: "newline", value: "\n" });
        }
      } else {
        out.push(matched);
      }
      i += matched.value.length;
      continue;
    }
    // No rule matched → treat this single character as plain text. Greedy
    // accumulation would be nicer but the inner loop runs ~O(rules) per
    // unmatched char which is fine for editor-sized files.
    out.push({ kind: "text", value: ch });
    i++;
  }
  return out;
}

function splitOnNewlines(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of s) {
    if (ch === "\n") {
      if (buf !== "") {
        out.push(buf);
        buf = "";
      }
      out.push("\n");
    } else {
      buf += ch;
    }
  }
  if (buf !== "") out.push(buf);
  return out;
}

/**
 * Pretty label for a language code (used in the editor status bar).
 */
export function languageLabel(lang: Language): string {
  switch (lang) {
    case "javascript": return "JavaScript";
    case "typescript": return "TypeScript";
    case "json": return "JSON";
    case "python": return "Python";
    case "css": return "CSS";
    case "html": return "HTML";
    case "markdown": return "Markdown";
    case "plaintext": return "Plain Text";
  }
}
