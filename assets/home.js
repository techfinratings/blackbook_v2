/* Homepage interactions: content tabs · Q&A carousel · live 일정 module */
(function () {
  'use strict';

  var CAT_COLOR = { '세무': '#C2611B', '회계': '#1F8455', '법령': '#6A3FC0', '실무': '#2348D6', '경영': '#181B1E' };

  var QA = {
    hot: [
      { cat: '세무', ans: 4, t: '15분 전', q: '관계회사 대여금, 업무무관 가지급금으로 보는 기준이 어디까지인가요?' },
      { cat: '실무', ans: 2, t: '1시간 전', q: '거래처 신용등급이 두 단계 떨어졌는데 여신 한도 어떻게 조정하세요?' },
      { cat: '세무', ans: 7, t: '3시간 전', q: '가업승계 증여세 특례, 사후관리 요건 실무 경험 있으신 분?' },
      { cat: '회계', ans: 5, t: '5시간 전', q: '리스 회계처리, 사용권자산 감가 기준 다들 어떻게 잡으세요?' }
    ],
    new: [
      { cat: '회계', ans: 1, t: '2분 전', q: '사용권자산 상각, 리스기간과 내용연수가 다를 때 기준은?' },
      { cat: '법령', ans: 0, t: '12분 전', q: '중대재해처벌법 적용 사업장, 재무팀이 챙길 항목이 있을까요?' },
      { cat: '실무', ans: 3, t: '40분 전', q: '결산 마감 일정 관리, 부서별 체크리스트 템플릿 공유 가능?' },
      { cat: '세무', ans: 2, t: '1시간 전', q: '외화환산손익 인식 시점, 결산일 기준 환율 적용이 맞나요?' }
    ]
  };

  /* ---------- content segmented tabs ---------- */
  function initContentTabs() {
    var seg = document.getElementById('contentSeg');
    if (!seg) return;
    seg.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-seg]');
      if (!btn) return;
      var key = btn.getAttribute('data-seg');
      seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === btn); });
      document.querySelectorAll('[data-view]').forEach(function (v) {
        v.style.display = v.getAttribute('data-view') === key ? '' : 'none';
      });
    });
  }

  /* ---------- Q&A carousel ---------- */
  function initQA() {
    var track = document.querySelector('[data-qtrack]');
    var dotsWrap = document.querySelector('[data-qdots]');
    var recent = document.querySelector('[data-qrecent]');
    var modes = document.querySelector('[data-qmodes]');
    if (!track) return;

    var mode = 'hot', idx = 0, timer;

    function render() {
      var list = QA[mode];
      track.innerHTML = list.map(function (q) {
        var col = CAT_COLOR[q.cat] || '#2348D6';
        return '<div class="q-slide">' +
          '<div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;">' +
          '<span class="mono" style="font-size:10px;letter-spacing:.05em;color:' + col + ';">' + q.cat + '</span>' +
          '<span class="mono" style="font-size:10px;color:#7E868F;">' + q.t + '</span></div>' +
          '<div class="bt" style="font-size:17px;font-weight:700;line-height:1.5;min-height:78px;">' + q.q + '</div>' +
          '<div class="mono" style="margin-top:6px;font-size:11px;color:#2348D6;font-weight:500;">답변 ' + q.ans + '</div></div>';
      }).join('');
      dotsWrap.innerHTML = list.map(function (_, i) {
        return '<span data-i="' + i + '"' + (i === idx ? ' class="on"' : '') + '></span>';
      }).join('');
      if (recent) {
        recent.innerHTML = list.map(function (q) {
          var col = CAT_COLOR[q.cat] || '#2348D6';
          return '<a href="/community/talk" style="display:flex;gap:9px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #E1E4E8;cursor:pointer;">' +
            '<span class="mono" style="font-size:9.5px;color:' + col + ';flex-shrink:0;margin-top:3px;">' + q.cat + '</span>' +
            '<div style="min-width:0;"><div style="font-size:13.5px;font-weight:600;line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + q.q + '</div>' +
            '<span class="mono" style="font-size:10px;color:#7E868F;">답변 ' + q.ans + ' · ' + q.t + '</span></div></a>';
        }).join('');
      }
      move();
    }
    function move() { track.style.transform = 'translateX(' + (-idx * 100) + '%)'; }
    function go(i) { idx = (i + QA[mode].length) % QA[mode].length; render(); }

    dotsWrap.addEventListener('click', function (e) {
      var s = e.target.closest('[data-i]'); if (!s) return;
      go(parseInt(s.getAttribute('data-i'), 10)); reset();
    });
    if (modes) modes.addEventListener('click', function (e) {
      var b = e.target.closest('[data-qmode]'); if (!b) return;
      mode = b.getAttribute('data-qmode'); idx = 0;
      modes.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      render(); reset();
    });
    function reset() { clearInterval(timer); timer = setInterval(function () { go(idx + 1); }, 4200); }

    render(); reset();
  }

  /* ---------- live 일정 module (mini calendar + list) ---------- */
  function initSchedule() {
    var root = document.querySelector('[data-schedule]');
    if (!root || !window.BBCalendar) return;

    var now = new Date();
    var year = now.getFullYear(), month = now.getMonth() + 1, todayD = now.getDate();
    var CATS = window.BBCalendar.CATS;
    var off = {};

    var monthEl = root.querySelector('[data-cal-month]');
    var chipsEl = root.querySelector('[data-cal-chips]');
    var gridEl = root.querySelector('[data-cal-grid]');
    var eventsEl = root.querySelector('[data-cal-events]');
    var headEl = root.querySelector('[data-cal-events-head]');
    var resetEl = root.querySelector('[data-cal-events-reset]');
    monthEl.textContent = year + '. ' + month;

    var events = [];
    var selDay = null;   // 선택한 날짜(null=이달 전체)
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

    function counts() {
      var c = { fund: 0, tax: 0, acc: 0, law: 0 };
      events.forEach(function (e) { if (c[e.cat] != null) c[e.cat]++; });
      return c;
    }
    function renderChips() {
      var c = counts();
      chipsEl.innerHTML = ['fund', 'tax', 'acc', 'law'].map(function (k) {
        var cat = CATS[k], on = !off[k];
        return '<button class="chip' + (on ? '' : ' off') + '" data-cat="' + k + '">' +
          '<i style="background:' + (on ? cat.color : '#E1E4E8') + ';"></i>' + cat.label +
          '<span class="mono" style="margin-left:2px;opacity:.7;">' + c[k] + '</span></button>';
      }).join('');
    }
    function visible() { return events.filter(function (e) { return !off[e.cat]; }); }

    function renderGrid() {
      var firstDow = new Date(year, month - 1, 1).getDay();
      var lastDay = new Date(year, month, 0).getDate();
      var byDay = {};
      visible().forEach(function (e) { (byDay[e.day] = byDay[e.day] || []).push(CATS[e.cat].color); });

      var wd = ['일', '월', '화', '수', '목', '금', '토'];
      var html = wd.map(function (w) { return '<div class="mini-wd">' + w + '</div>'; }).join('');
      for (var i = 0; i < firstDow; i++) html += '<div class="mini-cell dim"></div>';
      for (var d = 1; d <= lastDay; d++) {
        var isToday = d === todayD;
        var isSel = d === selDay;
        var dots = (byDay[d] || []).slice(0, 3);
        var hasEv = dots.length > 0;
        var cls = 'mini-cell' + (isToday ? ' today' : (hasEv ? ' has' : ''));
        var selStyle = isSel && !isToday ? ' style="outline:1.5px solid var(--blue);outline-offset:-1px;"' : '';
        html += '<div class="' + cls + '"' + (hasEv ? ' data-day="' + d + '"' : '') + selStyle + '>' + d +
          '<div class="mini-dots">' + dots.map(function (c) {
            return '<i style="background:' + (isToday ? '#fff' : c) + ';"></i>';
          }).join('') + '</div></div>';
      }
      gridEl.innerHTML = html;
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function renderList() {
      var vis = visible().slice().sort(function (a, b) { return a.day - b.day; });
      var list;
      if (selDay != null) {
        list = vis.filter(function (e) { return e.day === selDay; });
        headEl.textContent = month + '월 ' + selDay + '일 일정';
        resetEl.style.display = '';
      } else {
        var upcoming = vis.filter(function (e) { return e.day >= todayD; });
        list = (upcoming.length ? upcoming : vis).slice(0, 4);
        headEl.textContent = '이달의 일정';
        resetEl.style.display = 'none';
      }
      if (!list.length) {
        eventsEl.innerHTML = '<div class="mono" style="font-size:12px;color:#7E868F;padding:8px 0;">' + (selDay != null ? '이 날은 등록된 공고가 없어요.' : '이달 등록된 일정이 없습니다.') + '</div>';
        return;
      }
      eventsEl.innerHTML = list.map(function (e) {
        var cat = CATS[e.cat];
        return '<div class="ev-row" data-ev="' + e._idx + '" style="cursor:pointer;">' +
          '<span class="mono" style="font-size:11px;font-weight:600;color:#181B1E;width:40px;flex-shrink:0;">' + pad(month) + '.' + pad(e.day) + '</span>' +
          '<span style="width:7px;height:7px;border-radius:50%;background:' + cat.color + ';margin-top:5px;flex-shrink:0;"></span>' +
          '<div style="min-width:0;"><div style="font-size:13.5px;font-weight:600;line-height:1.4;">' + esc(e.title) + '</div>' +
          '<span class="mono" style="font-size:10px;color:#7E868F;">' + cat.label + '</span></div></div>';
      }).join('');
    }
    function renderAll() { renderChips(); renderGrid(); renderList(); }

    chipsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      var k = b.getAttribute('data-cat'); off[k] = !off[k];
      if (selDay != null && !visible().some(function (x) { return x.day === selDay; })) selDay = null;
      renderAll();
    });
    // 미니 캘린더 날짜 클릭 → 하단 일정을 그 날짜로 (동적)
    gridEl.addEventListener('click', function (e) {
      var c = e.target.closest('[data-day]'); if (!c) return;
      var d = parseInt(c.getAttribute('data-day'), 10);
      selDay = (selDay === d) ? null : d;
      renderGrid(); renderList();
    });
    // 일정(공고) 클릭 → 기업마당 직접 X, 설명 페이지 먼저
    eventsEl.addEventListener('click', function (e) {
      var r = e.target.closest('[data-ev]'); if (!r) return;
      var ev = events[parseInt(r.getAttribute('data-ev'), 10)];
      if (window.BBNotice) window.BBNotice.open(ev, year, month);
      else if (ev && ev.link) window.open(ev.link, '_blank', 'noopener');
    });
    if (resetEl) resetEl.addEventListener('click', function () { selDay = null; renderGrid(); renderList(); });

    // initial paint (grid skeleton) then live data
    renderAll();
    window.BBCalendar.load(year, month).then(function (evs) {
      events = evs;
      events.forEach(function (e, i) { e._idx = i; });
      renderAll();
    });
  }

  /* ---------- live 자료실 module (top recent files) ---------- */
  function initFiles() {
    var wrap = document.querySelector('[data-home-files]');
    if (!wrap || !window.BBArchive) return;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); };
    wrap.innerHTML = '<div class="mono" style="font-size:11.5px;color:#7E868F;padding:10px 0;">자료 불러오는 중…</div>';
    BBArchive.load().then(function (files) {
      if (!files.length) { wrap.innerHTML = ''; return; }
      var top = files.slice().sort(function (a, b) { return b._dk - a._dk || b.dl - a.dl; }).slice(0, 4);
      wrap.innerHTML = top.map(function (f) {
        return '<a class="file-row" href="/archive"><span class="file-chip mono" style="background:' + BBArchive.typeColor(f.type) + ';">' + esc(f.type || 'FILE') + '</span>' +
          '<span style="font-size:13.5px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(f.name) + '</span>' +
          '<span class="mono" style="font-size:11px;color:var(--ink-3);">' + esc(f.date || '') + '</span></a>';
      }).join('');
    });
  }

  /* ---------- 홈 콘텐츠 모듈: 인블로그 최신 글 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
  function initContentPosts() {
    var hero = document.getElementById('homeHero');
    var ledger = document.getElementById('homeLedger');
    if (!hero) return;
    fetch('/api/posts').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.posts || !d.posts.length) return;   // 실패 시 정적 샘플 유지
      var posts = d.posts;
      var top = posts[0];

      // 대표(최신) 인사이트 히어로
      hero.setAttribute('href', '/p/' + encodeURIComponent(top.slug || top.id));
      var cover = top.image
        ? '<div style="width:100%;aspect-ratio:16/8.5;border-radius:10px;overflow:hidden;background:var(--paper-2);"><img src="' + esc(top.image) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'
        : '<div style="width:100%;aspect-ratio:16/8.5;border-radius:10px;background:var(--blue);"></div>';
      hero.innerHTML = cover +
        '<span class="mono" style="font-size:10.5px;letter-spacing:.06em;color:var(--cat-tax);display:block;margin-top:14px;">최신 발행</span>' +
        '<h3 class="bt" style="font-size:22px;line-height:1.4;font-weight:700;margin:6px 0 0;color:var(--ink-1);">' + esc(top.title) + '</h3>' +
        (top.description ? '<p style="font-size:14px;color:var(--ink-2);margin:9px 0 0;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + esc(top.description) + '</p>' : '') +
        '<div class="mono" style="font-size:11px;color:var(--ink-3);margin-top:11px;">크레디뷰 리서치 · ' + esc(top.date || '') + '</div>';

      // 02·03 원장 리스트 = 다음 최신 글
      if (ledger) {
        var rest = posts.slice(1, 3);
        if (!rest.length) { ledger.innerHTML = ''; return; }
        ledger.innerHTML = rest.map(function (p, i) {
          return '<a class="ledger-row" href="/p/' + encodeURIComponent(p.slug || p.id) + '">' +
            '<span class="bt ledger-no">' + ('0' + (i + 2)) + '</span>' +
            '<div style="min-width:0;"><span class="mono" style="font-size:10px;letter-spacing:.06em;color:var(--ink-3);">' + esc(p.date || '') + '</span>' +
            '<h3 class="bt" style="font-size:17px;line-height:1.42;font-weight:700;margin:4px 0 0;">' + esc(p.title) + '</h3></div>' +
            '<span style="font-size:16px;color:#C2C9D0;align-self:center;">→</span></a>';
        }).join('');
      }
    }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    initContentTabs();
    initQA();
    initSchedule();
    initFiles();
    initContentPosts();
  });
})();
