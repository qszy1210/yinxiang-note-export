/**
 * 从请求中获取认证信息
 * 优先使用请求头中的信息，否则使用环境变量
 */
function getCredentials(req) {
  // 从请求头获取
  const headerToken = req.headers['x-evernote-token'];
  const headerNoteStoreUrl = req.headers['x-evernote-notestore-url'];

  // 从请求体获取
  const bodyToken = req.body?.token;
  const bodyNoteStoreUrl = req.body?.noteStoreUrl;

  // 从环境变量获取
  const envToken = process.env.EVERNOTE_TOKEN;
  const envNoteStoreUrl = process.env.EVERNOTE_NOTESTORE_URL;

  const token = headerToken || bodyToken || envToken;
  const noteStoreUrl = headerNoteStoreUrl || bodyNoteStoreUrl || envNoteStoreUrl;

  if (!token || !noteStoreUrl) {
    const error = new Error('未提供有效的 Token 或 NoteStore URL');
    error.status = 401;
    throw error;
  }

  return { token, noteStoreUrl };
}

module.exports = { getCredentials };
