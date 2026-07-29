/* ============================================================
   캘린더 자동 수집 — /api/calendar-sync (Vercel Cron이 매일 호출)
   세무·회계 법정기한(규칙 생성) + 법제처 법령 개정 + 기업마당 정책자금을
   당월·익월 기준으로 수집해 Supabase calendar_events에 upsert한다.
   · 같은 (year,month,day,title,cat)은 갱신 — 연장 고시 등 변동 반영
   · source='manual' 행은 건드리지 않으므로 운영자가 직접 일정을 추가 가능
   Hobby 플랜 함수 12개 제한 때문에 별도 서버리스 함수가 아니라
   api/calendar.js 안에서 ?sync=1 로 호출되는 모듈이다.
   ============================================================ */
const sb = require('./supabase');

const BIZMANG_KEY = 'hCd7Cu';
const LAW_OC = 'blackbook2026';
const pad = n => String(n).padStart(2, '0');

/* ── 세무·회계 법정기한 규칙 (assets/calendar-data.js와 동일 규칙의 서버판) ── */
function statutory(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const out = [];
  const push = (day, title, cat) => out.push({
    year, month, day: Math.min(day, lastDay), title, cat,
    kind: 'statutory', link: 'https://www.nts.go.kr', agency: '국세청',
  });

  push(10, '원천세 신고·납부', 'tax');
  push(lastDay, '일용근로소득 지급명세서 제출', 'tax');
  if ([1, 4, 7, 10].includes(month)) push(25, '부가가치세 신고·납부', 'tax');
  if ([3, 9].includes(month)) push(25, '부가가치세 예정고지 납부', 'tax');

  const annual = {
    3: [[10, '연말정산 지급명세서 제출', 'tax'], [31, '법인세 신고·납부 (12월 결산)', 'acc']],
    4: [[30, '법인 지방소득세 신고·납부', 'tax']],
    5: [[31, '종합소득세 신고·납부', 'tax']],
    6: [[30, '성실신고확인대상 종합소득세 신고', 'tax']],
    8: [[31, '법인세 중간예납 신고·납부', 'tax']],
    11: [[30, '종합소득세 중간예납 납부', 'tax']],
    12: [[31, '4대보험 보수총액 신고 준비', 'acc']],
  };
  (annual[month] || []).forEach(a => push(a[0], a[1], a[2]));
  return out;
}

/* ── 법제처 법령 개정 (api/calendar.js와 동일 소스) ── */
function classifyLaw(title) {
  const t = title || '';
  if (/세법|부가가치세|소득세|법인세|원천|국세|지방세|관세|증여세|상속세|양도세|종합소득|세무|과세/.test(t)) return 'tax';
  if (/회계|결산|재무제표|외부감사|감사인|자본시장|공시/.test(t)) return 'acc';
  return 'law';
}
async function fetchLaw(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_OC}&target=lsSearch&type=JSON&efYd=${year}${pad(month)}01&efYdEnd=${year}${pad(month)}${pad(lastDay)}&display=100&page=1`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const data = await r.json();
  const raw = (data.LawSearch || data)?.laws?.law || [];
  const laws = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const DEPTS = ['기획재정부', '금융위원회', '고용노동부', '중소벤처기업부', '금융감독원', '국세청'];
  const out = [];
  laws.forEach(law => {
    const title = law['법령명한글'] || law.lsNm || '';
    const efDate = law['시행일자'] || law.efYd || '';
    const dept = law['소관부처명'] || law.mnstNm || '';
    const lawId = law['법령ID'] || law.lsId || '';
    if (!title || String(efDate).length < 8) return;
    if (!DEPTS.some(d => String(dept).includes(d))) return;
    const y = +String(efDate).slice(0, 4), m = +String(efDate).slice(4, 6), d = +String(efDate).slice(6, 8);
    if (y !== year || m !== month) return;
    // 제목은 라이브 API와 동일 형태로 저장(클라이언트 중복 제거 키 일치)
    out.push({
      year, month, day: d, title, cat: classifyLaw(title),
      kind: 'update', agency: dept,
      link: lawId ? `https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&lawId=${lawId}` : 'https://www.law.go.kr',
    });
  });
  return out;
}

/* ── 기업마당 정책자금 공고 ── */
async function fetchPolicy(year, month) {
  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${BIZMANG_KEY}&dataType=json&searchLclasId=01&pageUnit=100&pageIndex=1`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)', Accept: 'application/json, */*' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return [];
  const items = (await r.json()).jsonArray || [];
  const out = [];
  const parseDate = s => {
    const p = String(s || '').trim().split(' ')[0].split('-');
    return p.length >= 3 ? { y: +p[0], m: +p[1], d: +p[2] } : null;
  };
  items.forEach(item => {
    const title = item.pblancNm || '', reqstDt = item.reqstBeginEndDe || '';
    if (!title || !reqstDt.includes('~')) return;
    const [b, e] = reqstDt.split('~').map(s => s.trim());
    const extra = {
      id: item.pblancId || '', summary: item.bsnsSumryCn || '', target: item.trgetNm || '',
      field: item.pldirSportRealmLclasCodeNm || '', apply: item.reqstMthPapersCn || '', period: reqstDt,
    };
    const agency = item.jrsdInsttNm || item.excInsttNm || '';
    // 접수 시작/마감 suffix는 클라이언트 표시 단계에서 붙이므로 원제목으로 저장
    const add = (dt, tag) => {
      if (dt && dt.y === year && dt.m === month) out.push({
        year, month, day: dt.d, title, cat: 'fund',
        kind: 'policy', tag, link: item.pblancUrl || '', agency, summary: extra.summary, extra,
      });
    };
    add(parseDate(b), 'start');
    add(parseDate(e), 'end');
  });
  return out;
}

async function sync() {
  if (!sb.ready()) {
    return { skipped: true, reason: 'SUPABASE_SERVICE_ROLE_KEY 미설정 — 수집을 건너뜀' };
  }

  const now = new Date();
  const months = [
    { y: now.getFullYear(), m: now.getMonth() + 1 },
    { y: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), m: (now.getMonth() + 1) % 12 + 1 },
  ];

  const report = [];
  for (const { y, m } of months) {
    const [law, policy] = await Promise.all([
      fetchLaw(y, m).catch(() => []),
      fetchPolicy(y, m).catch(() => []),
    ]);
    const rows = [...statutory(y, m), ...law, ...policy].map(e => ({
      year: e.year, month: e.month, day: e.day, title: e.title.slice(0, 300), cat: e.cat,
      source: 'cron', kind: e.kind || '', tag: e.tag || '', link: e.link || '',
      agency: e.agency || '', summary: (e.summary || '').slice(0, 2000), extra: e.extra || {},
    }));
    if (rows.length) await sb.upsert('calendar_events', rows, 'year,month,day,title,cat');
    report.push({ year: y, month: m, statutory: statutory(y, m).length, law: law.length, policy: policy.length });
  }

  return { ok: true, synced: report };
}

module.exports = { sync };
