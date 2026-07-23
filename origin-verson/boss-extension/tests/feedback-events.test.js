const test = require('node:test');
const assert = require('node:assert/strict');

const { buildVisibleFeedbackEvents, classify, eventKey, normalizeSummary } = require('../src/feedback-events.js');

test('识别明确的面试邀约', () => {
  assert.equal(classify('我们邀请您参加下周的技术面试'), 'interview_invite');
});

test('摘要截断且不保存完整文本', () => {
  assert.equal(normalizeSummary('a'.repeat(200)).length, 180);
});

test('同一事件生成相同去重键', () => {
  const event = { conversationId: 'c1', summary: '邀请面试', eventType: 'interview_invite', occurredAt: '2026-07-18T10:01:30' };
  assert.equal(eventKey(event), eventKey({ ...event }));
});

test('刷新反馈只返回消息事件，不执行发送动作', () => {
  const events = buildVisibleFeedbackEvents([{ text: '邀请您面试', occurredAt: '2026-07-18T10:00:00' }], 'chat-1');
  assert.deepEqual(events.map(event => event.eventType), ['interview_invite']);
});

test('刷新反馈会携带有限的岗位关联线索', () => {
  const events = buildVisibleFeedbackEvents(
    [{ text: '您好，邀请您参加面试', occurredAt: '2026-07-18T10:00:00' }],
    'chat-1',
    { companyName: '示例公司', jobName: '后端工程师', hrName: 'Alice' },
  );
  assert.deepEqual(events[0].companyName, '示例公司');
  assert.deepEqual(events[0].jobName, '后端工程师');
  assert.deepEqual(events[0].hrName, 'Alice');
});

test('刷新反馈忽略 BOSS 的竞争者 PK 系统卡片', () => {
  const events = buildVisibleFeedbackEvents([
    { text: '你与该职位竞争者 PK 情况 查看详细分析' },
    { text: '方便发一份你的简历过来吗？' },
  ], 'chat-1');
  assert.deepEqual(events.map(event => event.summary), ['方便发一份你的简历过来吗？']);
});

test('同一可见消息在不同刷新时间仍使用同一个去重键', () => {
  const first = eventKey({ conversationId: 'chat-1', summary: '方便发一份你的简历过来吗？', eventType: 'hr_reply', occurredAt: '2026-07-18T10:00:00' });
  const second = eventKey({ conversationId: 'chat-1', summary: '方便发一份你的简历过来吗？', eventType: 'hr_reply', occurredAt: '2026-07-18T10:05:00' });
  assert.equal(first, second);
});
