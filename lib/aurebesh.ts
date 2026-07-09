// heads up: Aurebesh isn't its own language, it's just an alphabet for
// Basic (i.e. English). so these rules just fake the phonetic spelling
// (drop silent letters, simplify digraphs etc) so it reads right once the
// Aurebesh font kicks in. more info in README.txt if you're curious

const DIGRAPH_RULES: Array<[RegExp, string]> = [
  [/ough/gi, "uf"],
  [/tion/gi, "shun"],
  [/ph/gi, "f"],
  [/qu/gi, "kw"],
  [/ck/gi, "k"],
  [/x/gi, "ks"],
];

const SILENT_RULES: Array<[RegExp, string]> = [
  [/^kn/gi, "n"],
  [/^wr/gi, "r"],
  [/mb\b/gi, "m"],
];

export function toAurebesh(text: string): string {
  let result = text;
  for (const [pattern, replacement] of DIGRAPH_RULES) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of SILENT_RULES) {
    result = result.split(/\b/).map((word) => word.replace(pattern, replacement)).join("");
  }
  return result.toUpperCase();
}
