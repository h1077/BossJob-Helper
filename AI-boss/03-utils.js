  class ErrorHandler {
    static handle(error, context = '') {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      };

      console.error(`[${context}]`, error);

      if (state.settings && state.settings.errorReporting) {
        this.report(errorInfo);
      }

      return errorInfo;
    }

    static async wrap(fn, context) {
      try {
        return await fn();
      } catch (error) {
        return this.handle(error, context);
      }
    }

    static report(errorInfo) {
      console.log('Error reported:', errorInfo);
    }
  }

  class DOMCache {
    static cache = new Map();
    static maxAge = CONFIG.PERFORMANCE.DOM_CACHE_MAX_AGE;

    static get(selector) {
      const cached = this.cache.get(selector);
      if (cached && Date.now() - cached.time < this.maxAge) {
        return cached.element;
      }

      const element = document.querySelector(selector);
      if (element) {
        this.cache.set(selector, { element, time: Date.now() });
      }
      return element;
    }

    static getAll(selector) {
      return document.querySelectorAll(selector);
    }

    static clear() {
      this.cache.clear();
    }

    static remove(selector) {
      this.cache.delete(selector);
    }
  }

  class ManagedSet {
    constructor(maxSize = 500) {
      this.items = new Set();
      this.maxSize = maxSize;
    }

    add(item) {
      if (this.items.size >= this.maxSize) {
        const firstItem = this.items.values().next().value;
        this.items.delete(firstItem);
      }
      this.items.add(item);
    }

    has(item) {
      return this.items.has(item);
    }

    delete(item) {
      return this.items.delete(item);
    }

    clear() {
      this.items.clear();
    }

    get size() {
      return this.items.size;
    }

    toArray() {
      return Array.from(this.items);
    }
  }

  class EventManager {
    static listeners = new Map();

    static add(element, event, handler, options = {}) {
      const key = `${element.id || element.className || element.tagName}-${event}-${Date.now()}`;

      if (this.listeners.has(key)) {
        this.remove(key);
      }

      element.addEventListener(event, handler, options);
      this.listeners.set(key, { element, event, handler });
      return key;
    }

    static remove(key) {
      const listener = this.listeners.get(key);
      if (listener) {
        listener.element.removeEventListener(
          listener.event,
          listener.handler
        );
        this.listeners.delete(key);
      }
    }

    static removeAll() {
      this.listeners.forEach((_, key) => this.remove(key));
    }

    static getByElement(element) {
      const results = [];
      this.listeners.forEach((listener, key) => {
        if (listener.element === element) {
          results.push({ key, ...listener });
        }
      });
      return results;
    }
  }

  class DOMUtils {
    static async waitForAndAct(selector, action, options = {}) {
      const {
        timeout = 5000,
        retryInterval = 100,
        maxRetries = 3
      } = options;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const element = await Core.waitForElement(selector, timeout);
          if (element) {
            const result = await action(element);
            return result;
          }
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await Core.delay(retryInterval);
        }
      }
      return null;
    }

    static async clickElement(selector, options = {}) {
      return this.waitForAndAct(selector, async (element) => {
        await Core.simulateClick(element);
        return true;
      }, options);
    }

    static async inputText(selector, text, options = {}) {
      return this.waitForAndAct(selector, async (element) => {
        element.textContent = "";
        element.focus();
        document.execCommand("insertText", false, text);
        return true;
      }, options);
    }

    static debounce(fn, delay = CONFIG.UI.DEBOUNCE_DELAY) {
      let timer = null;
      return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    static throttle(fn, delay = CONFIG.UI.DEBOUNCE_DELAY) {
      let lastTime = 0;
      return function (...args) {
        const now = Date.now();
        if (now - lastTime >= delay) {
          lastTime = now;
          return fn.apply(this, args);
        }
      };
    }
  }

