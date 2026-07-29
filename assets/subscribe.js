/* ============================================================
   이메일 소식 받기 (GNB 공용)
   회원가입 대신 이메일 리드만 수집한다 — [data-open-subscribe]
   버튼을 누르면 모달을 띄우고 /api/lead 에 type:'subscribe'로 적재.
   추후 서비스 내재화(계정 도입) 시 이 리드를 계정 연동의
   시드 데이터로 쓴다(리드 탭: 일시·구분·이메일·동의·상세·UA).
   ============================================================ */
(function () {
  'use strict';

  var modal = null;

  function build() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';
    modal.innerHTML =
      '<div class="modal-dialog" data-dialog style="max-width:440px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1.5px solid var(--ink-1);">' +
      '<div><div class="mono" style="font-size:10px;letter-spacing:.1em;color:var(--blue);">BLACK BOOK · 구독</div>' +
      '<h3 class="bt" style="font-size:20px;font-weight:700;margin:5px 0 0;">메일로 소식 받기</h3></div>' +
      '<span data-sub-close style="font-size:24px;color:#9BA3AB;cursor:pointer;line-height:1;">×</span></div>' +
      '<div style="padding:22px 24px 24px;">' +
      '<p style="font-size:13.5px;color:var(--ink-2);line-height:1.6;margin:0 0 14px;">새 콘텐츠·실무백과·신고 일정 소식을 이메일로 보내 드립니다. 지금은 이메일만 남겨 주세요.</p>' +
      '<input data-sub-email class="field mono" type="email" inputmode="email" placeholder="name@company.co.kr" style="font-size:13px;">' +
      '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#7E868F;margin-top:12px;cursor:pointer;line-height:1.5;">' +
      '<input data-sub-agree type="checkbox" style="accent-color:#2348D6;width:14px;height:14px;flex-shrink:0;margin-top:2px;"><span><b style="color:var(--ink-2);">[필수]</b> 소식·마케팅 정보 수신 및 개인정보 수집·이용에 동의합니다.</span></label>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;">' +
      '<span class="mono" data-sub-msg style="font-size:10.5px;color:var(--ink-3);"></span>' +
      '<button data-sub-submit class="btn-blue" style="font-size:13px;padding:10px 22px;border-radius:3px;border:0;">구독하기</button>' +
      '</div></div></div>';
    document.body.appendChild(modal);

    var dialog = modal.querySelector('[data-dialog]');
    var email = modal.querySelector('[data-sub-email]');
    var agree = modal.querySelector('[data-sub-agree]');
    var msg = modal.querySelector('[data-sub-msg]');
    var submit = modal.querySelector('[data-sub-submit]');
    var RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    dialog.addEventListener('click', function (e) { e.stopPropagation(); });
    modal.querySelector('[data-sub-close]').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.style.display !== 'none') close(); });

    submit.addEventListener('click', function () {
      var mail = email.value.trim();
      if (!RE.test(mail)) { msg.style.color = '#B4322B'; msg.textContent = '이메일을 확인해 주세요.'; email.focus(); return; }
      if (!agree.checked) { msg.style.color = '#B4322B'; msg.textContent = '필수 수신 동의가 필요합니다.'; return; }
      submit.disabled = true; msg.style.color = '#7E868F'; msg.textContent = '등록 중…';
      // 소식·마케팅 수신 통합 필수 동의 — 콘텐츠에 자사 홍보가 포함되므로 분리하지 않는다.
      fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subscribe', email: mail, consent: true, source: 'gnb' })
      }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function () {
          dialog.innerHTML =
            '<div style="padding:44px 32px;text-align:center;">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:var(--blue-soft);color:var(--blue);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:22px;">✓</div>' +
            '<h3 class="bt" style="font-size:21px;font-weight:700;margin:16px 0 0;">구독 완료</h3>' +
            '<p style="font-size:13.5px;color:var(--ink-2);line-height:1.6;margin:10px 0 20px;">' + mail.replace(/[<>&]/g, '') + '<br>다음 소식부터 메일로 보내 드릴게요.</p>' +
            '<button class="btn-ink" data-sub-close style="font-size:13px;padding:11px 24px;border-radius:3px;border:0;cursor:pointer;">확인</button></div>';
          dialog.querySelector('[data-sub-close]').addEventListener('click', close);
        })
        .catch(function () { submit.disabled = false; msg.style.color = '#B4322B'; msg.textContent = '등록에 실패했어요. 잠시 후 다시 시도해 주세요.'; });
    });
    return modal;
  }

  function open() {
    build().style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var e = modal.querySelector('[data-sub-email]'); if (e) e.focus(); }, 30);
  }
  function close() { if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } }

  // 이벤트 위임 — notice.js처럼 GNB를 동적으로 그리는 화면에서도 동작
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-subscribe]')) open();
  });
})();
