export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

/**
 * Line diff via LCS. Bounded to keep the UI responsive: very large inputs fall
 * back to a coarse "replaced" diff instead of freezing the tab.
 */
export function diffLines(a: string, b: string, maxCells = 4_000_000): DiffLine[] {
  const A = a.split('\n');
  const B = b.split('\n');
  // Trim common prefix/suffix first; most edits are local.
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length;
  let endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) {
    endA--;
    endB--;
  }
  const head: DiffLine[] = A.slice(0, start).map((text) => ({ type: 'same', text }));
  const tail: DiffLine[] = A.slice(endA).map((text) => ({ type: 'same', text }));
  const a2 = A.slice(start, endA);
  const b2 = B.slice(start, endB);
  if (a2.length * b2.length > maxCells) {
    return [
      ...head,
      ...a2.map((text) => ({ type: 'del' as const, text })),
      ...b2.map((text) => ({ type: 'add' as const, text })),
      ...tail,
    ];
  }
  const n = a2.length;
  const m = b2.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        a2[i] === b2[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const mid: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a2[i] === b2[j]) {
      mid.push({ type: 'same', text: a2[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      mid.push({ type: 'del', text: a2[i++]! });
    } else {
      mid.push({ type: 'add', text: b2[j++]! });
    }
  }
  while (i < n) mid.push({ type: 'del', text: a2[i++]! });
  while (j < m) mid.push({ type: 'add', text: b2[j++]! });
  return [...head, ...mid, ...tail];
}
