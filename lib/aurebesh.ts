// Aurebesh is a transliteration alphabet for Basic (English), not a distinct
// language. These rules approximate conventional Aurebesh phonetic spelling
// (silent letters dropped, common digraphs simplified) so that rendering the
// result in an Aurebesh font reads naturally. See README.txt for details.

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
