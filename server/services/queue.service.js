/**
 * 任务队列服务
 * 提供并发控制和任务执行管理
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class QueueService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.concurrency = options.concurrency || 3;
    this.timeout = options.timeout || 300000; // 默认5分钟

    this.queue = [];
    this.active = 0;
    this.results = [];

    logger.info('QueueService initialized', { concurrency: this.concurrency });
  }

  /**
   * 添加任务到队列
   * @param {Function} task - 要执行的任务函数
   * @param {object} metadata - 任务元数据
   * @returns {Promise} 任务执行结果的 Promise
   */
  add(task, metadata = {}) {
    return new Promise((resolve, reject) => {
      const id = this.generateId();

      this.queue.push({
        task,
        resolve,
        reject,
        id,
        metadata,
        addedAt: Date.now()
      });

      logger.debug('Task added to queue', { id, queueLength: this.queue.length });

      this.emit('taskAdded', { id, metadata });

      // 尝试处理队列
      this.process();
    });
  }

  /**
   * 处理队列中的任务
   */
  async process() {
    while (this.queue.length > 0 && this.active < this.concurrency) {
      this.active++;

      const { task, resolve, reject, id, metadata } = this.queue.shift();

      logger.info('Processing task', { id, active: this.active, queueLength: this.queue.length });

      this.emit('taskStart', { id, metadata });

      // 执行任务
      this._executeTask(task, id, metadata)
        .then(result => {
          this.results.push({ id, result, status: 'success', completedAt: Date.now() });
          this.emit('taskComplete', { id, result, metadata });
          resolve(result);
        })
        .catch(err => {
          this.results.push({ id, error: err.message, status: 'failed', completedAt: Date.now() });
          this.emit('taskError', { id, error: err, metadata });
          reject(err);
        })
        .finally(() => {
          this.active--;
          logger.debug('Task finished', { id, active: this.active, queueLength: this.queue.length });

          // 继续处理队列
          this.process();
        });
    }
  }

  /**
   * 执行单个任务（带超时控制）
   */
  async _executeTask(task, id, metadata) {
    return Promise.race([
      task(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), this.timeout)
      )
    ]);
  }

  /**
   * 获取队列进度信息
   */
  getProgress() {
    return {
      total: this.queue.length + this.active + this.results.length,
      completed: this.results.length,
      active: this.active,
      pending: this.queue.length,
      successCount: this.results.filter(r => r.status === 'success').length,
      errorCount: this.results.filter(r => r.status === 'failed').length,
      results: this.results
    };
  }

  /**
   * 生成唯一任务 ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清空队列和结果
   */
  clear() {
    const queueLength = this.queue.length;
    this.queue = [];
    this.results = [];

    logger.info('Queue cleared', { clearedTasks: queueLength });

    this.emit('queueCleared');
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      concurrency: this.concurrency,
      active: this.active,
      pending: this.queue.length,
      completed: this.results.length,
      isProcessing: this.active > 0 || this.queue.length > 0
    };
  }
}

module.exports = QueueService;
