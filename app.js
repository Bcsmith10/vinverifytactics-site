// VinVerifyTactics booking form
// 1) Eligibility gate: blocks submission if any eligibility flag is checked
//    and shows the CHP/DMV referral message instead.
// 2) Sends the form to Formspree in the background and shows the confirmation
//    message on this page, rather than redirecting to a Formspree page.
// 3) Prevents choosing a past date.

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

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      if (response.ok) {
        form.style.display = 'none';
        successMsg.style.display = 'block';
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        throw new Error('Submit failed');
      }
    }).catch(function () {
      errorMsg.style.display = 'block';
      submitBtn.textContent = originalLabel;
      setButtonEnabled(true);
      errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
});
