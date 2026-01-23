/**
 * DOM 操作工具函数
 */

/**
 * 查询单个元素
 * @param {string} selector - CSS 选择器
 * @param {Element} parent - 父元素
 * @returns {Element|null} 元素或 null
 */
function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 查询多个元素
 * @param {string} selector - CSS 选择器
 * @param {Element} parent - 父元素
 * @returns {NodeList} 元素列表
 */
function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * 创建元素
 * @param {string} tag - 标签名
 * @param {object} attributes - 属性对象
 * @param {string|Element|Array} content - 内容
 * @returns {Element} 创建的元素
 */
function createElement(tag, attributes = {}, content = null) {
  const element = document.createElement(tag);

  // 设置属性
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value);
    }
  }

  // 设置内容
  if (content !== null) {
    if (typeof content === 'string') {
      element.innerHTML = content;
    } else if (content instanceof Element) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
          element.appendChild(child);
        }
      });
    }
  }

  return element;
}

/**
 * 添加类名
 * @param {Element} element - 元素
 * @param {...string} classNames - 类名
 */
function addClass(element, ...classNames) {
  element?.classList.add(...classNames);
}

/**
 * 移除类名
 * @param {Element} element - 元素
 * @param {...string} classNames - 类名
 */
function removeClass(element, ...classNames) {
  element?.classList.remove(...classNames);
}

/**
 * 切换类名
 * @param {Element} element - 元素
 * @param {string} className - 类名
 * @param {boolean} force - 强制添加或移除
 */
function toggleClass(element, className, force) {
  element?.classList.toggle(className, force);
}

/**
 * 检查是否有类名
 * @param {Element} element - 元素
 * @param {string} className - 类名
 * @returns {boolean} 是否有类名
 */
function hasClass(element, className) {
  return element?.classList.contains(className) || false;
}

/**
 * 显示元素
 * @param {Element} element - 元素
 * @param {string} display - display 值
 */
function show(element, display = 'block') {
  if (element) {
    element.style.display = display;
  }
}

/**
 * 隐藏元素
 * @param {Element} element - 元素
 */
function hide(element) {
  if (element) {
    element.style.display = 'none';
  }
}

/**
 * 设置元素文本
 * @param {Element} element - 元素
 * @param {string} text - 文本
 */
function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/**
 * 设置元素 HTML
 * @param {Element} element - 元素
 * @param {string} html - HTML
 */
function setHTML(element, html) {
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * 获取元素属性
 * @param {Element} element - 元素
 * @param {string} attribute - 属性名
 * @returns {string|null} 属性值
 */
function getAttr(element, attribute) {
  return element?.getAttribute(attribute) || null;
}

/**
 * 设置元素属性
 * @param {Element} element - 元素
 * @param {string} attribute - 属性名
 * @param {string} value - 属性值
 */
function setAttr(element, attribute, value) {
  element?.setAttribute(attribute, value);
}

/**
 * 移除元素属性
 * @param {Element} element - 元素
 * @param {string} attribute - 属性名
 */
function removeAttr(element, attribute) {
  element?.removeAttribute(attribute);
}

/**
 * 事件委托
 * @param {Element} parent - 父元素
 * @param {string} selector - 选择器
 * @param {string} event - 事件名
 * @param {Function} handler - 处理函数
 */
function delegate(parent, selector, event, handler) {
  parent?.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler.call(target, e);
    }
  });
}

// 导出所有函数
window.DOM = {
  $,
  $$,
  createElement,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  show,
  hide,
  setText,
  setHTML,
  getAttr,
  setAttr,
  removeAttr,
  delegate
};
