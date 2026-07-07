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

async function fetchList(key, perPage) {
  const url = `https://inblog.ai/api/v1/posts?blog_id=${BLOG_ID}&per_page=${perPage || 100}&sort=published_at`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('Inblog ' + r.status);
  return r.json();
}

// 발행건만, 최신순으로 정규화해서 반환
async function fetchPublished(key, perPage) {
  const data = await fetchList(key, perPage);
  return (data.data || [])
    .filter(function (p) { return isPublished(p.attributes); })
    .sort(function (a, b) { return String(b.attributes && b.attributes.published_at || '').localeCompare(String(a.attributes && a.attributes.published_at || '')); })
    .map(function (p) {
      var a = p.attributes || {};
      return {
        id: p.id,
        slug: a.slug || String(p.id),
        title: a.title || '',
        description: a.description || '',
        date: (a.published_at || '').slice(0, 10),
        image: (a.image && a.image.url) || null,
        attributes: a,
      };
    });
}

// 디버그용: 원본 attributes 일부를 그대로 노출(발행 필드 확인용)
async function rawSample(key, n) {
  const data = await fetchList(key, 10);
  return (data.data || []).slice(0, n || 3).map(function (p) {
    return { id: p.id, published: isPublished(p.attributes), attributes: p.attributes };
  });
}

module.exports = { BLOG_ID, isPublished, fetchList, fetchPublished, rawSample };
