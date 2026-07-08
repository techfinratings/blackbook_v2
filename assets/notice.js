/* ============================================================
   공고 설명(요약) 오버레이 — 공용 모듈 (BBNotice)
   기업마당/법제처 공고를 기업마당으로 바로 보내지 않고, 먼저
   요약 설명 페이지를 띄우고 그 안에서 원문으로 넘어가게 합니다.
   window.BBNotice.open(event, year, month) 로 호출.
   ============================================================ */
(function (global) {
  'use strict';

  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var injected = false, overlay = null, bodyEl = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtEff(s) { s = String(s || ''); return s.length >= 8 ? s.slice(0, 4) + '.' + s.slice(4, 6) + '.' + s.slice(6, 8) : s; }

  // 기업마당 요약(HTML) → 정리된 텍스트
  function htmlToText(html) {
    return String(html || '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function CATS() { return (global.BBCalendar && global.BBCalendar.CATS) || {}; }

  function ensure() {
    if (injected) return;
    injected = true;
    var style = document.createElement('style');
    style.textContent =
      '.notice-overlay{position:fixed;inset:0;z-index:9997;background:var(--paper-1);overflow-y:auto;display:none;}' +
      '.notice-overlay.open{display:block;}' +
      '.notice-meta{display:grid;grid-template-columns:104px 1fr;gap:12px 18px;margin:24px 0;padding:22px 0;border-top:1px solid var(--rule-hair);border-bottom:1px solid var(--rule-hair);}' +
      '.notice-meta dt{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);letter-spacing:.04em;}' +
      '.notice-meta dd{margin:0;font-size:14.5px;color:var(--ink-1);line-height:1.6;}' +
      '.notice-summary{font-size:15.5px;line-height:1.85;color:#2C313A;white-space:pre-line;}';
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'notice-overlay';
    overlay.innerHTML =
      '<div class="fore-edge"></div><div class="page">' +
      '<div class="gnb" style="position:static;"><div class="wrap gnb-inner">' +
      '<a href="/"><img class="gnb-logo" src="/assets/logo_white.png" alt="BLACK BOOK"></a>' +
      '<nav class="gnb-nav"><a href="/">홈</a><a href="/content">콘텐츠</a><span class="has-sub"><a class="hb-toggle">실무 핸드북<i>▾</i></a><span class="gnb-sub"><a href="/guide">실무 노트</a><a href="/community/talk">실무 이야기</a></span></span><a href="/archive">실무자료 아카이브</a><a href="/calendar" class="active">캘린더</a><a href="/finder">파인더</a></nav>' +
      '<span class="gnb-login">로그인</span><span class="gnb-join">회원가입</span></div></div>' +
      '<div class="wrap" style="max-width:800px;padding-top:32px;padding-bottom:72px;" data-notice-body></div></div>';
    document.body.appendChild(overlay);
    bodyEl = overlay.querySelector('[data-notice-body]');

    overlay.addEventListener('click', function (e) { if (e.target.closest('[data-notice-back]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close(); });
  }

  function open(e, year, month) {
    if (!e) return;
    ensure();
    var cats = CATS();
    var cat = cats[e.cat] || { color: '#181B1E', soft: '#EEF0F2', label: e.cat || '일정' };
    var dow = WD[new Date(year, month - 1, e.day).getDay()];
    var dateStr = year + '.' + pad(month) + '.' + pad(e.day) + ' (' + dow + ')';
    var kindLabel = e.kind === 'policy' ? '정책자금 공고' : (e.kind === 'update' ? '법령 개정' : '세무 법정기한');
    var tagLabel = e.kind === 'policy' ? (e.tag === 'end' ? '신청 마감일' : '접수 시작일') : (e.kind === 'update' ? '시행일' : '신고·납부 기한');

    var rows = '';
    var addRow = function (k, v) { if (v) rows += '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>'; };
    addRow('구분', kindLabel);
    addRow(tagLabel, dateStr);
    if (e.kind === 'policy') { addRow('소관기관', e.agency); addRow('지원대상', e.target); addRow('지원분야', e.field); addRow('신청기간', e.period); }
    else if (e.kind === 'update') { addRow('소관부처', e.agency); addRow('시행일자', fmtEff(e.effDate)); }
    else { addRow('관할', '국세청 · 홈택스'); }

    var summary;
    if (e.kind === 'policy' && e.summary) {
      summary = '<div class="notice-summary">' + esc(htmlToText(e.summary)) + '</div>';
      var applyText = htmlToText(e.apply);
      if (applyText) summary += '<div style="margin-top:22px;"><div class="mono" style="font-size:11px;color:#7E868F;margin-bottom:6px;">신청 방법</div><div style="font-size:14px;line-height:1.7;color:#2C313A;white-space:pre-line;">' + esc(applyText) + '</div></div>';
    } else if (e.kind === 'policy') {
      summary = '<div class="notice-summary">기업마당에 공고된 정책자금 사업입니다. 상세 자격요건·제출서류는 아래 원문에서 확인하세요.</div>';
    } else if (e.kind === 'update') {
      summary = '<div class="notice-summary">법제처에 고시된 재무·세무 관련 개정 법령입니다. 시행일 기준으로 실무에 반영되며, 상세 조문은 아래 법제처 원문에서 확인하세요.</div>';
    } else {
      summary = '<div class="notice-summary">국세청이 정한 법정 신고·납부 기한입니다. 기한을 넘기면 가산세가 발생할 수 있으니 홈택스에서 대상 여부와 서식을 확인하세요.</div>';
    }

    var linkLabel = e.kind === 'policy' ? '기업마당 원문 보기' : (e.kind === 'update' ? '법제처에서 보기' : '홈택스에서 보기');
    var linkBtn = e.link ? '<div><a href="' + esc(e.link) + '" target="_blank" rel="noopener" class="btn-blue" style="display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:12px 22px;border-radius:3px;margin-top:28px;">' + linkLabel + ' <span style="font-size:15px;">↗</span></a></div>' : '';

    bodyEl.innerHTML =
      '<button data-notice-back style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink-3);background:none;border:0;cursor:pointer;padding:0;">← 돌아가기</button>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-top:22px;">' +
        '<span style="color:' + cat.color + ';background:' + cat.soft + ';font-size:11px;font-weight:700;padding:5px 11px;border-radius:6px;">' + esc(cat.label) + '</span>' +
        '<span class="mono" style="font-size:11px;color:#7E868F;">' + dateStr + '</span></div>' +
      '<h1 class="bt" style="font-size:30px;line-height:1.4;font-weight:700;margin:14px 0 0;">' + esc(e.rawTitle || e.title) + '</h1>' +
      '<dl class="notice-meta">' + rows + '</dl>' +
      summary + linkBtn +
      '<p class="mono" style="font-size:10px;color:var(--ink-4);margin-top:30px;line-height:1.6;">* 본 요약은 공공 API(기업마당·법제처) 데이터를 바탕으로 정리한 참고용 정보입니다. 정확한 신청 자격·서류는 원문을 확인하세요.</p>';

    overlay.classList.add('open');
    overlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function close() { if (overlay) overlay.classList.remove('open'); document.body.style.overflow = ''; }
  function isOpen() { return !!(overlay && overlay.classList.contains('open')); }

  global.BBNotice = { open: open, close: close, isOpen: isOpen };
})(window);
