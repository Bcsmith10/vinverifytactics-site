// VinVerifyTactics booking form
// 1) Eligibility gate: blocks submission if any eligibility flag is checked
//    and shows the CHP/DMV referral message instead.
// 2) Sends the form in the background and shows the confirmation message on
//    this page. Primary route: our Google Apps Script (Sheet + email). If that
//    is not set up or fails, it falls back to Formspree.
// 3) Prevents choosing a past date.

// Web app URL of the Google Apps Script (ends in /exec). Empty = Formspree only.
var GOOGLE_ENDPOINT = '';

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('booking-form');
  var blockedMsg = document.getElementById('blocked-msg');
  var successMsg = document.getElementById('form-success');
  var errorMsg = document.getElementById('form-error');
  var submitBtn = document.getElementById('submit-btn');
  var flags = document.querySelectorAll('.eligibility-flag');
  var dateInput = document.getElementById('date');

  // Earliest selectable day = today (local time)
  if (dateInput) {
    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    dateInput.min = yyyy + '-' + mm + '-' + dd;
  }

  function anyFlagChecked() {
    for (var i = 0; i < flags.length; i++) {
      if (flags[i].checked) return true;
    }
    return false;
  }

  function setButtonEnabled(enabled) {
    submitBtn.disabled = !enabled;
    submitBtn.style.opacity = enabled ? '1' : '0.5';
    submitBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  function refreshEligibilityState() {
    if (anyFlagChecked()) {
      blockedMsg.style.display = 'block';
      setButtonEnabled(false);
    } else {
      blockedMsg.style.display = 'none';
      setButtonEnabled(true);
    }
  }

  flags.forEach(function (flag) {
    flag.addEventListener('change', refreshEligibilityState);
  });

  function viaFormspree(f) {
    return fetch(f.action, {
      method: 'POST',
      body: new FormData(f),
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Formspree failed');
    });
  }

  function sendBooking(f) {
    if (!GOOGLE_ENDPOINT) return viaFormspree(f);
    var params = new URLSearchParams();
    new FormData(f).forEach(function (v, k) { if (typeof v === 'string') params.append(k, v); });
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : null;
    return fetch(GOOGLE_ENDPOINT, { method: 'POST', body: params, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (timer) clearTimeout(timer); if (!j || j.ok !== true) throw new Error('Google route failed'); })
      .catch(function () { if (timer) clearTimeout(timer); return viaFormspree(f); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorMsg.style.display = 'none';

    // Hard stop: never let a flagged vehicle submit, even if the button
    // state was somehow bypassed.
    if (anyFlagChecked()) {
      blockedMsg.style.display = 'block';
      blockedMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    setButtonEnabled(false);

    sendBooking(form).then(function () {
      form.style.display = 'none';
      successMsg.style.display = 'block';
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () {
      errorMsg.style.display = 'block';
      submitBtn.textContent = originalLabel;
      setButtonEnabled(true);
      errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
});
