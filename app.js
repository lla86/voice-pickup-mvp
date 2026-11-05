import { parsePickupNumber } from './parser.mjs';

const $ = (id) => document.getElementById(id);
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const state = {
  wantsListening: false,
  starting: false,
  recognizer: null,
  retryTimer: null,
  retryCount: 0,
  wakeLock: null,
  events: [],
  calls: [],
  recentByNumber: new Map(),
  nextId: 1,
  demoIndex: 0,
  lastTranscript: ''
};
const DEMO_NUMBERS = ['125', '126', '129', '132', '140', '153'];
const DEDUPE_MS = 35000;
const MAX_EVENTS = 2500;

const formatTime = (stamp) => new Date(stamp).toLocaleTimeString('en-CA', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
const statusLabel = (kind) => ({unreviewed: '待确认', correct: '正确', wrong: '错误 / 误触发', missed:'漏识别'})[kind] || kind;

function setNotice(message, isError = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', isError);
}

function setListeningUI(mode, detail) {
  const active = mode === 'listening';
  document.body.classList.toggle('listening', active);
  $('live-dot').parentElement.classList.toggle('active', active);
  $('live-label').textContent = active ? '正在监听' : mode === 'connecting' ? '连接中' : '未开启';
  $('toggle-text').textContent = state.wantsListening ? '停止监听 / Stop' : '开始监听 / Start';
  $('toggle-btn').classList.toggle('on', state.wantsListening);
  $('number-note').textContent = detail || (active ? '等待员工喊号…' : '点击下方按钮开始收音');
}

function addEvent(entry) {
  const created = {id: state.nextId++, time: Date.now(), ...entry};
  state.events.unshift(created);
  if (state.events.length > MAX_EVENTS) state.events.pop();
  return created;
}

function showNumber(number, time) {
  $('current-number').textContent = number;
  $('current-number').classList.toggle('long', String(number).length >= 4);
  $('number-note').textContent = `识别成功 · ${formatTime(time)}`;
}

function ingestTranscript(text, {source = 'live', confidence = null} = {}) {
  state.lastTranscript = String(text).slice(0, 140);
  $('last-transcript').textContent = state.lastTranscript || '—';
  const parsed = parsePickupNumber(text, {requireCue: $('strict').checked});
  if (!parsed) {
    $('interim').textContent = '已过滤非有效喊号';
    return {accepted: false, reason: 'not-a-call'};
  }
  const number = parsed.number;
  const now = Date.now();
  // Only deduplicate live calls against live calls (demo is always separate).
  if (source === 'live' && state.recentByNumber.has(number) && now - state.recentByNumber.get(number) < DEDUPE_MS) {
    $('interim').textContent = `重复喊号 ${number} · 已过滤`;
    return {accepted: false, reason: 'duplicate', number};
  }
  if (source === 'live') state.recentByNumber.set(number, now);
  const event = addEvent({number, source, confidence, verdict: 'unreviewed'});
  state.calls.unshift(event);
  if (state.calls.length > 300) state.calls.pop();
  // Limit the dedup map to recent values so a long session does not grow indefinitely.
  if (state.recentByNumber.size > 150) {
    for (const [key, stamp] of state.recentByNumber) {
      if (now - stamp > DEDUPE_MS) state.recentByNumber.delete(key);
    }
  }
  showNumber(number, event.time);
  $('interim').textContent = source === 'demo' ? '模拟测试号码，未使用麦克风' : `识别到 ${number}`;
  render();
  return {accepted: true, number};
}

function renderRecent() {
  const parent = $('recent');
  parent.replaceChildren();
  if (!state.calls.length) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '还没有识别到有效号码'; parent.append(empty); return;
  }
  for (const call of state.calls.slice(0, 5)) {
    const card = document.createElement('div'); card.className = 'number-card';
    const number = document.createElement('b'); number.textContent = call.number;
    const time = document.createElement('small'); time.textContent = call.source === 'demo' ? '模拟' : formatTime(call.time).slice(0, 5);
    card.append(number, time); parent.append(card);
  }
}

function renderStats() {
  const live = state.events.filter(e => e.source === 'live');
  const assessed = state.events.filter(e => e.source === 'missed' || (e.source === 'live' && ['correct','wrong'].includes(e.verdict)));
  const correct = assessed.filter(e => e.verdict === 'correct').length;
  $('total-stat').textContent = String(live.length);
  $('missed-stat').textContent = String(state.events.filter(e => e.source === 'missed').length);
  $('correct-stat').textContent = assessed.length ? `${Math.round(correct / assessed.length * 100)}%` : '—';
}

function renderEvents() {
  const parent = $('event-list'); parent.replaceChildren();
  const entries = state.events.slice(0, 20);
  if (!entries.length) {const empty = document.createElement('div'); empty.className='empty small'; empty.textContent='尚无现场测试记录'; parent.append(empty); return;}
  for (const entry of entries) {
    const wrapper = document.createElement('div'); wrapper.className = 'event';
    const head = document.createElement('div'); head.className = 'event-head';
    const number = document.createElement('strong'); number.textContent = entry.source === 'missed' ? '未识别' : `# ${entry.number}`;
    const time = document.createElement('time'); time.dateTime = new Date(entry.time).toISOString(); time.textContent = formatTime(entry.time);
    head.append(number, time);
    const foot = document.createElement('div'); foot.className = 'event-foot';
    const tag = document.createElement('span'); tag.className = `tag ${entry.source === 'demo' ? 'demo' : entry.source === 'missed' ? 'missed' : ''}`;
    tag.textContent = entry.source === 'demo' ? '模拟 · 不计入统计' : entry.source === 'missed' ? '漏识别 · 已计入' : statusLabel(entry.verdict);
    foot.append(tag);
    if (entry.source === 'live') {
      const group = document.createElement('div'); group.className = 'review';
      for (const verdict of ['correct','wrong']) {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = verdict === 'correct' ? '✓ 正确' : '✕ 错误';
        button.className = `${verdict === 'wrong' ? 'wrong ' : ''}${entry.verdict === verdict ? 'selected' : ''}`;
        button.setAttribute('aria-pressed', String(entry.verdict === verdict));
        button.addEventListener('click', () => { entry.verdict = entry.verdict === verdict ? 'unreviewed' : verdict; render(); });
        group.append(button);
      }
      foot.append(group);
    }
    wrapper.append(head, foot); parent.append(wrapper);
  }
}
function render() {renderRecent(); renderStats(); renderEvents();}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || !state.wantsListening) return;
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch (_) { /* optional */ }
}
async function releaseWakeLock() {
  if (state.wakeLock) {try { await state.wakeLock.release(); } catch (_) { /* optional */ } state.wakeLock = null;}
}
function clearRetryTimer() { if (state.retryTimer !== null) {clearTimeout(state.retryTimer); state.retryTimer = null;} }
function scheduleRestart() {
  clearRetryTimer();
  if (!state.wantsListening || document.visibilityState !== 'visible') return;
  const delay = Math.min(700 + (state.retryCount * 500), 4000);
  state.retryTimer = setTimeout(() => {state.retryTimer = null; startSpeechEngine();}, delay);
}
function createRecognition() {
  const r = new SpeechRecognitionCtor();
  r.lang = $('language').value;
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.onstart = () => {state.starting = false; state.retryCount = 0; setListeningUI('listening', '正在等待喊号…'); setNotice('麦克风已启动。保持页面在前台，识别服务可能需要联网。');};
  r.onspeechstart = () => {if (state.wantsListening) $('interim').textContent = '检测到语音…';};
  r.onresult = (event) => {
    if (!state.wantsListening) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result.length) continue;
      const transcript = result[0].transcript || '';
      if (result.isFinal) {
        $('interim').textContent = '正在解析号码…';
        ingestTranscript(transcript, {source:'live', confidence: Number.isFinite(result[0].confidence) ? result[0].confidence : null});
      } else {
        $('interim').textContent = `听到：${transcript.slice(0, 55)}`;
      }
    }
  };
  r.onerror = (event) => {
    const err = event.error || 'unknown';
    if (!state.wantsListening) return;
    const fatal = ['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(err);
    const message = ({
      'not-allowed':'麦克风权限被拒绝。请在浏览器设置中允许此网站使用麦克风。',
      'service-not-allowed':'当前浏览器或系统不允许语音识别服务。请尝试 Android Chrome 或 iPhone Safari。',
      'audio-capture':'无法访问麦克风。检查设备连接和系统权限。',
      'language-not-supported':'当前设备不支持所选语言。',
      'network':'语音识别网络连接失败。请检查网络后重试。',
      'no-speech':'本轮未检测到语音，正在继续监听。',
      'aborted':'语音识别已中断。'
    })[err] || `语音识别服务报告错误：${err}`;
    setNotice(message, fatal || err === 'network');
    if (fatal) {stopListening();}
    else if (err === 'network') {state.retryCount++; if (state.retryCount >= 4) stopListening();}
  };
  r.onend = () => {
    state.starting = false;
    if (state.wantsListening) {
      setListeningUI('connecting', document.visibilityState === 'visible' ? '识别会话结束，尝试重新连接…' : '页面不在前台，已暂停');
      scheduleRestart();
    } else {setListeningUI('idle');}
  };
  return r;
}
function startSpeechEngine() {
  if (!state.wantsListening || state.starting || document.visibilityState !== 'visible') return;
  if (!SpeechRecognitionCtor) {stopListening(); setNotice('此浏览器不支持 Web Speech Recognition。请尝试 Android Chrome 或 iPhone Safari。', true); return;}
  try {
    state.starting = true;
    state.recognizer = createRecognition();
    state.recognizer.start();
    setListeningUI('connecting','正在请求麦克风和语音识别服务…');
  } catch (err) {
    state.starting = false;
    setNotice(`启动失败：${err.message || String(err)}`, true);
    stopListening();
  }
}
function startListening() {
  if (!SpeechRecognitionCtor) {setNotice('此浏览器不支持语音识别。请使用 Android Chrome 或 iPhone Safari 的最新版本。', true); return;}
  if (!window.isSecureContext) {setNotice('麦克风通常要求 HTTPS 安全网页。请先部署到 HTTPS 网站（如 GitHub Pages）。', true); return;}
  state.wantsListening = true;
  state.retryCount = 0;
  setListeningUI('connecting', '准备启动…');
  // The first .start() is called directly within the user's click, important on mobile.
  startSpeechEngine();
  requestWakeLock();
}
function stopListening() {
  state.wantsListening = false;
  state.starting = false;
  clearRetryTimer();
  if (state.recognizer) {
    const current = state.recognizer; state.recognizer = null;
    current.onend = null;
    current.onerror = null;
    current.onresult = null;
    try {current.abort();} catch (_) { /* okay */ }
  }
  releaseWakeLock();
  setListeningUI('idle');
}
function restartRecognition() {
  if (!state.wantsListening) return;
  stopListening();
  startListening();
}
function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formula execution when opening CSV files.
  const safe = /^[=+@\-\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}
function exportCsv() {
  const rows = [['time_iso','called_number','source','verdict','recognition_confidence']];
  for (const e of [...state.events].reverse()) {
    rows.push([new Date(e.time).toISOString(), e.number || '', e.source, e.verdict, e.confidence]);
  }
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = `voice-pickup-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  setNotice(`已请求导出 ${state.events.length} 条记录；若手机浏览器阻止下载，请检查下载菜单。`);
}

$('toggle-btn').addEventListener('click', () => state.wantsListening ? stopListening() : startListening());
$('demo-btn').addEventListener('click', () => {
  const number = DEMO_NUMBERS[state.demoIndex++ % DEMO_NUMBERS.length];
  ingestTranscript(`Order number ${number}`, {source:'demo'});
  setNotice('模拟模式：此数字由测试按钮生成，不是麦克风识别结果。');
});
$('phrase-btn').addEventListener('click', () => {
  const phrase = $('test-phrase').value.trim();
  if (!phrase) return;
  const result = ingestTranscript(phrase, {source:'demo'});
  setNotice(result.accepted ? `文字规则测试成功：${result.number}（非真实语音识别）` : '文字不符合有效喊号规则。可尝试 Order number 125。', !result.accepted);
});
$('test-phrase').addEventListener('keydown', event => {if (event.key === 'Enter') $('phrase-btn').click();});
$('clear-btn').addEventListener('click', () => {
  if (!state.events.length) return;
  if (!window.confirm('清空当前所有号码和测试记录？清空后无法恢复。')) return;
  state.events = []; state.calls = []; state.recentByNumber.clear();
  $('current-number').textContent = '—'; $('current-number').classList.remove('long');
  $('number-note').textContent = state.wantsListening ? '等待员工喊号…' : '点击下方按钮开始收音';
  $('interim').textContent = '历史已清空'; render();
});
$('missed-btn').addEventListener('click', () => {addEvent({source:'missed', number:'', verdict:'missed', confidence:null}); render();});
$('export-btn').addEventListener('click', exportCsv);
$('language').addEventListener('change', restartRecognition);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    clearRetryTimer();
    if (state.recognizer && state.wantsListening) {
      try {state.recognizer.abort();} catch (_) { /* okay */ }
    }
    releaseWakeLock();
    if (state.wantsListening) setListeningUI('connecting', '页面转入后台，监听可能暂停');
  } else if (state.wantsListening) {
    requestWakeLock();
    scheduleRestart();
  }
});
window.addEventListener('pagehide', () => stopListening());

if (!SpeechRecognitionCtor) setNotice('当前浏览器不支持语音识别，可先用“模拟喊号”验证显示界面。建议 Android Chrome 或 iPhone Safari。', true);
else if (!window.isSecureContext) setNotice('需要 HTTPS 安全网页才能可靠申请麦克风权限。', true);
render();