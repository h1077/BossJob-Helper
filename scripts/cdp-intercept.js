// CDP Interceptor — 截获 BOSS 搜索 API 原始返回数据
// 用途: 确认 joblist.json 中有哪些字段, 评估方案B/C的可行性
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

function getPages() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const pages = await getPages();
  const page = pages.find(p => p.url && p.url.includes('zhipin.com/web/geek/jobs'));
  if (!page) { console.log('未找到 BOSS 搜索页; 可用pages:', pages.map(p => p.url)); process.exit(1); }
  console.log('目标页面:', page.title.slice(0, 80));

  const wsUrl = page.webSocketDebuggerUrl;
  const sock = new WebSocket(wsUrl);
  const pending = {};

  sock.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    // CDP command response
    if (msg.id && pending[msg.id]) {
      pending[msg.id](msg.result);
      delete pending[msg.id];
      return;
    }
  });

  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 100000);
      pending[id] = resolve;
      sock.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (pending[id]) { delete pending[id]; resolve(null); } }, 5000);
    });
  }

  await new Promise(resolve => sock.on('open', resolve));
  console.log('CDP 已连接');

  // 直接在浏览器中 fetch BOSS API
  const result = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const resp = await fetch('/wapi/zpgeek/search/joblist.json?query=%E5%94%AE%E5%89%8D&city=101280600&page=1&pageSize=2');
          const data = await resp.json();
          if (data.zpData && data.zpData.jobList) {
            const item = data.zpData.jobList[0];
            return JSON.stringify({
              success: true,
              totalCount: data.zpData.totalCount || data.zpData.jobList.length,
              itemKeys: Object.keys(item),
              sampleItem: item
            });
          }
          return JSON.stringify({ success: false, code: data.code, message: data.message });
        } catch(e) {
          return JSON.stringify({ success: false, error: e.message });
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  sock.close();

  if (!result || !result.result || !result.result.value) {
    console.log('CDP 返回空:', JSON.stringify(result));
    process.exit(1);
  }

  const parsed = JSON.parse(result.result.value);
  console.log('\n========== BOSS API 返回字段 ==========');
  if (parsed.success) {
    console.log('总岗位数:', parsed.totalCount);
    console.log('\n第一个 job item 的字段列表:');
    parsed.itemKeys.forEach(k => console.log('  ▸', k));

    console.log('\n========== 完整 sample ==========');
    console.log(JSON.stringify(parsed.sampleItem, null, 2));

    fs.writeFileSync(
      'D:/hu/Desktop/AI-BossJob/scripts/boss-api-sample.json',
      JSON.stringify(parsed, null, 2)
    );
    console.log('\n✅ 已保存到 scripts/boss-api-sample.json');
  } else {
    console.log('API 调用失败:', JSON.stringify(parsed));
  }

  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
