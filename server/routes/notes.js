const express = require('express');
const router = express.Router();
const EvernoteService = require('../services/evernote');
const { getCredentials } = require('../utils/auth-helper');

// GET /api/notes/:guid - 获取笔记详情
router.get('/:guid', async (req, res, next) => {
  try {
    const { guid } = req.params;
    const { includeContent = false } = req.query;

    const credentials = getCredentials(req);
    const service = new EvernoteService(credentials.token, credentials.noteStoreUrl);

    const note = await service.getNote(guid, includeContent === 'true');

    const response = {
      success: true,
      note: {
        guid: note.guid,
        title: note.title,
        created: note.created,
        updated: note.updated,
        notebookGuid: note.notebookGuid,
        tagGuids: note.tagGuids || [],
        resources: (note.resources || []).map(r => ({
          guid: r.guid,
          mime: r.mime,
          width: r.width,
          height: r.height,
          filename: r.attributes?.fileName,
          size: r.data?.size
        }))
      }
    };

    if (includeContent === 'true') {
      response.note.content = note.content;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/notes/:guid/content - 获取笔记内容
router.get('/:guid/content', async (req, res, next) => {
  try {
    const { guid } = req.params;

    const credentials = getCredentials(req);
    const service = new EvernoteService(credentials.token, credentials.noteStoreUrl);

    const content = await service.getNoteContent(guid);

    res.json({
      success: true,
      content
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
