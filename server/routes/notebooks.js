const express = require('express');
const router = express.Router();
const EvernoteService = require('../services/evernote');
const { getCredentials } = require('../utils/auth-helper');

// GET /api/notebooks - 获取笔记本列表
router.get('/', async (req, res, next) => {
  try {
    const credentials = getCredentials(req);
    const service = new EvernoteService(credentials.token, credentials.noteStoreUrl);

    const notebooks = await service.listNotebooks();

    res.json({
      success: true,
      notebooks: notebooks.map(nb => ({
        guid: nb.guid,
        name: nb.name,
        stack: nb.stack || null,
        defaultNotebook: nb.defaultNotebook || false,
        serviceCreated: nb.serviceCreated,
        serviceUpdated: nb.serviceUpdated
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notebooks/:guid/notes - 获取笔记本下的笔记列表
router.get('/:guid/notes', async (req, res, next) => {
  try {
    const { guid } = req.params;
    const { offset = 0, limit = 100 } = req.query;

    const credentials = getCredentials(req);
    const service = new EvernoteService(credentials.token, credentials.noteStoreUrl);

    const result = await service.getNotesInNotebook(guid, parseInt(offset), parseInt(limit));

    res.json({
      success: true,
      totalNotes: result.totalNotes,
      notes: result.notes.map(note => ({
        guid: note.guid,
        title: note.title,
        created: note.created,
        updated: note.updated,
        contentLength: note.contentLength
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
