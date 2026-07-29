/* ============================================================
   대출 가능성 계산기 (loan capacity calculator)
   The single floating "calculator slip" from THE LEDGER.
   - 연 매출 · 감가상각비 · 기존 차입금 입력 + 업종별 1회전기간 선택
   - live 예상 한도(estimated credit limit) estimate
   - a working keypad that types into the focused field
   Estimate is a rough heuristic, NOT a real loan offer.

   산식(은행권 공통 여신심사 운전자금 방식):
     1회전 소요운전자금 = (연매출 − 감가상각비) × 1회전기간/365
     예상 가용 한도 = 소요운전자금 − 기존 차입금 (음수면 0)
   출처:
   · 금융위원회 '금융회사 여신심사 선진화 방안' — 운전자금 가용한도
     = 1회전 소요운전자금 − 금융기관 총차입액
   · 은행권 운전자금 한도 산출 실무양식(1회전기간 기반 산정)
   · 신용보증기금 운전자금 보증한도 — 매출액의 1/4 ~ 1/3 (kodit.co.kr)
   → 1회전기간은 업종 평균 가정치(서비스 60/도소매 90/제조 120/건설 150일).
     재고·매출채권 회전 등 기업별 변수는 반영하지 않은 추정이다.
   ============================================================ */
(function () {
  'use strict';

  function onlyDigits(s) { return String(s).replace(/[^0-9]/g, ''); }
  function withCommas(n) {
    if (n === '' || n == null || isNaN(n)) return '';
    return Number(n).toLocaleString('en-US');
  }

  // Format a value in 원 into a compact Korean unit string (억/만).
  function formatKRW(won) {
    if (!isFinite(won) || won <= 0) return { num: '0', unit: ' 원' };
    var eok = won / 100000000;       // 억
    if (eok >= 1) {
      var v = Math.round(eok * 10) / 10;
      return { num: '≈ ' + v, unit: '억 원' };
    }
    var man = won / 10000;           // 만
    if (man >= 1) {
      return { num: '≈ ' + Math.round(man).toLocaleString('en-US'), unit: '만 원' };
    }
    return { num: '≈ ' + Math.round(won).toLocaleString('en-US'), unit: ' 원' };
  }

  function initCalculator(root) {
    var fab = root.querySelector('[data-calc-fab]');
    var panel = root.querySelector('[data-calc-panel]');
    var closeBtn = root.querySelector('[data-calc-close]');
    var inputs = Array.prototype.slice.call(root.querySelectorAll('input[data-calc]'));
    var revInput = root.querySelector('[data-calc="revenue"]');
    var depInput = root.querySelector('[data-calc="dep"]');
    var debtInput = root.querySelector('[data-calc="debt"]');
    var daysSel = root.querySelector('[data-calc-days]');
    var outNum = root.querySelector('[data-calc-out-num]');
    var outUnit = root.querySelector('[data-calc-out-unit]');
    var keys = root.querySelectorAll('[data-key]');
    if (!panel || !revInput || !debtInput) return;

    var active = revInput;         // last-focused field the keypad edits
    var buffers = new Map();       // field -> pending arithmetic expression

    inputs.forEach(function (el) {
      el.addEventListener('focus', function () { active = el; });
      el.addEventListener('input', function () {
        // Live typing: keep it numeric + comma-formatted, preserve caret at end.
        var raw = onlyDigits(el.value);
        el.value = withCommas(raw);
        buffers.set(el, raw);
        compute();
      });
    });

    function open(isOpen) {
      panel.style.display = isOpen ? 'block' : 'none';
      if (fab) fab.style.display = isOpen ? 'none' : 'flex';
    }
    if (fab) fab.addEventListener('click', function () { open(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { open(false); });

    function currentNumber(el) {
      return Number(onlyDigits(el.value)) || 0;
    }

    function compute() {
      var rev = currentNumber(revInput);
      var dep = depInput ? currentNumber(depInput) : 0;
      var debt = currentNumber(debtInput);
      var days = daysSel ? (Number(daysSel.value) || 90) : 90;
      // 1회전 소요운전자금 = (연매출 − 감가상각비) × 1회전기간/365
      var wc = Math.max(0, rev - dep) * days / 365;
      // 예상 가용 한도 = 소요운전자금 − 기존 차입금
      var limit = Math.max(0, wc - debt);
      if (rev <= 0) limit = 0;
      var f = formatKRW(limit);
      if (outNum) outNum.textContent = f.num;
      if (outUnit) outUnit.textContent = f.unit;
    }
    if (daysSel) daysSel.addEventListener('change', compute);

    // Keypad: digits/decimal build an expression, operators chain it,
    // "=" evaluates safely (only [0-9 . + - * /] ever reach eval).
    keys.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-key');
        var buf = buffers.get(active) || onlyDigits(active.value);

        if (k === '=') {
          var expr = String(buf).replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-');
          if (!/^[-+*/.\d\s]+$/.test(expr)) return;
          var result;
          try { result = Function('"use strict";return (' + expr + ')')(); }
          catch (e) { return; }
          if (!isFinite(result)) result = 0;
          var val = Math.max(0, Math.round(result));
          active.value = withCommas(val);
          buffers.set(active, String(val));
          compute();
          return;
        }

        if (k === '÷' || k === '×' || k === '−' || k === '+') {
          // Show a live arithmetic expression in the field.
          active.value = buf + ' ' + k + ' ';
          buffers.set(active, active.value);
          return;
        }

        // digit or '.'
        var next = buf + k;
        // If a bare number (no operator), reformat with commas for readability.
        if (/^[\d,]+$/.test(active.value) && !/[×÷−+.]/.test(buf)) {
          var digits = onlyDigits(next);
          active.value = withCommas(digits);
          buffers.set(active, digits);
        } else {
          active.value = next;
          buffers.set(active, next);
        }
        compute();
      });
    });

    compute();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-calc-root]').forEach(initCalculator);
  });
})();
