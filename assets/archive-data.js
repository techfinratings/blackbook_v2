/* ============================================================
   자료실 데이터 레이어 — /api/archive (Google Sheets 프록시)
   시트 컬럼: A 파일명 · B 설명 · C 카테고리 · D 파일형태
             E 사전준비 · F 관련링크 · G 다운로드링크(drive)
             H 날짜(yyyy.mm) · I 다운로드수
   자료실 페이지와 홈 자료실 모듈이 공유합니다.
   ============================================================ */
(function (global) {
  'use strict';

  // 파일형태 → 칩 색 (design_system file-type chips)
  var FILE_COL = {
    xls: '#1F8455', xlsx: '#1F8455', csv: '#1F8455',
    ppt: '#C2611B', pptx: '#C2611B',
    pdf: '#B4322B', hwp: '#6A3FC0', hwpx: '#6A3FC0',
    doc: '#2348D6', docx: '#2348D6',
    md: '#49505A', txt: '#49505A', zip: '#49505A'
  };
  // 카테고리 → 색 (알려진 분류만; 그 외 잉크)
  var CAT_COL = {
    '세무': '#C2611B', '회계': '#1F8455', '법령': '#6A3FC0', '실무': '#2348D6',
    '경영': '#181B1E', '재무': '#2348D6', '정책자금': '#2348D6'
  };

  function typeColor(t) { return FILE_COL[String(t || '').toLowerCase()] || '#49505A'; }
  function catColor(c) { return CAT_COL[String(c || '').trim()] || '#181B1E'; }

  // yyyy.mm → 정렬용 정수(202605). 파싱 실패 시 0.
  function dateKey(s) {
    var m = String(s || '').match(/(\d{4})[.\-/](\d{1,2})/);
    return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : 0;
  }

  function parse(values) {
    if (!Array.isArray(values)) return [];
    return values.map(function (r, i) {
      return {
        row: i + 2,                    // 시트 실제 행 번호(데이터는 2행부터)
        name: (r[0] || '').trim(),
        desc: (r[1] || '').trim(),
        cat: (r[2] || '').trim(),
        type: (r[3] || '').trim().toUpperCase(),
        prep: (r[4] || '').trim(),
        related: (r[5] || '').trim(),
        link: (r[6] || '').trim(),
        date: (r[7] || '').trim(),
        dl: parseInt(r[8] || '0', 10) || 0,
        _dk: dateKey(r[7])
      };
    }).filter(function (f) { return f.name; });
  }

  function load() {
    return fetch('/api/archive')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { return parse(d && d.values); })
      .catch(function () { return []; });
  }

  // 다운로드: drive 링크 열고, 카운트 증가는 fire-and-forget.
  function download(file) {
    if (file && file.link) window.open(file.link, '_blank', 'noopener');
    if (file && file.row) {
      fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: file.row })
      }).catch(function () {});
    }
  }

  global.BBArchive = {
    load: load, parse: parse, download: download,
    typeColor: typeColor, catColor: catColor, dateKey: dateKey
  };
})(window);
