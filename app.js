// VinVerifyTactics booking form — eligibility gate
// Blocks submission if any eligibility flag is checked, and shows the
// CHP/DMV referral message instead of letting the booking go through.

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('booking-form');
  var blockedMsg = document.getElementById('blocked-msg');
  var successMsg = document.getElementById('form-success');
  var submitBtn = document.getElementById('submit-btn');
  var flags = document.querySelectorAll('.eligibility-flag');

  function anyFlagChecked() {
    for (var i = 0; i < flags.length; i++) {
      if (flags[i].checked) return true;
    }
    return false;
  }

  function refreshEligibilityState() {
    if (anyFlagChecked()) {
      blockedMsg.style.display = 'block';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
      submitBtn.style.cursor = 'not-allowed';
    } else {
      blockedMsg.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }

  flags.forEach(function (flag) {
    flag.addEventListener('change', refreshEligibilityState);
  });

  form.addEventListener('submit', function (e) {
    // Hard stop: never let a flagged vehicle submit, even if the button
    // state was somehow bypassed.
    if (anyFlagChecked()) {
      e.preventDefault();
      blockedMsg.style.display = 'block';
      blockedMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // If a Formspree endpoint has been configured, let the form submit
    // normally (native POST) but show a friendly inline confirmation too.
    // If no endpoint is configured yet, prevent a broken submit and say so.
    var action = form.getAttribute('action') || '';
    if (action.indexOf('YOUR_FORM_ID') !== -1) {
      e.preventDefault();
      alert('Booking form isn\'t connected yet — set your Formspree endpoint in index.html (see README).');
    }
  });
});
