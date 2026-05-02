/* ═══════════════════════════════════════════════════════════════════
   SMART PASTE & MESSAGE PARSER LIB
   Sequential: A→Shield  B→Sanitize  C→Links  D→Lines
═══════════════════════════════════════════════════════════════════ */

// ── SMART PASTE NORMALIZER ──────────────────────────────────────────

function walkNode(node) {
  // TEXT node — return raw text
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';

  const tag  = node.tagName.toLowerCase();
  const kids = () => Array.from(node.childNodes).map(walkNode).join('');

  if (['script','style','head','meta','link','noscript'].includes(tag)) return '';

  // Block-level code (pre > code)
  if (tag === 'pre') {
    const codeEl = node.querySelector('code');
    const cls  = (codeEl?.className || node.className || '');
    const lang = (cls.match(/language-(\w+)/) || cls.match(/lang-(\w+)/) || [])[1] || '';
    const raw  = (codeEl || node).innerText ?? (codeEl || node).textContent ?? '';
    return '\n```' + lang + '\n' + raw + '\n```\n';
  }

  // Inline code
  if (tag === 'code') {
    const raw = node.textContent.trim();
    if (raw.includes('\n')) return '\n```\n' + raw + '\n```\n';
    return '`' + raw + '`';
  }

  // Bold
  if (['strong','b'].includes(tag)) {
    const inner = kids().trim();
    return inner ? '**' + inner + '**' : '';
  }

  // Italic
  if (['em','i'].includes(tag)) {
    const inner = kids().trim();
    return inner ? '*' + inner + '*' : '';
  }

  // Strikethrough
  if (['del','s','strike'].includes(tag)) {
    const inner = kids().trim();
    return inner ? '~~' + inner + '~~' : '';
  }

  // Links
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const text = kids().trim();
    if (href && href.startsWith('http') && href !== text) return text + ' ' + href;
    return text;
  }

  // Images
  if (tag === 'img') return node.getAttribute('alt') || '';

  // Headings
  if (/^h[1-2]$/.test(tag)) return '\n# ' + kids().trim() + '\n';
  if (/^h[3-6]$/.test(tag)) return '\n## ' + kids().trim() + '\n';

  // Blockquote
  if (tag === 'blockquote') {
    return '\n' + kids().trim().split('\n').map(l => '> ' + l).join('\n') + '\n';
  }

  // Unordered list
  if (tag === 'ul') {
    return '\n' + Array.from(node.children).map(li => '- ' + walkNode(li).trim()).join('\n') + '\n';
  }

  // Ordered list
  if (tag === 'ol') {
    return '\n' + Array.from(node.children).map((li, i) => `${i + 1}. ` + walkNode(li).trim()).join('\n') + '\n';
  }

  // List item fallback
  if (tag === 'li') return kids();

  // Horizontal rule
  if (tag === 'hr') return '\n---\n';

  // Line break
  if (tag === 'br') return '\n';

  // Table → plain rows
  if (tag === 'table') {
    const rows = Array.from(node.querySelectorAll('tr'));
    return '\n' + rows.map(r =>
      Array.from(r.querySelectorAll('th,td')).map(c => c.innerText.trim()).join(' | ')
    ).join('\n') + '\n';
  }

  // Block containers
  const blocks = ['p','div','section','article','aside','header','footer',
                  'main','nav','figure','figcaption','address','details','summary',
                  'thead','tbody','tfoot','tr','th','td'];
  if (blocks.includes(tag)) {
    const inner = kids().trim();
    return inner ? '\n' + inner + '\n' : '';
  }

  return kids();
}

export function normalizeHtmlToMarkdown(html) {
  if (typeof document === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = walkNode(doc.body);
    return result
      .replace(/\r\n/g, '\n')
      .replace(/\r/g,   '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  } catch (e) {
    console.error("Paste normalization failed", e);
    return html;
  }
}

export function isRichHtml(html) {
  if (!html) return false;
  return /<(p|div|ul|ol|li|pre|code|strong|em|h[1-6]|a\s|br|hr|table|blockquote)\b/i.test(html);
}

// ── HIGH-FIDELITY PARSER ──────────────────────────────────────────

const esc = s => s.replace(/[&<>"']/g, m =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function hlCode(code) {
  let h = esc(code);
  h = h.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="hl-str">$&</span>');
  h = h.replace(/(&lt;\/?[a-z][a-z0-9]*\b|\/&gt;|&gt;)/gi, '<span class="hl-tag">$&</span>');
  h = h.replace(/\b(lang|charset|name|content|width|src|href|class|id|style|type|onclick|rel|alt|title|target|className|ref|key|onClick|onChange|onSubmit|value|placeholder|disabled|readOnly)\b(?=\s*[=:])/g, '<span class="hl-attr">$&</span>');
  h = h.replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|default|from|await|async|try|catch|finally|throw|new|this|super|class|extends|interface|type|enum|as|any|number|string|boolean|void|null|undefined|true|false|typeof|instanceof|in|of|delete|yield|static|get|set|public|private|protected|abstract|implements|def|print|pass|lambda|with|not|and|or|is|None|True|False)\b/g, '<span class="hl-key">$&</span>');
  h = h.replace(/(&lt;!--[\s\S]*?--&gt;|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n{]*)/g, '<span class="hl-comm">$&</span>');
  h = h.replace(/\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, '<span class="hl-func">$&</span>');
  return h;
}

function mkCodeBlock(code, lang) {
  const id = 'cb_' + Math.random().toString(36).substr(2, 9);
  const displayLang = (lang || 'text').toLowerCase();
  return `<div class="code-block-wrap"><div class="code-header"><span class="code-lang">${esc(displayLang)}</span><button class="copy-btn" data-id="${id}">COPY</button></div><pre class="code-pre" id="${id}"><code>${hlCode(code)}</code></pre></div>`;
}

function processInline(line, searchQuery = "") {
  // Use a safer URL regex that strictly enforces http/https protocol
  const urlRe   = /(https?:\/\/[^\s<>"&]+?)(?=[.,;!?\s]|$|&amp;)/g;
  const emailRe = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
  const phoneRe = /(\+?\d[\d\s\-]{7,}\d)/g;
  let p = line;

  // Search Highlight - Ensure we don't break existing escaping
  if (searchQuery?.trim()) {
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    p = p.replace(re, '<mark class="msg-highlight-search">$1</mark>');
  }

  // Links with noopener/noreferrer for security
  p = p.replace(urlRe,   '<a href="$1" target="_blank" rel="noopener noreferrer" class="msg-link">$1</a>');
  p = p.replace(emailRe, '<a href="mailto:$1" class="msg-link">$1</a>');
  p = p.replace(phoneRe, m => {
    const clean = m.replace(/[^\d+]/g, '');
    return `<a href="tel:${clean}" class="msg-link">${m}</a>`;
  });

  p = p.replace(/\*\*(.*?)\*\*/g, '<strong class="msg-bold">$1</strong>');
  p = p.replace(/__(.*?)__/g,     '<strong class="msg-bold">$1</strong>');
  p = p.replace(/\*(.*?)\*/g,     '<em class="msg-italic">$1</em>');
  p = p.replace(/_((?!\s).*?(?<!\s))_/g, '<em class="msg-italic">$1</em>');
  p = p.replace(/`([^`]+)`/g,     '<code class="msg-inline-code">$1</code>');
  p = p.replace(/~~(.*?)~~/g,     '<del class="msg-strike">$1</del>');
  return p;
}

export function parseMessage(rawText, searchQuery = "") {
  if (!rawText) return '';
  let text = rawText;
  const blocks = [];

  // A — shield code blocks
  text = text.replace(/```(\w*)\s*\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(mkCodeBlock(code, lang));
    return '\nBLOCK_TOKEN_' + (blocks.length - 1) + '\n';
  });

  // B — sanitize
  text = esc(text);

  // D — lines
  const lines = text.split('\n');
  let out = '', buf = [], isOL = false;
  const flush = () => {
    if (!buf.length) return;
    out += `<${isOL?'ol':'ul'} class="msg-list">${buf.join('')}</${isOL?'ol':'ul'}>`;
    buf = []; isOL = false;
  };

  lines.forEach(line => {
    const cl = line.trim();

    // code token
    if (cl.startsWith('BLOCK_TOKEN_')) {
      flush();
      const idx = parseInt(cl.replace('BLOCK_TOKEN_',''), 10);
      if (!isNaN(idx) && blocks[idx]) out += blocks[idx];
      return;
    }

    // bullet
    const bull = line.match(/^(\s*)[-+*✓•]\s+(.*)/);
    if (bull) {
      if (isOL) flush();
      isOL = false;
      buf.push(`<li><span class="checkmark">✓</span><span>${processInline(bull[2], searchQuery)}</span></li>`);
      return;
    }

    // numbered
    const numm = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);
    if (numm) {
      if (!isOL && buf.length) flush();
      isOL = true;
      buf.push(`<li><span>${processInline(numm[3], searchQuery)}</span></li>`);
      return;
    }

    // header
    const hdr = line.match(/^(\s*)(#{1,3}|🎯|🧩|⚠️|💡|🔥|✅|❌|📌|🔑|📋|🚀|⭐|🛠️|🔧|📊|🎨|🏆|🧠|🌟|🎪)\s+(.*)/);
    if (hdr) { 
      flush(); 
      out += `<h2 class="msg-header"><span class="msg-header-icon">${hdr[2]}</span>${processInline(hdr[3], searchQuery)}</h2>`; 
      return; 
    }

    // blockquote
    const bq = line.match(/^&gt;\s*(.*)/);
    if (bq) { flush(); out += `<p class="msg-para msg-blockquote">${processInline(bq[1], searchQuery)}</p>`; return; }

    // hr
    if (/^---+$/.test(cl) || /^\*\*\*+$/.test(cl) || /^___+$/.test(cl)) { flush(); out += '<hr class="msg-divider">'; return; }

    // empty
    if (!cl) { flush(); out += '<div class="msg-spacing"></div>'; return; }

    // paragraph
    flush();
    out += `<p class="msg-para">${processInline(line, searchQuery)}</p>`;
  });

  flush();
  return out;
}
