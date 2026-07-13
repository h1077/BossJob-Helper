// ===== 共享选择器 + 城市编码（Boss_helper.js → Extension）=====
const SELECTORS = {
  jobs: {
    jobCard: 'li.job-card-box, .job-card-box, [class*="job-card"]',
    jobName: '.job-name',
    jobSalary: '.salary, .job-salary',
    tagList: '.tag-list li, .job-tag, [class*="tag"]',
    company: '.company-name a, .company-name, [class*="company-name"]',
    immediateChatBtn: 'a.op-btn-chat, .op-btn-chat',
    jobDetailBox: '.job-detail-box, [class*="job-detail"], .detail-content',
    jobDesc: '.job-sec-text, [class*="job-sec"], [class*="job-desc"]',
    bossActiveTime: '.boss-active-time',
    bossOnlineTag: '.boss-online-tag',
    headhuntingIcon: '.job-tag-icon',
    nextPage: '.options-pages .next:not(.disabled), .pagination .next:not(.disabled)',
    jobArea: '.job-area, .job-location'
  },
  chat: {
    userList: '.user-list-content li, .user-item, [class*="user-list"] li',
    userName: '.geek-name, .name-text, [class*="name"]',
    userCompany: '.title-box .name-box, [class*="company"]',
    chatInput: '#chat-input, div.chat-input, [contenteditable="true"]',
    btnSend: 'button.btn-send, .btn-send',
    imageUpload: '.btn-sendimg input[type=file], .toolbar input[type=file]',
    messageSent: '.item-myself, .message-self',
    toolbarBtns: '.toolbar-btn',
    resumeBtn: '.toolbar-btn', // 通过 textContent === "发简历" 筛选
    greetingModal: '.default-btn.cancel-btn'  // textContent === "留在此页"
  }
};

const CITY_MAP = {
  '北京': '101010100', '上海': '101020100', '广州': '101280100', '深圳': '101280600',
  '杭州': '101210100', '成都': '101270100', '南京': '101190100', '武汉': '101200100',
  '西安': '101110100', '重庆': '101040100', '长沙': '101250100', '苏州': '101190400',
  '天津': '101030100', '郑州': '101180100', '合肥': '101220100', '济南': '101120100',
  '青岛': '101120200', '厦门': '101230200', '福州': '101230100', '大连': '101070200',
  '沈阳': '101070100', '昆明': '101290100', '贵阳': '101260100', '南宁': '101300100',
  '东莞': '101281600', '佛山': '101280800', '宁波': '101210400', '无锡': '101190200',
  '全国': '100010000'
};

const CONFIG = {
  BASIC_INTERVAL: 1000,
  OPERATION_INTERVAL: 1200,
  MAX_SCAN_PAGES: 5,
  PAGE_SCAN_DELAY: 8000,
  DAILY_APPLY_LIMIT: 100,
  HR_INACTIVE_DAYS: 14,
  MATCH: { MIN_SCORE: 3, TITLE_WEIGHT: 2, DESC_WEIGHT: 1 },
  COMPANY_CHECK: { REJECT_THRESHOLD: 6 },
  PEAK_HOURS: [
    { start: 9, end: 11, label: '上午 9:00-11:00' },
    { start: 14, end: 17, label: '下午 14:00-17:00' }
  ]
};
