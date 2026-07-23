(function (root) {
  function normalizeSummary(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function classify(text) {
    const value = normalizeSummary(text);
    if (!value) return 'unknown';
    if (/offer|录用通知|正式聘用/i.test(value)) return 'offer';
    if (/不合适|很遗憾|暂不考虑|无法继续|不予通过|感谢关注.{0,12}(不|暂)/i.test(value)) return 'rejection';
    if (/笔试|测评|在线考试|线上考试/i.test(value)) return 'written_test';
    if (/邀请.{0,20}(面试|面谈)|参加.{0,20}(面试|面谈)|约.{0,12}(面试|沟通)/i.test(value)) return 'interview_invite';
    return value ? 'hr_reply' : 'unknown';
  }

  function isFeedbackCandidate(text) {
    const value = normalizeSummary(text);
    return Boolean(value) && !/竞争者\s*PK[\s\S]{0,80}查看详细分析/i.test(value);
  }

  function eventKey(event) {
    const raw = [event.conversationId || '', normalizeSummary(event.summary), event.eventType || 'unknown'].join('|');
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `feedback-${(hash >>> 0).toString(16)}`;
  }

  function buildVisibleFeedbackEvents(messages, conversationId, context) {
    const hints = context || {};
    return (messages || []).map(message => {
      const summary = normalizeSummary(message.text);
      return isFeedbackCandidate(summary) ? {
        conversationId,
        sourceJobId: hints.sourceJobId || undefined,
        companyName: normalizeSummary(hints.companyName),
        jobName: normalizeSummary(hints.jobName),
        hrName: normalizeSummary(hints.hrName),
        summary,
        eventType: classify(summary),
        occurredAt: message.occurredAt || new Date().toISOString(),
        source: 'manual_refresh',
      } : null;
    }).filter(Boolean);
  }

  root.FeedbackEvents = { normalizeSummary, classify, isFeedbackCandidate, eventKey, buildVisibleFeedbackEvents };
  if (typeof module !== 'undefined') module.exports = { normalizeSummary, classify, isFeedbackCandidate, eventKey, buildVisibleFeedbackEvents };
}(globalThis));
