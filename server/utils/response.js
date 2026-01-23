/**
 * 统一响应格式工具
 * 提供标准的 API 响应格式
 */

/**
 * 成功响应
 * @param {object} res - Express 响应对象
 * @param {object} data - 响应数据
 * @param {string} message - 响应消息
 */
function success(res, data, message = '操作成功') {
  return res.json({
    success: true,
    message,
    data
  });
}

/**
 * 错误响应
 * @param {object} res - Express 响应对象
 * @param {string} message - 错误消息
 * @param {number} status - HTTP 状态码
 */
function error(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    message
  });
}

/**
 * 分页响应
 * @param {object} res - Express 响应对象
 * @param {array} items - 数据列表
 * @param {object} pagination - 分页信息
 * @param {string} message - 响应消息
 */
function paginated(res, items, pagination, message = '获取成功') {
  return res.json({
    success: true,
    message,
    data: {
      items,
      pagination: {
        total: pagination.total,
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 10,
        ...pagination
      }
    }
  });
}

module.exports = {
  success,
  error,
  paginated
};
