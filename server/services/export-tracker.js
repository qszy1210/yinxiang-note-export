/**
 * 导出任务追踪服务
 * 用于跟踪和管理批量导出任务的状态
 */

const logger = require('../utils/logger');

class ExportTracker {
  constructor() {
    this.tasks = new Map();

    // 定期清理过期任务（每小时）
    this.cleanupInterval = setInterval(() => {
      this.cleanOldTasks();
    }, 3600000);

    logger.info('ExportTracker initialized');
  }

  /**
   * 创建新的导出任务
   * @param {string} taskId - 任务 ID
   * @param {object} config - 任务配置
   * @returns {object} 任务对象
   */
  createTask(taskId, config = {}) {
    const task = {
      id: taskId,
      status: 'pending',          // pending, processing, completed, failed
      progress: 0,                // 0-100
      total: 0,
      success: 0,
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      config
    };

    this.tasks.set(taskId, task);

    logger.info('Export task created', { taskId, config });

    return this.getTask(taskId);
  }

  /**
   * 更新任务状态
   * @param {string} taskId - 任务 ID
   * @param {object} updates - 要更新的字段
   * @returns {object} 更新后的任务对象
   */
  updateTask(taskId, updates = {}) {
    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn('Attempted to update non-existent task', { taskId });
      return null;
    }

    Object.assign(task, updates);
    task.updatedAt = new Date();

    logger.debug('Export task updated', { taskId, updates });

    return task;
  }

  /**
   * 获取任务信息
   * @param {string} taskId - 任务 ID
   * @returns {object|null} 任务对象或 null
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 删除任务
   * @param {string} taskId - 任务 ID
   */
  deleteTask(taskId) {
    const deleted = this.tasks.delete(taskId);

    if (deleted) {
      logger.info('Export task deleted', { taskId });
    }

    return deleted;
  }

  /**
   * 清理过期任务
   * @param {number} maxAge - 最大存活时间（毫秒），默认1小时
   */
  cleanOldTasks(maxAge = 3600000) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, task] of this.tasks.entries()) {
      const age = now - task.createdAt.getTime();

      if (age > maxAge) {
        this.tasks.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Old export tasks cleaned', { count: cleanedCount, maxAge });
    }
  }

  /**
   * 获取所有任务
   * @returns {Array} 任务列表
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取活跃任务（非 completed 状态）
   * @returns {Array} 活跃任务列表
   */
  getActiveTasks() {
    return this.getAllTasks().filter(task => task.status !== 'completed' && task.status !== 'failed');
  }

  /**
   * 获取任务统计
   * @returns {object} 统计信息
   */
  getStats() {
    const tasks = this.getAllTasks();

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  }

  /**
   * 销毁追踪器（清理资源）
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.tasks.clear();

    logger.info('ExportTracker destroyed');
  }
}

// 导出单例
module.exports = new ExportTracker();
