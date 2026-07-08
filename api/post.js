/* ============================================================
   콘텐츠 상세 — 서버 렌더(SSR) + SEO
   크레디뷰 Inblog 포스트를 요청 시점에 가져와 완성된 HTML로 렌더.
   봇/크롤러가 <title>·메타·본문이 채워진 문서를 그대로 받도록 하여
   클라이언트 렌더 대비 SEO가 강합니다. (THE LEDGER 스타일 재사용)
   라우트: /p/:slug  또는  /content/detail?slug=
   ============================================================ */
const { fetchPublished } = require('../lib/inblog');
const BLOG_ID = '10195';
const SITE_NAME = 'BLACK BOOK';
const PUBLISHER = '크레디뷰';

/* ── 공통 유틸 ── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function clamp(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* ── Inblog fetch ── */
async function fetchJSON(url, key) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('Inblog ' + r.status);
  return r.json();
}

// 발행건만 반환(초안 상세 페이지 노출 방지)
function getPosts(key) { return fetchPublished(key); }

// 본문 후보 필드를 여러 이름으로 탐색(Inblog 응답 스키마 변동 대비).
const BODY_FIELDS = ['content_html', 'contentHtml', 'body_html', 'html', 'content', 'body', 'markdown'];
function pickBody(obj) {
  if (!obj) return '';
  for (const f of BODY_FIELDS) { if (obj[f] && String(obj[f]).trim()) return String(obj[f]); }
  return '';
}

async function getBody(post, key) {
  // 1) 단일 포스트 상세 엔드포인트 시도
  const tries = [
    `https://inblog.ai/api/v1/posts/${encodeURIComponent(post.id)}`,
    `https://inblog.ai/api/v1/posts/${encodeURIComponent(post.slug)}?blog_id=${BLOG_ID}`,
  ];
  for (const url of tries) {
    try {
      const d = await fetchJSON(url, key);
      const node = d.data?.attributes || d.data || d.attributes || d;
      const body = pickBody(node);
      if (body) return body;
    } catch (e) { /* 다음 후보 */ }
  }
  // 2) 목록 attributes에 본문이 실려 오는 경우
  return pickBody(post.attributes);
}

/* ── 아주 작은 Markdown → HTML 변환 (본문이 마크다운일 때만) ── */
function looksHtml(s) { return /<(p|div|h[1-6]|ul|ol|img|figure|br|blockquote|table)\b/i.test(s); }
function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  let html = '', inList = false, inCode = false;
  const inline = t => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/,'');
    if (/^```/.test(line)) { closeList(); inCode = !inCode; html += inCode ? '<pre><code>' : '</code></pre>'; continue; }
    if (inCode) { html += esc(raw) + '\n'; continue; }
    if (/^#{1,6}\s/.test(line)) { closeList(); const lv = line.match(/^#+/)[0].length; html += `<h${lv}>${inline(line.replace(/^#+\s/, ''))}</h${lv}>`; continue; }
    if (/^>\s?/.test(line)) { closeList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`; continue; }
    if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`; continue; }
    if (!line.trim()) { closeList(); continue; }
    closeList(); html += `<p>${inline(line)}</p>`;
  }
  closeList(); if (inCode) html += '</code></pre>';
  return html;
}

/* ── 전체 HTML 문서 렌더 ── */
function renderPage(post, bodyHtml, canonical) {
  const title = post.title || '콘텐츠';
  const desc = clamp(post.description || stripTags(bodyHtml) || '재무·회계 실무자를 위한 크레디뷰 아티클', 155);
  const img = post.image || '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: title, description: desc,
    datePublished: post.date || undefined, dateModified: post.date || undefined,
    image: img ? [img] : undefined,
    author: { '@type': 'Organization', name: '크레디뷰 리서치' },
    publisher: { '@type': 'Organization', name: PUBLISHER },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };
  const hero = img
    ? `<img src="${esc(img)}" alt="${esc(title)}" style="width:100%;border-radius:12px;margin:30px 0 36px;display:block;">`
    : `<div style="width:100%;aspect-ratio:16/8;border-radius:12px;background:var(--blue);margin:30px 0 36px;"></div>`;
  const body = bodyHtml || `<p>${esc(post.description || '본문을 준비 중입니다.')}</p>`;

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
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
${post.date ? `<meta property="article:published_time" content="${esc(post.date)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${img ? `<meta name="twitter:image" content="${esc(img)}">` : ''}
<link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  .read{max-width:760px;margin:0 auto;padding:0 24px;}
  .abody{font-size:17px;line-height:1.85;color:#2C313A;}
  .abody p{margin:0 0 22px;} .abody b,.abody strong{color:var(--ink-1);font-weight:700;}
  .abody h1,.abody h2{font-family:var(--font-display);font-weight:700;line-height:1.4;margin:38px 0 16px;}
  .abody h2{font-size:26px;} .abody h1{font-size:30px;} .abody h3{font-size:20px;font-weight:700;margin:28px 0 12px;}
  .abody img{max-width:100%;height:auto;border-radius:10px;margin:14px 0;display:block;}
  .abody a{color:var(--blue);text-decoration:underline;}
  .abody blockquote{font-family:var(--font-display);margin:34px 0;padding:4px 0 4px 24px;border-left:3px solid var(--blue);font-size:22px;line-height:1.55;font-weight:700;color:var(--ink-1);}
  .abody ul{padding-left:22px;margin:0 0 22px;} .abody li{margin:0 0 8px;line-height:1.7;}
  .abody pre{background:var(--paper-2);border-radius:8px;padding:16px;overflow-x:auto;font-family:var(--font-mono);font-size:13.5px;}
  .abody code{font-family:var(--font-mono);font-size:.9em;background:var(--paper-2);padding:2px 5px;border-radius:3px;}
</style>
</head>
<body>
<div class="grain"></div>
<div class="fore-edge"></div>
<div class="page">
  <header class="gnb"><div class="wrap gnb-inner">
    <a href="/"><img class="gnb-logo" src="/assets/logo_white.png" alt="BLACK BOOK"></a>
    <nav class="gnb-nav"><a href="/">홈</a><a href="/content" class="active">콘텐츠</a><a href="/community/talk">실무 이야기</a><a href="/archive">자료실</a><a href="/calendar">캘린더</a><a href="/finder">파인더</a></nav>
    <span class="gnb-login">로그인</span><span class="gnb-join">회원가입</span>
  </div></header>

  <article class="read" style="padding-top:46px;padding-bottom:64px;">
    <a href="/content" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink-3);">← 콘텐츠 · 아티클</a>
    <div style="display:flex;align-items:center;gap:11px;margin-top:24px;flex-wrap:wrap;">
      <span class="mono" style="font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--ink-1);border:1px solid var(--ink-1);border-radius:3px;padding:4px 9px;">아티클</span>
      <span class="mono" style="font-size:11.5px;letter-spacing:.06em;color:var(--ink-3);">크레디뷰 리서치</span>
    </div>
    <h1 class="bt" style="font-size:42px;line-height:1.28;font-weight:700;letter-spacing:-.01em;margin:12px 0 0;">${esc(title)}</h1>
    ${post.description ? `<p style="font-size:18px;color:var(--ink-2);line-height:1.6;margin:20px 0 0;">${esc(post.description)}</p>` : ''}
    <div style="display:flex;align-items:center;gap:14px;margin-top:26px;padding:18px 0;border-top:1px solid var(--rule-hair);border-bottom:1px solid var(--rule-hair);">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--blue-soft);color:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">CR</div>
      <div style="min-width:0;flex:1;"><div style="font-size:13.5px;font-weight:700;">크레디뷰 리서치</div><div class="mono" style="font-size:11.5px;color:var(--ink-3);margin-top:2px;">${esc(post.date || '')}</div></div>
    </div>
    ${hero}
    <div class="abody">${body}</div>
  </article>

  <footer class="footer"><div class="wrap" style="padding:40px 40px 32px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;"><img src="/assets/logo_white.png" style="height:20px;" alt="BLACK BOOK"><div class="mono" style="font-size:10.5px;color:#6A7079;">© 2025 BLACK BOOK · 크레디뷰</div></div></footer>
</div>
</body>
</html>`;
}

function errorPage(status, msg, canonical) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${status === 404 ? '찾을 수 없는 글' : '콘텐츠 오류'} — ${SITE_NAME}</title>
<meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/styles.css"></head>
<body><div class="fore-edge"></div><div class="page">
<header class="gnb"><div class="wrap gnb-inner"><a href="/"><img class="gnb-logo" src="/assets/logo_white.png" alt="BLACK BOOK"></a>
<nav class="gnb-nav"><a href="/">홈</a><a href="/content" class="active">콘텐츠</a><a href="/community/talk">실무 이야기</a><a href="/archive">자료실</a><a href="/calendar">캘린더</a><a href="/finder">파인더</a></nav></div></header>
<div class="wrap" style="padding:100px 40px;text-align:center;">
<div class="bt" style="font-size:34px;font-weight:700;">${esc(msg)}</div>
<p style="color:var(--ink-3);margin-top:12px;">잠시 후 다시 시도하거나 <a href="/content" style="color:var(--blue);">콘텐츠 목록</a>으로 돌아가세요.</p>
</div></div></body></html>`;
}

/* ── 핸들러 ── */
module.exports = async (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'blackbook-red.vercel.app';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  // slug: 쿼리 우선, 없으면 경로(/p/<slug> 또는 /content/detail)
  let slug = (req.query && req.query.slug) || '';
  if (!slug) { const m = (req.url || '').split('?')[0].match(/\/p\/([^/]+)/); if (m) slug = decodeURIComponent(m[1]); }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const key = process.env.INBLOG_API_KEY;
  if (!key) { res.statusCode = 500; return res.end(errorPage(500, '콘텐츠 API 설정이 필요합니다', '')); }

  try {
    const posts = await getPosts(key);
    if (!posts.length) { res.statusCode = 502; return res.end(errorPage(502, '콘텐츠를 불러오지 못했습니다', '')); }
    const post = (slug && posts.find(p => p.slug === slug)) || posts[0];
    const canonical = `${proto}://${host}/p/${encodeURIComponent(post.slug)}`;
    if (slug && !posts.find(p => p.slug === slug)) { res.statusCode = 404; return res.end(errorPage(404, '찾을 수 없는 글입니다', canonical)); }

    let bodyHtml = '';
    try {
      const raw = await getBody(post, key);
      if (raw) bodyHtml = looksHtml(raw) ? raw : mdToHtml(raw);
    } catch (e) { /* 본문 실패 시 설명만 렌더 */ }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.statusCode = 200;
    return res.end(renderPage(post, bodyHtml, canonical));
  } catch (e) {
    res.statusCode = 502;
    return res.end(errorPage(502, '콘텐츠를 불러오지 못했습니다', ''));
  }
};

// 테스트용 노출
module.exports._internal = { mdToHtml, renderPage, pickBody, looksHtml, esc };
