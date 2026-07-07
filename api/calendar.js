const BIZMANG_KEY = 'hCd7Cu';
const LAW_OC      = 'blackbook2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const { year, month } = req.query;
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;

  const pad     = n => String(n).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  const startDate = `${y}${pad(m)}01`;
  const endDate   = `${y}${pad(m)}${pad(lastDay)}`;

  // 두 API 병렬 호출
  const [policyResult, lawResult] = await Promise.allSettled([
    fetchPolicyEvents(y, m),
    fetchLawEvents(y, m, startDate, endDate),
  ]);

  const policyEvents = policyResult.status === 'fulfilled' ? policyResult.value : [];
  const lawEvents    = lawResult.status    === 'fulfilled' ? lawResult.value    : [];

  res.status(200).json({
    events: [...policyEvents, ...lawEvents],
    year: y,
    month: m,
  });
};

/* ── 기업마당 주요일정 ── */
async function fetchPolicyEvents(y, m) {
  try {
    const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${BIZMANG_KEY}&dataType=json&searchLclasId=01&pageUnit=100&pageIndex=1`;
    const r   = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)',
        'Accept': 'application/json, */*',
        'Referer': 'https://blackbook-red.vercel.app',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];

    const data   = await r.json();
    const items  = data.jsonArray || [];
    const events = [];

    items.forEach(item => {
      const title   = item.pblancNm        || '';
      const link    = item.pblancUrl       || '';
      const reqstDt = item.reqstBeginEndDe || '';
      if (!title || !reqstDt || !reqstDt.includes('~')) return;

      const parts = reqstDt.split('~').map(s => s.trim());
      const parseDate = str => {
        if (!str) return null;
        const p = str.trim().split(' ')[0].split('-');
        if (p.length < 3) return null;
        return { y: parseInt(p[0]), m: parseInt(p[1]), d: parseInt(p[2]) };
      };

      // 설명 페이지용 부가 정보(기업마당 공고 분석 요약)
      const meta = {
        id:      item.pblancId || '',
        summary: item.bsnsSumryCn || '',
        agency:  item.jrsdInsttNm || item.excInsttNm || '',
        target:  item.trgetNm || '',
        field:   item.pldirSportRealmLclasCodeNm || '',
        apply:   item.reqstMthPapersCn || '',
        period:  reqstDt,
      };

      const start = parseDate(parts[0]);
      const end   = parseDate(parts[1]);
      if (start && start.y === y && start.m === m)
        events.push({ day: start.d, title, link, type: 'policy', tag: 'start', ...meta });
      if (end && end.y === y && end.m === m)
        events.push({ day: end.d, title, link, type: 'policy', tag: 'end', ...meta });
    });

    return events;
  } catch (e) {
    console.error('policy fetch error:', e.message);
    return [];
  }
}

/* ── 법제처 법령 업데이트 ── */
async function fetchLawEvents(y, m, startDate, endDate) {
  try {
    const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_OC}&target=lsSearch&type=JSON&efYd=${startDate}&efYdEnd=${endDate}&display=100&page=1`;
    const r   = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];

    const data      = await r.json();
    const lawSearch = data.LawSearch || data;
    const rawLaws   = lawSearch?.laws?.law || [];
    // 결과 1개면 객체, 여러개면 배열로 옴
    const laws      = Array.isArray(rawLaws) ? rawLaws : (rawLaws ? [rawLaws] : []);

    // 재무·세무 관련 소관부처 필터
    const FINANCE_DEPTS = ['기획재정부', '금융위원회', '고용노동부', '중소벤처기업부', '금융감독원', '국세청'];

    const events = [];
    laws.forEach(law => {
      const title  = law['법령명한글'] || law.lsNm   || '';
      const efDate = law['시행일자']   || law.efYd   || '';
      const dept   = law['소관부처명'] || law.mnstNm || '';
      const lawId  = law['법령ID']     || law.lsId   || '';
      const link   = lawId
        ? `https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&lawId=${lawId}`
        : 'https://www.law.go.kr';

      if (!title || !efDate || efDate.length < 8) return;

      // 재무 관련 부처만 필터
      const isFinance = FINANCE_DEPTS.some(d => dept.includes(d));
      if (!isFinance) return;

      const eY = parseInt(efDate.slice(0, 4));
      const eM = parseInt(efDate.slice(4, 6));
      const eD = parseInt(efDate.slice(6, 8));
      if (eY !== y || eM !== m) return;

      events.push({ day: eD, title, link, type: 'update', tag: 'start', agency: dept, effDate: efDate });
    });

    return events;
  } catch (e) {
    console.error('law fetch error:', e.message);
    return [];
  }
}
