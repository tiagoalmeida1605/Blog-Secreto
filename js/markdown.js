const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

function safeUrl(value) {
  try {
    const url = new URL(value);
    return SAFE_URL_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function parseInline(source) {
  const nodes = [];
  let index = 0;
  const patterns = [
    { regex: /^`([^`]+)`/, type: "code" },
    { regex: /^\[([^\]]+)\]\(([^)\s]+)\)/, type: "link" },
    { regex: /^\*\*(.+?)\*\*|^__(.+?)__/, type: "strong" },
    { regex: /^~~(.+?)~~/, type: "del" },
    { regex: /^\*([^*\n]+)\*|^_([^_\n]+)_/, type: "em" },
  ];

  while (index < source.length) {
    let match = null;
    let type = "";
    for (const candidate of patterns) {
      match = source.slice(index).match(candidate.regex);
      if (match) {
        type = candidate.type;
        break;
      }
    }
    if (!match) {
      const last = nodes.at(-1);
      if (last?.type === "text") last.text += source[index];
      else nodes.push({ type: "text", text: source[index] });
      index += 1;
      continue;
    }

    if (type === "link") {
      const href = safeUrl(match[2]);
      if (!href) {
        nodes.push({ type: "text", text: match[0] });
      } else {
        nodes.push({ type, href, children: parseInline(match[1]) });
      }
    } else {
      const value = match[1] || match[2];
      nodes.push({ type, ...(type === "code" ? { text: value } : { children: parseInline(value) }) });
    }
    index += match[0].length;
  }
  return nodes;
}

function isListItem(line) {
  return line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.*)$/);
}

function parseBlocks(lines) {
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})\s*([\w.+-]{1,24})?\s*$/);
    if (fence) {
      const codeLines = [];
      const marker = fence[1];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "pre", text: codeLines.join("\n"), language: fence[2] || "" });
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: `h${heading[1].length}`, children: parseInline(heading[2]) });
      index += 1;
      continue;
    }

    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^ {0,3}>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^ {0,3}> ?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", children: parseBlocks(quoteLines) });
      continue;
    }

    const listMatch = isListItem(line);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items = [];
      while (index < lines.length) {
        const item = isListItem(lines[index]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(parseInline(item[2]));
        index += 1;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lines[index].trim()
      && !/^ {0,3}(?:`{3,}|~{3,}|#{1,6}\s|>|(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[index])
      && !isListItem(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    if (!paragraphLines.length) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const children = [];
    paragraphLines.forEach((value, lineIndex) => {
      if (lineIndex) children.push({ type: "br" });
      children.push(...parseInline(value.trim()));
    });
    blocks.push({ type: "p", children });
  }
  return blocks;
}

export function markdownToAst(markdown) {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n");
  return parseBlocks(source.split("\n"));
}

function appendInline(parent, nodes) {
  nodes.forEach((node) => {
    if (node.type === "text") {
      parent.append(document.createTextNode(node.text));
      return;
    }
    if (node.type === "br") {
      parent.append(document.createElement("br"));
      return;
    }
    const tag = node.type === "strong" ? "strong"
      : node.type === "em" ? "em"
        : node.type === "del" ? "del"
          : node.type === "code" ? "code" : "a";
    const child = document.createElement(tag);
    if (node.type === "link") {
      child.href = node.href;
      child.rel = "noopener noreferrer";
      child.target = "_blank";
      appendInline(child, node.children);
    } else if (node.type === "code") {
      child.textContent = node.text;
    } else {
      appendInline(child, node.children);
    }
    parent.append(child);
  });
}

function appendBlocks(parent, blocks) {
  blocks.forEach((block) => {
    if (block.type === "hr") {
      parent.append(document.createElement("hr"));
      return;
    }
    if (block.type === "pre") {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      if (block.language) code.dataset.language = block.language;
      code.textContent = block.text;
      pre.append(code);
      parent.append(pre);
      return;
    }
    if (block.type === "blockquote") {
      const quote = document.createElement("blockquote");
      appendBlocks(quote, block.children);
      parent.append(quote);
      return;
    }
    if (block.type === "ul" || block.type === "ol") {
      const list = document.createElement(block.type);
      block.items.forEach((children) => {
        const item = document.createElement("li");
        appendInline(item, children);
        list.append(item);
      });
      parent.append(list);
      return;
    }
    const element = document.createElement(block.type);
    appendInline(element, block.children);
    parent.append(element);
  });
}

export function renderMarkdown(container, markdown) {
  container.replaceChildren();
  appendBlocks(container, markdownToAst(markdown));
}

function inlineMarkdown(node) {
  if (node.nodeType === 3) return node.nodeValue || "";
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  const content = [...node.childNodes].map(inlineMarkdown).join("");
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return `**${content}**`;
  if (tag === "em" || tag === "i") return `*${content}*`;
  if (tag === "del" || tag === "s" || tag === "strike") return `~~${content}~~`;
  if (tag === "code") return `\`${content.replace(/\n/g, " ")}\``;
  if (tag === "a") {
    const href = safeUrl(node.getAttribute("href") || "");
    return href ? `[${content}](${href})` : content;
  }
  return content;
}

function blockMarkdown(node) {
  if (node.nodeType === 3) return node.nodeValue || "";
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "hr") return "---";
  if (tag === "pre") {
    const code = node.querySelector("code");
    const text = (code || node).textContent.replace(/\n$/, "");
    const language = code?.dataset.language || "";
    const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)));
    return `${fence}${language}\n${text}\n${fence}`;
  }
  if (tag === "blockquote") {
    const text = [...node.childNodes].map(blockMarkdown).join("\n\n");
    return text.split("\n").map((line) => `> ${line}`).join("\n");
  }
  if (tag === "ul" || tag === "ol") {
    return [...node.children].map((item, index) => {
      const marker = tag === "ol" ? `${index + 1}.` : "-";
      return `${marker} ${[...item.childNodes].map(inlineMarkdown).join("")}`;
    }).join("\n");
  }
  const text = [...node.childNodes].map(inlineMarkdown).join("");
  const heading = tag.match(/^h([1-6])$/);
  if (heading) return `${"#".repeat(Number(heading[1]))} ${text}`;
  if (tag === "p" || tag === "div") return text;
  return text;
}

export function editorToMarkdown(root) {
  return [...root.childNodes].map(blockMarkdown).filter((block) => block.length > 0).join("\n\n").trim();
}

export function markdownToPlainText(markdown) {
  return String(markdown ?? "")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/gi, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeMarkdownLink(value) {
  return safeUrl(value);
}
