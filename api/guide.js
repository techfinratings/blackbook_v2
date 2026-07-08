/* ============================================================
   세금 신고 안내 가이드 — 서버 렌더(SSR) + SEO
   /guide            → 허브(5개 주제 목록)
   /guide/:slug      → 상세(안내 + 신고기한 + FAQ)
   각 상세는 Article·FAQPage·BreadcrumbList JSON-LD를 실어 검색
   노출을 강화하고, 신고기한은 /calendar 의 실제 일정과 연결한다.
   ============================================================ */
const { GUIDES, bySlug } = require('../lib/guides');
const SITE_NAME = 'BLACK BOOK';
const PUBLISHER = '크레디뷰';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// 본문 조각은 신뢰된 상수(lib/guides.js)라 <b> 등 인라인 태그를 허용.
function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function clamp(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

var CAT_COLOR = { '세무': '#C2611B', '회계': '#1F8455' };
function catColor(c) { return CAT_COLOR[c] || '#181B1E'; }

function head(title, desc, canonical, jsonld) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${SITE_NAME}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="stylesheet" href="/assets/styles.css">
${jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<style>
  .read{max-width:820px;margin:0 auto;padding:0 24px;}
  .gbody{font-size:16.5px;line-height:1.85;color:#2C313A;}
  .gbody h2{font-family:var(--font-display);font-size:24px;font-weight:700;line-height:1.4;margin:40px 0 14px;}
  .gbody p{margin:0 0 18px;} .gbody b{color:var(--ink-1);font-weight:700;}
  .gbody ul{padding-left:20px;margin:0 0 20px;} .gbody li{margin:0 0 10px;line-height:1.7;}
  .dl-table{width:100%;border-collapse:collapse;margin:6px 0 4px;}
  .dl-table td{padding:13px 4px;border-bottom:1px solid var(--rule-hair);vertical-align:top;}
  .dl-when{white-space:nowrap;width:120px;font-weight:700;color:var(--blue);font-family:var(--font-mono);font-size:13.5px;}
  .dl-what{font-size:14.5px;color:var(--ink-1);}
  .faq-q{font-weight:700;font-size:16px;color:var(--ink-1);margin:22px 0 8px;}
  .faq-a{font-size:15px;color:var(--ink-2);line-height:1.75;margin:0;}
  .gcard{display:block;border:1px solid var(--rule-hair);background:#fff;border-radius:12px;padding:22px 22px 20px;box-shadow:var(--shadow-card);transition:border-color .15s;}
  .gcard:hover{border-color:var(--ink-3);}
  .grid-guides{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
  @media (max-width:720px){.grid-guides{grid-template-columns:1fr;}}
  .callout{border:1px solid var(--rule-hair);border-left:3px solid var(--blue);background:var(--blue-soft);border-radius:8px;padding:18px 20px;margin:32px 0;}
</style>
</head>
<body>
<div class="grain"></div>
<div class="fore-edge"></div>
<div class="page">
  <header class="gnb"><div class="wrap gnb-inner">
    <a href="/"><img class="gnb-logo" src="/assets/logo_white.png" alt="BLACK BOOK"></a>
    <nav class="gnb-nav"><a href="/">홈</a><a href="/content">콘텐츠</a><a href="/guide" class="active">세금가이드</a><a href="/community/talk">실무 이야기</a><a href="/archive">자료실</a><a href="/calendar">캘린더</a><a href="/finder">파인더</a></nav>
    <span class="gnb-login">로그인</span><span class="gnb-join">회원가입</span>
  </div></header>`;
}

const FOOT = `
  <footer class="footer"><div class="wrap" style="padding:40px 40px 32px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;"><img src="/assets/logo_white.png" style="height:20px;" alt="BLACK BOOK"><div class="mono" style="font-size:10.5px;color:#6A7079;">© 2025 BLACK BOOK · 크레디뷰</div></div></footer>
</div>
</body>
</html>`;

/* ── 허브 ── */
function renderHub(base) {
  const canonical = base + '/guide';
  const desc = '원천징수·부가가치세·법인세·종합소득세·연말정산 — 세무·회계 실무자가 챙겨야 할 세금 신고를 누가·언제·무엇을 기준으로 정리했습니다.';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '세금 신고 안내', description: desc, url: canonical,
    publisher: { '@type': 'Organization', name: PUBLISHER }
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: base + '/' },
      { '@type': 'ListItem', position: 2, name: '세금가이드', item: canonical }
    ]
  }];
  const cards = GUIDES.map(g => `
    <a class="gcard" href="/guide/${esc(g.slug)}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span class="mono" style="font-size:10px;color:var(--ink-3);">GUIDE ${esc(g.no)}</span>
        <span class="mono" style="font-size:10px;font-weight:600;color:${catColor(g.cat)};">${esc(g.cat)}</span>
      </div>
      <div class="bt" style="font-size:20px;font-weight:700;line-height:1.35;">${esc(g.title)}</div>
      <p style="font-size:13.5px;color:var(--ink-2);line-height:1.6;margin:9px 0 14px;">${esc(clamp(g.lead, 90))}</p>
      <div class="mono" style="font-size:11px;color:var(--blue);font-weight:600;">안내 보기 →</div>
    </a>`).join('');

  return head('세금 신고 안내', desc, canonical, ld) + `
  <div class="wrap" style="max-width:960px;padding-top:44px;">
    <div class="eyebrow">INDEX 06 — 세금 신고 안내</div>
    <h1 class="page-title" style="font-size:38px;margin-top:12px;">세금 신고, 언제 무엇을 하나</h1>
    <p class="page-intro" style="max-width:620px;margin:10px 0 0;">주기마다 돌아오는 세금 신고를 주제별로 정리했습니다. 각 안내에는 <b>실제 신고기한</b>이 함께 있어, 오늘 챙길 일을 바로 확인할 수 있습니다.</p>
    <div class="grid-guides" style="margin:34px 0 20px;">${cards}</div>
    <div class="callout" style="margin:12px 0 64px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div><div style="font-weight:700;font-size:15px;">이번 달 신고 일정이 궁금하다면</div><div style="font-size:13px;color:var(--ink-2);margin-top:3px;">세무·회계·정책자금 일정을 한눈에.</div></div>
      <a href="/calendar" class="btn-blue" style="padding:11px 20px;font-size:13px;white-space:nowrap;">캘린더 보기 →</a>
    </div>
  </div>` + FOOT;
}

/* ── 상세 ── */
function renderDetail(g, base) {
  const canonical = base + '/guide/' + g.slug;
  const desc = clamp(g.lead, 155);
  const bodyBlocks = g.sections.map(s => {
    let inner = '';
    if (s.p) inner += s.p.map(x => `<p>${x}</p>`).join('');
    if (s.ul) inner += '<ul>' + s.ul.map(x => `<li>${x}</li>`).join('') + '</ul>';
    return `<h2>${esc(s.h)}</h2>${inner}`;
  }).join('');

  const dlRows = g.deadlines.map(d =>
    `<tr><td class="dl-when">${esc(d.when)}</td><td class="dl-what">${esc(d.what)}</td></tr>`).join('');

  const faqBlocks = g.faq.map(f =>
    `<div class="faq-q">Q. ${esc(f.q)}</div><p class="faq-a">${esc(f.a)}</p>`).join('');

  // 다른 가이드 내부 링크(SEO)
  const others = GUIDES.filter(x => x.slug !== g.slug).map(x =>
    `<a href="/guide/${esc(x.slug)}" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink-2);border:1px solid #D8DCE0;border-radius:3px;padding:8px 13px;">${esc(x.title.replace(/\s*(신고 )?안내$/, ''))}</a>`
  ).join('');

  const ld = [{
    '@context': 'https://schema.org', '@type': 'Article',
    headline: g.title, description: desc, url: canonical,
    inLanguage: 'ko', keywords: (g.keywords || []).join(', '),
    author: { '@type': 'Organization', name: '크레디뷰 리서치' },
    publisher: { '@type': 'Organization', name: PUBLISHER },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: g.faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: base + '/' },
      { '@type': 'ListItem', position: 2, name: '세금가이드', item: base + '/guide' },
      { '@type': 'ListItem', position: 3, name: g.title, item: canonical }
    ]
  }];

  return head(g.title, desc, canonical, ld) + `
  <article class="read" style="padding-top:44px;padding-bottom:64px;">
    <a href="/guide" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink-3);">← 세금 신고 안내</a>
    <div style="display:flex;align-items:center;gap:10px;margin-top:22px;flex-wrap:wrap;">
      <span class="mono" style="font-size:10px;color:var(--ink-3);">GUIDE ${esc(g.no)}</span>
      <span class="mono" style="font-size:10px;font-weight:600;color:${catColor(g.cat)};border:1px solid ${catColor(g.cat)};border-radius:3px;padding:3px 8px;">${esc(g.cat)}</span>
    </div>
    <h1 class="bt" style="font-size:38px;line-height:1.3;font-weight:700;letter-spacing:-.01em;margin:12px 0 0;">${esc(g.title)}</h1>
    <p style="font-size:18px;color:var(--ink-2);line-height:1.6;margin:16px 0 0;">${esc(g.lead)}</p>
    <div style="margin-top:20px;padding:14px 16px;background:var(--paper-2);border-radius:8px;font-size:13.5px;color:var(--ink-2);"><b style="color:var(--ink-1);">누가</b> · ${esc(g.who)}</div>

    <div class="gbody" style="margin-top:8px;">${bodyBlocks}</div>

    <h2 class="bt" style="font-size:24px;font-weight:700;margin:40px 0 6px;">신고기한</h2>
    <table class="dl-table"><tbody>${dlRows}</tbody></table>
    <div class="callout" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div><div style="font-weight:700;font-size:15px;">이 일정, 캘린더에서 확인하세요</div><div style="font-size:13px;color:var(--ink-2);margin-top:3px;">이번 달 세무·회계 신고 일정을 한눈에.</div></div>
      <a href="/calendar" class="btn-blue" style="padding:11px 20px;font-size:13px;white-space:nowrap;">캘린더 보기 →</a>
    </div>

    <h2 class="bt" style="font-size:24px;font-weight:700;margin:38px 0 8px;">자주 묻는 질문</h2>
    ${faqBlocks}

    <div style="margin-top:40px;padding-top:26px;border-top:1px solid var(--rule-hair);">
      <div class="mono" style="font-size:10px;letter-spacing:.08em;color:var(--ink-3);margin-bottom:12px;">다른 세금 안내</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${others}</div>
    </div>

    <div class="side-cta" style="margin-top:34px;border-radius:12px;">
      <div class="bt" style="font-size:17px;font-weight:700;line-height:1.5;">관련 서식이 필요하신가요?</div>
      <p style="font-size:12.5px;color:var(--ink-4);line-height:1.65;margin:8px 0 16px;">신고에 바로 쓰는 엑셀·서식 자료를 자료실에서 받아보세요.</p>
      <a href="/archive" class="btn" style="display:inline-block;padding:11px 22px;">자료실 가기 →</a>
    </div>
  </article>` + FOOT;
}

module.exports = async (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'blackbook-red.vercel.app';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const base = `${proto}://${host}`;

  let slug = (req.query && req.query.slug) || '';
  if (!slug) { const m = (req.url || '').split('?')[0].match(/\/guide\/([^/]+)/); if (m) slug = decodeURIComponent(m[1]); }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  if (!slug) { res.statusCode = 200; return res.end(renderHub(base)); }
  const g = bySlug(slug);
  if (!g) {
    res.statusCode = 404;
    return res.end(head('찾을 수 없는 안내', '', base + '/guide', [])
      + `<div class="wrap" style="padding:100px 40px;text-align:center;"><div class="bt" style="font-size:30px;font-weight:700;">찾을 수 없는 안내입니다</div><p style="margin-top:12px;color:var(--ink-3);"><a href="/guide" style="color:var(--blue);">세금 신고 안내</a>로 돌아가세요.</p></div>` + FOOT);
  }
  res.statusCode = 200;
  return res.end(renderDetail(g, base));
};

module.exports._internal = { renderHub, renderDetail, esc };
