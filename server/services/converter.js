const { NodeHtmlMarkdown } = require('node-html-markdown');

class Converter {
  constructor(options = {}) {
    // 'obsidian' | 'standard'
    this.imageFormat = options.imageFormat || 'obsidian';

    // 配置 HTML 到 Markdown 转换器
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
    // 1. 预处理 ENML，将 en-media 转为标准 HTML 标签
    let html = this.preprocessEnml(enmlContent, resourceMap);

    // 2. 转换为 Markdown
    let markdown = this.nhm.translate(html);

    // 3. 后处理（包括转换为 Obsidian 格式）
    markdown = this.postprocess(markdown, resourceMap);

    // 统计资源
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
   * 预处理 ENML，转换特殊标签为标准 HTML
   */
  preprocessEnml(enmlContent, resourceMap) {
    let html = enmlContent;

    // 移除 XML 声明和 DOCTYPE
    html = html.replace(/<\?xml[^>]*\?>/gi, '');
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

    // 转换 en-note 为 div
    html = html.replace(/<en-note[^>]*>/gi, '<div class="en-note">');
    html = html.replace(/<\/en-note>/gi, '</div>');

    // 转换 en-todo (待办事项) - 使用特殊标记，后处理时转换
    html = html.replace(/<en-todo\s+checked="true"\s*\/?>/gi, '<span class="todo-checked">☑</span>');
    html = html.replace(/<en-todo\s+checked="false"\s*\/?>/gi, '<span class="todo-unchecked">☐</span>');
    html = html.replace(/<en-todo\s*\/?>/gi, '<span class="todo-unchecked">☐</span>');

    // 转换 en-media (图片和附件) 为标准 HTML 标签
    html = html.replace(/<en-media[^>]*hash="([a-f0-9]+)"[^>]*type="([^"]*)"[^>]*\/?>/gi,
      (match, hash, mimeType) => {
        return this.convertMediaToHtml(hash, mimeType, resourceMap);
      }
    );

    // 处理另一种 en-media 格式 (type 在 hash 前面)
    html = html.replace(/<en-media[^>]*type="([^"]*)"[^>]*hash="([a-f0-9]+)"[^>]*\/?>/gi,
      (match, mimeType, hash) => {
        return this.convertMediaToHtml(hash, mimeType, resourceMap);
      }
    );

    // 处理 en-crypt (加密内容)
    html = html.replace(/<en-crypt[^>]*>[\s\S]*?<\/en-crypt>/gi,
      '<p><em>[加密内容 - 无法导出]</em></p>'
    );

    // 清理空的 div
    html = html.replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '\n');

    return html;
  }

  /**
   * 将 en-media 转换为标准 HTML 标签
   */
  convertMediaToHtml(hash, mimeType, resourceMap) {
    const resource = resourceMap.get(hash);

    if (!resource) {
      return `<!-- 资源未找到: ${hash} -->`;
    }

    if (mimeType.startsWith('image/')) {
      // 转为标准 img 标签
      return `<img src="./images/${resource.filename}" alt="${resource.originalName || resource.filename}">`;
    } else {
      // 转为标准 a 标签
      const displayName = resource.originalName || resource.filename;
      return `<a href="./attachments/${resource.filename}">${displayName}</a>`;
    }
  }

  /**
   * 后处理 Markdown
   */
  postprocess(markdown, resourceMap) {
    // 移除多余的空行
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    // 转换 todo 标记
    markdown = markdown.replace(/☑/g, '[x] ');
    markdown = markdown.replace(/☐/g, '[ ] ');

    // 如果是 Obsidian 格式，转换图片和链接语法
    if (this.imageFormat === 'obsidian') {
      // 转换图片: ![alt](./images/xxx.png) -> ![[images/xxx.png]]
      markdown = markdown.replace(/!\[[^\]]*\]\(\.\/images\/([^)]+)\)/g, '![[images/$1]]');

      // 转换附件: [name](./attachments/xxx.pdf) -> [[attachments/xxx.pdf|name]]
      markdown = markdown.replace(/\[([^\]]+)\]\(\.\/attachments\/([^)]+)\)/g, '[[attachments/$2|$1]]');
    }

    // 修复列表格式
    markdown = markdown.replace(/^\s*[-*]\s+\[\s*[xX]?\s*\]/gm, (match) => {
      return match.trim();
    });

    // 清理首尾空白
    markdown = markdown.trim();

    return markdown;
  }
}

module.exports = Converter;
