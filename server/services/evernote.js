const Evernote = require('evernote');

class EvernoteService {
  constructor(token, noteStoreUrl) {
    this.token = token;
    this.noteStoreUrl = noteStoreUrl;

    this.client = new Evernote.Client({
      token: token,
      sandbox: false,
      china: true  // 使用印象笔记中国服务
    });
  }

  /**
   * 获取用户信息
   */
  async getUser() {
    const userStore = this.client.getUserStore();
    return await userStore.getUser();
  }

  /**
   * 获取 NoteStore
   */
  getNoteStore() {
    // 使用提供的 noteStoreUrl 创建 NoteStore
    return this.client.getNoteStore(this.noteStoreUrl);
  }

  /**
   * 获取所有笔记本列表
   */
  async listNotebooks() {
    const noteStore = this.getNoteStore();
    return await noteStore.listNotebooks();
  }

  /**
   * 获取单个笔记本信息
   */
  async getNotebook(notebookGuid) {
    const noteStore = this.getNoteStore();
    return await noteStore.getNotebook(notebookGuid);
  }

  /**
   * 获取笔记本下的笔记列表
   */
  async getNotesInNotebook(notebookGuid, offset = 0, maxNotes = 100) {
    const noteStore = this.getNoteStore();

    const filter = new Evernote.NoteStore.NoteFilter();
    filter.notebookGuid = notebookGuid;

    const spec = new Evernote.NoteStore.NotesMetadataResultSpec();
    spec.includeTitle = true;
    spec.includeCreated = true;
    spec.includeUpdated = true;
    spec.includeContentLength = true;

    return await noteStore.findNotesMetadata(filter, offset, maxNotes, spec);
  }

  /**
   * 获取笔记内容
   */
  async getNoteContent(noteGuid) {
    const noteStore = this.getNoteStore();
    return await noteStore.getNoteContent(noteGuid);
  }

  /**
   * 获取笔记基本信息
   */
  async getNote(noteGuid, withContent = false) {
    const noteStore = this.getNoteStore();
    return await noteStore.getNote(noteGuid, withContent, false, false, false);
  }

  /**
   * 获取笔记完整信息（包含资源）
   */
  async getNoteWithResources(noteGuid) {
    const noteStore = this.getNoteStore();
    // getNote(guid, withContent, withResourcesData, withResourcesRecognition, withResourcesAlternateData)
    return await noteStore.getNote(noteGuid, true, true, false, false);
  }

  /**
   * 获取资源二进制数据
   */
  async getResourceData(resourceGuid) {
    const noteStore = this.getNoteStore();
    return await noteStore.getResourceData(resourceGuid);
  }

  /**
   * 获取资源信息
   */
  async getResource(resourceGuid, withData = true) {
    const noteStore = this.getNoteStore();
    return await noteStore.getResource(resourceGuid, withData, false, false, false);
  }
}

module.exports = EvernoteService;
