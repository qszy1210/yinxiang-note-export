const { NodeHtmlMarkdown } = require('node-html-markdown');

class Converter {
  constructor(options = {}) {
    // 'obsidian' | 'standard'
    this.imageFormat = options.imageFormat || 'obsidian';

    this.nhm = new NodeHtmlMarkdown({
      codeBlockStyle: 'fenced',
      bulletMarker: '-',
      strongDelimiter: '**',
      emDelimiter: '*'
    });
  }

  /**
   * 将 ENML 转换为 Markdown
   * @param {string} enmlContent - ENML 内容
   * @param {Map} resourceMap - 资源映射 (hash -> { filename, type, localPath })
   * @param {string} noteTitle - 笔记标题
   * @returns {object} { markdown, images, attachments }
   */
  convert(enmlContent, resourceMap, noteTitle) {
    let html = this.preprocessEnml(enmlContent, resourceMap);
    let markdown = this.nhm.translate(html);
    markdown = this.postprocess(markdown, resourceMap);

    const images = [];
    const attachments = [];

    for (const [hash, resource] of resourceMap) {
      if (resource.type === 'image') {
        images.push(resource.filename);
      } else {
        attachments.push(resource.filename);
      }
    }

    return { markdown, images, attachments };
  }

  /**
   * 预处理 ENML，转换 Evernote 私有标签为标准 HTML
   */
  preprocessEnml(enmlContent, resourceMap) {
    let html = enmlContent;

    html = html.replace(/<\?xml[^>]*\?>/gi, '');
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

    html = html.replace(/<en-note[^>]*>/gi, '<div class="en-note">');
    html = html.replace(/<\/en-note>/gi, '</div>');

    html = html.replace(/<en-todo\s+checked="true"\s*\/?>/gi, '<span class="todo-checked">☑</span>');
    html = html.replace(/<en-todo\s+checked="false"\s*\/?>/gi, '<span class="todo-unchecked">☐</span>');
    html = html.replace(/<en-todo\s*\/?>/gi, '<span class="todo-unchecked">☐</span>');

    html = html.replace(/<en-media[^>]*hash="([a-f0-9]+)"[^>]*type="([^"]*)"[^>]*\/?>/gi,
      (match, hash, mimeType) => {
        return this.convertMediaToHtml(hash, mimeType, resourceMap);
      }
    );

    html = html.replace(/<en-media[^>]*type="([^"]*)"[^>]*hash="([a-f0-9]+)"[^>]*\/?>/gi,
      (match, mimeType, hash) => {
        return this.convertMediaToHtml(hash, mimeType, resourceMap);
      }
    );

    html = html.replace(/<en-crypt[^>]*>[\s\S]*?<\/en-crypt>/gi,
      '<p><em>[加密内容 - 无法导出]</em></p>'
    );

    html = html.replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '\n');

    return html;
  }

  convertMediaToHtml(hash, mimeType, resourceMap) {
    const resource = resourceMap.get(hash);

    if (!resource) {
      return `<!-- 资源未找到: ${hash} -->`;
    }

    if (mimeType.startsWith('image/')) {
      return `<img src="./images/${resource.filename}" alt="${resource.originalName || resource.filename}">`;
    } else {
      const displayName = resource.originalName || resource.filename;
      return `<a href="./attachments/${resource.filename}">${displayName}</a>`;
    }
  }

  /**
   * 后处理 Markdown：清理格式，可选转为 Obsidian 语法
   */
  postprocess(markdown, resourceMap) {
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    markdown = markdown.replace(/☑/g, '[x] ');
    markdown = markdown.replace(/☐/g, '[ ] ');

    if (this.imageFormat === 'obsidian') {
      markdown = markdown.replace(/!\[[^\]]*\]\(\.\/images\/([^)]+)\)/g, '![[images/$1]]');
      markdown = markdown.replace(/\[([^\]]+)\]\(\.\/attachments\/([^)]+)\)/g, '[[attachments/$2|$1]]');
    }

    markdown = markdown.replace(/^\s*[-*]\s+\[\s*[xX]?\s*\]/gm, (match) => {
      return match.trim();
    });

    markdown = markdown.trim();

    return markdown;
  }
}

module.exports = Converter;
