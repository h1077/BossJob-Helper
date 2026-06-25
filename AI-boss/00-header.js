// ==UserScript==
// @name         小胡版AI-boss海投助手
// @namespace    https://github.com/DYxiaochen
// @version      2.0.0.0
// @description  基于Yangshengzhou开源项目改进的求职工具！小胡开发用于提高BOSS直聘投递效率，AI智能回复，批量沟通，高效求职
// @author       小胡 (基于Yangshengzhou开源项目)
// @match        https://www.zhipin.com/web/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @supportURL   https://github.com/DYxiaochen/AI-BossJob
// @homepageURL  https://github.com/DYxiaochen/AI-BossJob
// @license      AGPL-3.0-or-later
// @icon         https://gitee.com/Yangshengzhou/jobs_helper/raw/Boss/assets/icon.ico
// @connect      zhipin.com
// @connect      spark-api-open.xf-yun.com
// @connect      jasun.xyz
// @connect      api.siliconflow.cn
// @connect      ark.cn-beijing.volces.com
// @connect      api.openai.com
// @connect      api.deepseek.com
// @connect      localhost
// @noframes
// @require      https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js
// ==/UserScript==

(function () {
  "use strict";

  /**
   * @typedef {Object} HRInteraction
   * @property {string} hrKey - HR唯一标识
   * @property {boolean} hasGreeted - 是否已打招呼
   * @property {boolean} hasSentResume - 是否已发送简历
   * @property {boolean} hasSentImageResume - 是否已发送图片简历
   */

  /**
   * @typedef {Object} JobInfo
   * @property {string} jobId - 职位ID
   * @property {string} title - 职位标题
   * @property {string} company - 公司名称
   * @property {string} salary - 薪资范围
   * @property {string} location - 工作地点
   * @property {string} hrKey - HR标识
   */

  /**
   * @typedef {Object} GreetingItem
   * @property {string} id - 问候语ID
   * @property {string} content - 问候语内容
   */

  /**
   * @typedef {Object} ImageResume
   * @property {string} id - 图片简历ID
   * @property {string} name - 图片简历名称
   * @property {string} data - Base64编码的图片数据
   */

  /**
   * @typedef {Object} ErrorInfo
   * @property {string} message - 错误消息
   * @property {string} stack - 错误堆栈
   * @property {string} context - 错误上下文
   * @property {string} timestamp - 时间戳
   */

