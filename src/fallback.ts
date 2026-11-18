// A component's fallback text, `[…]` (spec §4.4): where it ends.

/**
 * The offset after the `]` that closes a fallback whose `[` is at `from`. Brackets nest, `\[` and `\]` don't count, and
 * code spans bind tighter, so a `]` inside backticks doesn't close it.
 *
 * @returns the offset after the closing `]`, or `undefined` when the fallback isn't closed in `text`.
 *
 * @example
 * fallbackEnd("[a [b] c] rest", 0); // 9
 */
export function fallbackEnd(text: string, from: number): number | undefined {
  let depth = 0;
  for (let at = from; at < text.length; at++) {
    const char = text[at];
    if (char === "\\") at++;
    else if (char === "`") at = codeSpanEnd(text, at) - 1;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return at + 1;
  }
  return undefined;
}

/** The offset after the code span whose opening backticks are at `from`, or after the backticks if it isn't closed. */
function codeSpanEnd(text: string, from: number): number {
  const run = /^`+/.exec(text.slice(from))![0];
  const close = text.indexOf(run, from + run.length);
  return close >= 0 ? close + run.length : from + run.length;
}
