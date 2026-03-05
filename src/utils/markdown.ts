
export interface MarkdownParsed {
  metadata: Record<string, any>;
  content: string;
}

export function parseMarkdown(md: string): MarkdownParsed {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = md.match(frontmatterRegex);

  let metadata: Record<string, any> = {};
  let content = md;

  if (match) {
    const yamlBlock = match[1];
    content = md.replace(frontmatterRegex, '').trim();

    // Simple YAML parser (handles key: value and lists)
    const lines = yamlBlock.split('\n');
    let currentKey = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Check for list item
      if (trimmed.startsWith('- ') && currentKey) {
        if (!Array.isArray(metadata[currentKey])) {
          metadata[currentKey] = [];
        }
        // Remove [[ ]] from list items for UI
        let val = trimmed.substring(2).trim();
        metadata[currentKey].push(val);
        return;
      }

      // Key-Value pair
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        currentKey = key;
        metadata[key] = value;
      }
    });
  }

  return { metadata, content };
}

// Helper to turn "[[Green Tea]]" into "Green Tea"
export function cleanObsidianLink(text: string): string {
  if (!text) return '';
  return text.replace(/\[\[(.*?)\]\]/g, '$1');
}

export function cleanObsidianLinksInArray(arr: string[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(cleanObsidianLink);
}
