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

  // 파일형태 → 대표 그룹(필터·라벨). 확장자 흩어짐을 실무자 언어로 묶음.
  //   엑셀서식/PPT서식 등 "형태로 찾는" 습관(경리코리아 벤치마킹)을 지원.
  var TYPE_GROUP = {
    XLS: '엑셀', XLSX: '엑셀', CSV: '엑셀',
    PPT: 'PPT', PPTX: 'PPT',
    PDF: 'PDF',
    HWP: '한글', HWPX: '한글',
    DOC: '워드', DOCX: '워드',
    ZIP: '기타', MD: '기타', TXT: '기타'
  };
  // 그룹 노출 순서(필터 칩 정렬용)
  var TYPE_ORDER = ['엑셀', 'PPT', '한글', 'PDF', '워드', '기타'];

  function typeColor(t) { return FILE_COL[String(t || '').toLowerCase()] || '#49505A'; }
  function catColor(c) { return CAT_COL[String(c || '').trim()] || '#181B1E'; }
  function typeGroup(t) { return TYPE_GROUP[String(t || '').toUpperCase()] || '기타'; }

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

  function fetchArchive() {
    return fetch('/api/archive')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { return parse(d && d.values); })
      .catch(function () { return []; });
  }
  // load(onData): 캐시 즉시 렌더 + 백그라운드 갱신. onData 없으면 기존처럼 Promise 반환.
  function load(onData) {
    if (onData && global.bbSWR) return global.bbSWR.swr('bb_archive_v1', fetchArchive, onData);
    return fetchArchive().then(function (d) { if (onData) onData(d); return d; });
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
    typeColor: typeColor, catColor: catColor, dateKey: dateKey,
    typeGroup: typeGroup, TYPE_ORDER: TYPE_ORDER
  };
})(window);
