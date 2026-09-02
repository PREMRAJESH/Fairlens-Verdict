/**
 * Lightweight markdown renderer + <think> block stripper for FairLens agent output.
 * No external dependencies — handles streaming chunks safely.
 */

// ─── <think> block handling ──────────────────────────────────────────────────────

type ThinkState = {
  inside: boolean;
  buffer: string;
  /** text accumulated before the current <think> block */
  before: string;
};

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

/**
 * Strip <think>...</think> blocks from text.
 * Handles partial blocks that arrive across multiple SSE chunks.
 * Returns the cleaned text and a state object to persist across calls.
 */
export function stripThinkBlocks(
  text: string,
  prevState?: { inside: boolean; pendingOpen: string; pendingClose: string },
): { cleaned: string; state: { inside: boolean; pendingOpen: string; pendingClose: string } } {
  const state = prevState ?? { inside: false, pendingOpen: "", pendingClose: "" };
  let cleaned = "";
  let i = 0;

  while (i < text.length) {
    if (!state.inside) {
      // Look for <think> opening tag
      const openIdx = text.indexOf(THINK_OPEN, i);
      if (openIdx === -1) {
        // No opening tag — emit everything
        cleaned += text.slice(i);
        break;
      }
      // Emit text before the tag
      cleaned += text.slice(i, openIdx);
      state.inside = true;
      i = openIdx + THINK_OPEN.length;
    } else {
      // Inside <think> — look for </think> closing tag
      const closeIdx = text.indexOf(THINK_CLOSE, i);
      if (closeIdx === -1) {
        // No closing tag yet — skip everything (it's all think content)
        break;
      }
      // Found closing tag — skip to after it
      state.inside = false;
      i = closeIdx + THINK_CLOSE.length;
    }
  }

  return { cleaned, state };
}

/**
 * Reset think state (call when a new agent starts).
 */
export function resetThinkState(): {
  inside: boolean;
  pendingOpen: string;
  pendingClose: string;
} {
  return { inside: false, pendingOpen: "", pendingClose: "" };
}

// ─── Markdown → HTML ────────────────────────────────────────────────────────

/**
 * Convert lightweight markdown to safe HTML.
 * Handles: **bold**, *italic*, `code`, headings (#, ##, ###),
 * bullet lists (-, *), numbered lists (1.), and line breaks.
 * Does NOT handle images, links, or nested HTML (safe by design).
 */
export function markdownToHtml(text: string): string {
  // Escape HTML entities first to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w*\n/, "");
    return `<pre class="fl-code-block"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="fl-inline-code">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h4 class="fl-md-h3">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="fl-md-h2">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="fl-md-h1">$1</h2>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="fl-md-hr" />');

  // Process line-by-line for lists and paragraphs
  const lines = html.split("\n");
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^[\s]*[-*] (.+)$/);
    const olMatch = line.match(/^[\s]*\d+\. (.+)$/);

    if (ulMatch) {
      if (!inUl) {
        if (inOl) {
          result.push("</ol>");
          inOl = false;
        }
        result.push('<ul class="fl-md-list">');
        inUl = true;
      }
      result.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inOl) {
        if (inUl) {
          result.push("</ul>");
          inUl = false;
        }
        result.push('<ol class="fl-md-list">');
        inOl = true;
      }
      result.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) {
        result.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        result.push("</ol>");
        inOl = false;
      }
      // Empty lines become paragraph breaks
      if (line.trim() === "") {
        result.push("");
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }

  if (inUl) result.push("</ul>");
  if (inOl) result.push("</ol>");

  return result.join("\n");
}

/**
 * Check if text contains a verdict position marker.
 */
export function extractVerdict(text: string): string | null {
  const match = text.match(
    /(STRONG_HIRE|HIRE|LEAN_HIRE|LEAN_NO_HIRE|NO_HIRE|STRONG_NO_HIRE)/i,
  );
  return match ? match[1].toUpperCase() : null;
}
