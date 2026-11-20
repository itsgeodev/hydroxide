// Reveal new words at the network's pace. Stable HAST positions let React keep
// existing spans, so earlier text never retypes and copying retains the source.
const VERBATIM = new Set(['pre', 'code', 'kbd', 'svg', 'math']);

export default function rehypeStreamingWords() {
  return (tree) => {
    function visit(node) {
      if (!node.children || VERBATIM.has(node.tagName)) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text') {
          visit(child);
          return [child];
        }
        return (child.value.match(/\s+|\S+/gu) || []).map((value) =>
          /^\s+$/u.test(value)
            ? { type: 'text', value }
            : {
                type: 'element',
                tagName: 'span',
                properties: { className: ['stream-word'] },
                children: [{ type: 'text', value }],
              },
        );
      });
    }
    visit(tree);
  };
}

// Put the marker in the same inline formatting context as the last rendered word,
// including syntax-highlighted code, links, lists and table cells.
export function rehypeStreamingCursor() {
  return (tree) => {
    function markLast(node) {
      if (!node.children) return false;
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child.type === 'text' && child.value.trim()) {
          const [, prefix, word, space] = child.value.match(/^([\s\S]*?)(\S+)(\s*)$/u);
          node.children.splice(
            i,
            1,
            { type: 'text', value: prefix },
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['stream-tip'] },
              children: [{ type: 'text', value: word }],
            },
            { type: 'text', value: space },
          );
          return true;
        }
        if (markLast(child)) return true;
      }
      return false;
    }
    markLast(tree);
  };
}
