/* 클라이언트 stale-while-revalidate 캐시 (localStorage)
   bbSWR.swr(key, fetcher, onData):
     · 캐시가 있으면 onData(캐시)를 즉시 호출(빠른 첫 페인트)
     · 이어서 fetcher()로 최신 데이터를 받아 캐시 갱신 + onData(최신) 재호출
     · 반환 Promise는 최신(실패 시 캐시)로 resolve
   localStorage라 새 탭·재방문에서도 캐시가 남아 첫 페인트가 즉시 뜬다.
   (24시간 넘은 캐시는 즉시 페인트에 쓰지 않고 폐기 → 최신 fetch만 반영)
   렌더 함수는 idempotent(innerHTML 교체)라 두 번 호출돼도 안전. */
(function (g) {
  'use strict';
  var MAX_AGE = 24 * 60 * 60 * 1000;
  function get(key) {
    try {
      var r = localStorage.getItem(key);
      if (!r) return null;
      var c = JSON.parse(r);
      if (c && c.at && Date.now() - c.at > MAX_AGE) { localStorage.removeItem(key); return null; }
      return c;
    } catch (e) { return null; }
  }
  function set(key, data) { try { localStorage.setItem(key, JSON.stringify({ data: data, at: Date.now() })); } catch (e) {} }
  function swr(key, fetcher, onData) {
    var c = get(key);
    if (c && c.data != null && onData) { try { onData(c.data, true); } catch (e) {} }
    return Promise.resolve().then(fetcher).then(function (data) {
      set(key, data);
      if (onData) { try { onData(data, false); } catch (e) {} }
      return data;
    }).catch(function () { return c ? c.data : null; });
  }
  g.bbSWR = { swr: swr, get: get, set: set };
})(window);
