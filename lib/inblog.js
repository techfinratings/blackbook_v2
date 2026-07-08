/* ============================================================
   Inblog 포스트 로더 — 발행(published)건만 반환
   posts.js · post.js(SSR) · sitemap.js 공용.
   Inblog 응답 스키마가 정확히 공개돼 있지 않아, 초안(draft)을
   가리는 여러 신호를 방어적으로 검사합니다.
   ============================================================ */
const BLOG_ID = '10195';

function isFalse(v) { return v === false || String(v).toLowerCase() === 'false'; }

// 발행건 판별: 초안/비공개/예약(미래)건 제외
function isPublished(a) {
  if (!a) return false;

  // 1) 불리언 발행 플래그가 명시적으로 false면 제외
  if (isFalse(a.is_published) || isFalse(a.published) || isFalse(a.is_public) || isFalse(a.public) || isFalse(a.visible)) return false;

  // 2) 상태 문자열이 초안 계열이면 제외 (모르는 값은 배제하지 않음 → 과잉 필터 방지)
  var status = String(a.status || a.post_status || a.state || a.visibility || a.publish_status || a.publishStatus || '').toLowerCase();
  if (/draft|private|hidden|unlist|unpublish|pending|review|trash|delete|archiv|schedule|temp|reserve|예약|임시|비공개|숨김/.test(status)) return false;

  // 3) 삭제 표시
  if (a.deleted_at || a.deletedAt || a.trashed_at || a.trashedAt) return false;

  // 4) 발행일 필수 + 미래(예약) 발행 제외
  var pub = a.published_at || a.publishedAt || a.published_date || a.publishedDate;
  if (!pub) return false;
  var t = Date.parse(pub);
  if (!isNaN(t) && t > Date.now() + 60000) return false;

  return true;
}

async function fetchList(key, perPage, page) {
  let url = `https://inblog.ai/api/v1/posts?blog_id=${BLOG_ID}&per_page=${perPage || 100}&sort=published_at`;
  if (page) url += `&page=${page}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('Inblog ' + r.status);
  return r.json();
}

// 전량 수집 — 페이지를 넘겨가며 모든 글을 모은다.
//  · page 파라미터가 무시되면 2페이지가 1페이지와 동일 → 신규 0건이라 즉시 종료(회귀 없음)
//  · id로 중복 제거, 최대 maxPages로 무한루프 방지
async function fetchAll(key, perPage, maxPages) {
  perPage = perPage || 100; maxPages = maxPages || 20;
  const all = [], seen = {};
  for (let page = 1; page <= maxPages; page++) {
    let data;
    try { data = await fetchList(key, perPage, page); }
    catch (e) { if (page === 1) throw e; break; }
    const arr = (data && data.data) || [];
    if (!arr.length) break;
    let added = 0;
    for (const p of arr) { if (!seen[p.id]) { seen[p.id] = 1; all.push(p); added++; } }
    if (added === 0) break;          // page 무시됨(동일 응답) 또는 새 글 없음 → 종료
    if (arr.length < perPage) break; // 마지막 페이지
  }
  return all;
}

/* ── 인블로그 SEO 필드 방어적 추출 ──
   flat(seo_title …) · 중첩 컴포넌트(seo.metaTitle …) · 태그 관계 등
   여러 스키마를 훑어, 인블로그에서 설정한 SEO를 그대로 옮긴다.
   canonical은 BLACK BOOK을 대표로 두므로(사용자 선택 A) 가져오지 않는다. */
function mediaUrl(m) {
  if (!m) return '';
  if (typeof m === 'string') return m;
  if (m.url) return m.url;
  if (m.data && m.data.attributes && m.data.attributes.url) return m.data.attributes.url;
  return '';
}
function normKeywords(v) {
  if (!v) return '';
  if (v.data && Array.isArray(v.data)) v = v.data;      // Strapi 관계 {data:[…]}
  if (Array.isArray(v)) {
    return v.map(function (x) {
      if (typeof x === 'string') return x;
      var a = (x && x.attributes) || x || {};
      return a.name || a.title || a.label || a.slug || '';
    }).filter(Boolean).join(', ');
  }
  return String(v);
}
function extractSeo(a) {
  a = a || {};
  var seo = a.seo || a.SEO || a.meta || {};
  var title = a.seo_title || a.seoTitle || a.meta_title || a.metaTitle || seo.metaTitle || seo.meta_title || seo.title || '';
  var desc  = a.seo_description || a.seoDescription || a.meta_description || a.metaDescription || seo.metaDescription || seo.meta_description || seo.description || '';
  var img   = mediaUrl(a.og_image || a.ogImage || a.seo_image || a.seoImage || seo.metaImage || seo.ogImage || seo.image);
  var kw    = normKeywords(a.keywords || a.meta_keywords || a.metaKeywords || seo.keywords || a.tags || a.hashtags);
  return {
    seoTitle: String(title || '').trim(),
    seoDescription: String(desc || '').trim(),
    ogImage: String(img || '').trim(),
    keywords: String(kw || '').trim()
  };
}

// 발행건만, 최신순으로 정규화해서 반환 — 전량 수집 + 인블로그 SEO 그대로
async function fetchPublished(key, perPage) {
  const arr = await fetchAll(key, perPage);
  return arr
    .filter(function (p) { return isPublished(p.attributes); })
    .sort(function (a, b) { return String(b.attributes && b.attributes.published_at || '').localeCompare(String(a.attributes && a.attributes.published_at || '')); })
    .map(function (p) {
      var a = p.attributes || {};
      var seo = extractSeo(a);
      return {
        id: p.id,
        slug: a.slug || String(p.id),
        title: a.title || '',
        description: a.description || '',
        date: (a.published_at || '').slice(0, 10),
        image: (a.image && a.image.url) || mediaUrl(a.image) || null,
        // 인블로그에서 설정한 SEO(있으면). 없으면 빈 문자열 → 렌더 시 기본값 폴백
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        ogImage: seo.ogImage,
        keywords: seo.keywords,
        attributes: a,
      };
    });
}

// 디버그용: 원본 attributes + 추출된 SEO를 나란히 노출(매핑 확인용)
async function rawSample(key, n) {
  const data = await fetchList(key, 10, 1);
  const arr = (data && data.data) || [];
  const keySet = {};
  arr.forEach(function (p) { Object.keys(p.attributes || {}).forEach(function (k) { keySet[k] = 1; }); });
  return {
    meta: (data && data.meta) || null,      // 페이지네이션 스키마 확인용
    returned: arr.length,
    attributeKeys: Object.keys(keySet).sort(),
    sample: arr.slice(0, n || 3).map(function (p) {
      return {
        id: p.id,
        published: isPublished(p.attributes),
        mappedSeo: extractSeo(p.attributes),  // 우리가 그대로 옮기는 값
        attributes: p.attributes
      };
    })
  };
}

module.exports = { BLOG_ID, isPublished, fetchList, fetchAll, fetchPublished, extractSeo, rawSample };
