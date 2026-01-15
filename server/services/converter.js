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
    // 1. 预处理 ENML
    let html = this.preprocessEnml(enmlContent, resourceMap);

    // 2. 转换为 Markdown
    let markdown = this.nhm.translate(html);

    // 3. 后处理
    markdown = this.postprocess(markdown);

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
   * 预处理 ENML，转换特殊标签
   */
  preprocessEnml(enmlContent, resourceMap) {
    let html = enmlContent;

    // 移除 XML 声明和 DOCTYPE
    html = html.replace(/<\?xml[^>]*\?>/gi, '');
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

    // 转换 en-note 为 div
    html = html.replace(/<en-note[^>]*>/gi, '<div class="en-note">');
    html = html.replace(/<\/en-note>/gi, '</div>');

    // 转换 en-todo (待办事项)
    html = html.replace(/<en-todo\s+checked="true"\s*\/?>/gi, '[x] ');
    html = html.replace(/<en-todo\s+checked="false"\s*\/?>/gi, '[ ] ');
    html = html.replace(/<en-todo\s*\/?>/gi, '[ ] ');

    // 转换 en-media (图片和附件)
    html = html.replace(/<en-media[^>]*hash="([a-f0-9]+)"[^>]*type="([^"]*)"[^>]*\/?>/gi,
      (match, hash, mimeType) => {
        return this.convertMedia(hash, mimeType, resourceMap);
      }
    );

    // 处理另一种 en-media 格式 (type 在 hash 前面)
    html = html.replace(/<en-media[^>]*type="([^"]*)"[^>]*hash="([a-f0-9]+)"[^>]*\/?>/gi,
      (match, mimeType, hash) => {
        return this.convertMedia(hash, mimeType, resourceMap);
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
   * 转换媒体标签
   */
  convertMedia(hash, mimeType, resourceMap) {
    const resource = resourceMap.get(hash);

    if (!resource) {
      return `<!-- 资源未找到: ${hash} -->`;
    }

    if (mimeType.startsWith('image/')) {
      return this.formatImageLink(resource.filename);
    } else {
      return this.formatAttachmentLink(resource.filename, resource.originalName || resource.filename);
    }
  }

  /**
   * 格式化图片链接
   */
  formatImageLink(filename) {
    if (this.imageFormat === 'obsidian') {
      return `![[images/${filename}]]`;
    }
    return `![](./images/${filename})`;
  }

  /**
   * 格式化附件链接
   */
  formatAttachmentLink(filename, displayName) {
    if (this.imageFormat === 'obsidian') {
      return `[[attachments/${filename}|${displayName}]]`;
    }
    return `[${displayName}](./attachments/${filename})`;
  }

  /**
   * 后处理 Markdown
   */
  postprocess(markdown) {
    // 移除多余的空行
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

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
