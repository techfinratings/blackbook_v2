/* ============================================================
   Calendar data layer — shared by home mini-calendar + /calendar
   Source 1 (live): /api/calendar → 기업마당 정책자금 + 법제처 법령
   Source 2 (statutory): fixed Korean tax/accounting filing dates
   Both are real; the live feed is authoritative, statutory dates
   fill the recurring 세무·회계 obligations the feed doesn't carry.
   ============================================================ */
(function (global) {
  'use strict';

  var CATS = {
    fund: { key: 'fund', label: '정책자금', color: '#2348D6', soft: '#EDF0FD' },
    tax:  { key: 'tax',  label: '세무',     color: '#C2611B', soft: '#FBF0E6' },
    acc:  { key: 'acc',  label: '회계',     color: '#1F8455', soft: '#E8F2EC' },
    law:  { key: 'law',  label: '법령',     color: '#6A3FC0', soft: '#F0EAFA' }
  };

  // Classify a 법제처 law-update title into tax / accounting / general law.
  function classifyLaw(title) {
    var t = title || '';
    if (/세법|부가가치세|소득세|법인세|원천|국세|지방세|관세|증여세|상속세|양도세|종합소득|세무|과세/.test(t)) return 'tax';
    if (/회계|결산|재무제표|외부감사|감사인|자본시장|공시/.test(t)) return 'acc';
    return 'law';
  }

  function normalizeLive(events) {
    if (!Array.isArray(events)) return [];
    return events.map(function (e) {
      var cat;
      if (e.type === 'policy') cat = 'fund';
      else cat = classifyLaw(e.title);
      var suffix = '';
      if (e.type === 'policy') suffix = e.tag === 'end' ? ' 신청 마감' : ' 접수 시작';
      return {
        day: e.day,
        title: (e.title || '') + suffix,
        rawTitle: e.title || '',
        link: e.link || null,
        cat: cat,
        source: 'live',
        kind: e.type,           // 'policy' | 'update'
        tag: e.tag || '',
        // 설명 페이지용 부가 정보
        id: e.id || '',
        summary: e.summary || '',
        agency: e.agency || '',
        target: e.target || '',
        field: e.field || '',
        apply: e.apply || '',
        period: e.period || '',
        effDate: e.effDate || ''
      };
    }).filter(function (e) { return e.day >= 1 && e.day <= 31 && e.title; });
  }

  // Real, recurring statutory deadlines (부처 고시 기준). Day-of-month based.
  // month is 1-12. Returns [{day,title,cat}] for that month.
  function statutory(year, month) {
    var lastDay = new Date(year, month, 0).getDate();
    var out = [];
    var push = function (day, title, cat) {
      out.push({ day: Math.min(day, lastDay), title: title, cat: cat, source: 'statutory',
                 link: 'https://www.nts.go.kr' });
    };

    // 매월 — 원천세(원천징수세액) 신고·납부: 지급월의 다음 달 10일
    push(10, '원천세 신고·납부', 'tax');
    // 매월 — 사업장현황/일용근로소득 지급명세서 제출 (말일)
    push(lastDay, '일용근로소득 지급명세서 제출', 'tax');

    // 분기 — 부가가치세 신고·납부 (1·4·7·10월 25일: 확정/예정)
    if ([1, 4, 7, 10].indexOf(month) >= 0) push(25, '부가가치세 신고·납부', 'tax');
    if ([3, 9].indexOf(month) >= 0) push(25, '부가가치세 예정고지 납부', 'tax');

    // 연간 주요 신고
    var annual = {
      3:  [[10, '연말정산 지급명세서 제출', 'tax'], [31, '법인세 신고·납부 (12월 결산)', 'acc']],
      4:  [[30, '법인 지방소득세 신고·납부', 'tax']],
      5:  [[31, '종합소득세 신고·납부', 'tax']],
      6:  [[30, '성실신고확인대상 종합소득세 신고', 'tax']],
      8:  [[31, '법인세 중간예납 신고·납부', 'tax']],
      11: [[30, '종합소득세 중간예납 납부', 'tax']],
      12: [[31, '4대보험 보수총액 신고 준비', 'acc']]
    };
    (annual[month] || []).forEach(function (a) { push(a[0], a[1], a[2]); });

    return out;
  }

  // Merge live + statutory, de-duplicate near-identical titles on same day.
  function merge(live, stat) {
    var all = live.concat(stat);
    var seen = {};
    return all.filter(function (e) {
      var norm = (e.title || '').replace(/\s+/g, '').slice(0, 12);
      var key = e.day + ':' + e.cat + ':' + norm;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function (a, b) { return a.day - b.day; });
  }

  // Public: fetch merged, normalized events for a year/month.
  function load(year, month) {
    var url = '/api/calendar?year=' + year + '&month=' + month;
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : { events: [] }; })
      .catch(function () { return { events: [] }; })
      .then(function (data) {
        var live = normalizeLive(data && data.events);
        return merge(live, statutory(year, month));
      })
      .catch(function () {
        return merge([], statutory(year, month));
      });
  }

  global.BBCalendar = { CATS: CATS, load: load, statutory: statutory, classifyLaw: classifyLaw };
})(window);
