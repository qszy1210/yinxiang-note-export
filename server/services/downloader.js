const fs = require('fs').promises;
const path = require('path');
const sanitize = require('sanitize-filename');

class Downloader {
  constructor(evernoteService) {
    this.service = evernoteService;
  }

  /**
   * 下载笔记的所有资源
   * @param {Array} resources - 资源列表
   * @param {string} exportPath - 导出目录路径
   * @returns {Map} 资源映射 (hash -> { filename, type, localPath, originalName })
   */
  async downloadResources(resources, exportPath) {
    const resourceMap = new Map();

    if (!resources || resources.length === 0) {
      return resourceMap;
    }

    const imagesDir = path.join(exportPath, 'images');
    const attachmentsDir = path.join(exportPath, 'attachments');

    // 用于处理文件名冲突
    const usedNames = new Set();

    for (const resource of resources) {
      try {
        const hash = this.bufferToHex(resource.data.bodyHash);
        const mimeType = resource.mime;
        const isImage = mimeType.startsWith('image/');

        // 确定文件名
        let originalName = resource.attributes?.fileName;
        let filename = this.generateFilename(originalName, mimeType, hash, usedNames);
        usedNames.add(filename.toLowerCase());

        // 确定保存路径
        const targetDir = isImage ? imagesDir : attachmentsDir;
        const localPath = path.join(targetDir, filename);

        // 获取并保存资源数据
        let data;
        if (resource.data.body) {
          // 数据已经包含在 resource 中
          data = resource.data.body;
        } else {
          // 需要单独获取数据
          data = await this.service.getResourceData(resource.guid);
        }

        await fs.writeFile(localPath, Buffer.from(data));

        resourceMap.set(hash, {
          filename,
          type: isImage ? 'image' : 'attachment',
          localPath,
          originalName: originalName || filename,
          mimeType
        });
      } catch (err) {
        console.error(`下载资源失败: ${resource.guid}`, err.message);
      }
    }

    return resourceMap;
  }

  /**
   * 生成唯一的文件名
   */
  generateFilename(originalName, mimeType, hash, usedNames) {
    let filename;

    if (originalName) {
      filename = sanitize(originalName);
    } else {
      // 根据 MIME 类型生成扩展名
      const ext = this.getExtension(mimeType);
      filename = `${hash.substring(0, 8)}${ext}`;
    }

    // 处理文件名冲突
    if (usedNames.has(filename.toLowerCase())) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      let counter = 1;

      while (usedNames.has(`${base}_${counter}${ext}`.toLowerCase())) {
        counter++;
      }

      filename = `${base}_${counter}${ext}`;
    }

    return filename;
  }

  /**
   * 根据 MIME 类型获取文件扩展名
   */
  getExtension(mimeType) {
    const mimeToExt = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt',
      'text/html': '.html',
      'application/zip': '.zip',
      'application/x-rar-compressed': '.rar',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov'
    };

    return mimeToExt[mimeType] || '.bin';
  }

  /**
   * 将 Buffer 转换为十六进制字符串
   */
  bufferToHex(buffer) {
    if (Buffer.isBuffer(buffer)) {
      return buffer.toString('hex');
    }
    // 如果是 Uint8Array 或类似数组
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

module.exports = Downloader;
