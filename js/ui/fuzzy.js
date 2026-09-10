/* ================================================================
   FUZZY.JS — Subsequence matching with fzf-style scoring

   Ranks candidates for the command palette. A query matches if its
   characters appear in order (not necessarily adjacently), and the
   score rewards the things that make a match feel "right":

     +16  characters that are adjacent in the candidate
     +14  a character at a word boundary (start, after -, _, space)
     +10  a match at the very beginning
      -3  per skipped character, so tight matches win
     ×1.2 exact case match

   Returns null for a non-match, otherwise { score, positions } so
   the UI can highlight the matched characters.
================================================================ */

const BOUNDARY = /[\s\-_/.:]/;

export function fuzzyMatch(query, candidate) {
  if (!query) return { score: 0, positions: [] };

  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  let score = 0;
  let qi = 0;
  let lastMatch = -1;
  const positions = [];

  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] !== q[qi]) continue;

    let bonus = 1;
    if (ci === 0) bonus += 10;
    else if (BOUNDARY.test(c[ci - 1])) bonus += 14;
    if (lastMatch === ci - 1) bonus += 16;
    if (candidate[ci] === query[qi]) bonus *= 1.2;      // case-exact
    if (lastMatch !== -1) bonus -= Math.min((ci - lastMatch - 1) * 3, 12);

    score += bonus;
    positions.push(ci);
    lastMatch = ci;
    qi++;
  }

  if (qi < q.length) return null;                        // not a subsequence

  // Shorter candidates win ties: "ls" beats "linkedin" for "ls".
  score += Math.max(0, 20 - candidate.length * 0.4);
  return { score, positions };
}

/** Rank a list of items by a string field, dropping non-matches. */
export function fuzzyRank(query, items, getText) {
  return items
    .map((item) => {
      const match = fuzzyMatch(query, getText(item));
      return match ? { item, ...match } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}
