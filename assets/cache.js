/* 클라이언트 stale-while-revalidate 캐시 (sessionStorage)
   bbSWR.swr(key, fetcher, onData):
     · 캐시가 있으면 onData(캐시)를 즉시 호출(빠른 첫 페인트)
     · 이어서 fetcher()로 최신 데이터를 받아 캐시 갱신 + onData(최신) 재호출
     · 반환 Promise는 최신(실패 시 캐시)로 resolve
   렌더 함수는 idempotent(innerHTML 교체)라 두 번 호출돼도 안전. */
(function (g) {
  'use strict';
  function get(key) { try { var r = sessionStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function set(key, data) { try { sessionStorage.setItem(key, JSON.stringify({ data: data, at: Date.now() })); } catch (e) {} }
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
