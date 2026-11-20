const maxStatusLength = 120;
const boldHeading = /^(\*\*|__)(.+?)\1$/u;
const partialHeading = /^(?:\*{1,2}([^*]*)\*?|_{1,2}([^_]*)_?)$/u;

// A stream can start with a heading and then expand into a full reasoning block.
// Return null for expandable reasoning and an empty string while a label is empty.
export function getReasoningStatus(reasoning, streaming) {
  // Some adapters concatenate adjacent summary headings without a line break.
  const lines = (reasoning || '')
    .split(/[\r\n\u2028\u2029]+|(?<=\*\*|__)(?=(?:\*\*|__)[^*_])/u)
    .map((line) => line.trim())
    .filter(Boolean);
  let latest = '';

  for (const [index, line] of lines.entries()) {
    const heading = boldHeading.exec(line);
    const partial = streaming && index === lines.length - 1 && partialHeading.exec(line);
    if (lines.length > 1 && !heading && !partial) return null;

    const label = (heading?.[2] ?? partial?.[1] ?? partial?.[2] ?? line).trim();
    if (label.length > maxStatusLength) return null;
    if (label) latest = label;
  }

  return latest;
}
