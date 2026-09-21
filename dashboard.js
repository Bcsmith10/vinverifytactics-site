// VinVerifyTactics internal dashboard
// All data lives in this browser's localStorage only — it does not sync
// across devices and clearing browser data will erase it. Export/backup
// periodically if you rely on this for records.

var STORAGE_KEY = 'vvt_jobs';
var GATE_KEY = 'vvt_gate_ok';
var ACCESS_CODE = 'VVT510Hayward!'; // change this to whatever you like

function getJobs() {
  var raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function renderJobs() {
  var jobs = getJobs();
  var tbody = document.getElementById('job-rows');
  var emptyState = document.getElementById('empty-state');
  tbody.innerHTML = '';

  if (jobs.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  jobs.slice().reverse().forEach(function (job) {
    var tr = document.createElement('tr');

    tr.innerHTML =
      '<td>' + escapeHtml(job.name) + '<br><span class="note">' + escapeHtml(job.phone || '') + '</span></td>' +
      '<td>' + escapeHtml(job.vehicle) + '<br><span class="note">' + escapeHtml(job.address || '') + '</span></td>' +
      '<td>' + escapeHtml(job.date) + '</td>' +
      '<td>' + escapeHtml(job.zone) + '</td>' +
      '<td>' + (job.price ? '$' + escapeHtml(job.price) : '—') + '</td>' +
      '<td></td>' +
      '<td><button class="del-btn" data-id="' + job.id + '">Remove</button></td>';

    var statusCell = tr.children[5];
    var select = document.createElement('select');
    select.className = 'status-select';
    ['Pending', 'Confirmed', 'En route', 'Completed'].forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (job.status === s) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      updateJobStatus(job.id, select.value);
    });
    statusCell.appendChild(select);

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.del-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      removeJob(btn.getAttribute('data-id'));
    });
  });
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function addJob() {
  var name = document.getElementById('j-name').value.trim();
  var phone = document.getElementById('j-phone').value.trim();
  var vehicle = document.getElementById('j-vehicle').value.trim();
  var date = document.getElementById('j-date').value;
  var zone = document.getElementById('j-zone').value;
  var price = document.getElementById('j-price').value.trim();
  var address = document.getElementById('j-address').value.trim();

  if (!name || !vehicle) {
    alert('Client name and vehicle are required.');
    return;
  }

  var jobs = getJobs();
  jobs.push({
    id: Date.now().toString(),
    name: name, phone: phone, vehicle: vehicle, date: date,
    zone: zone, price: price, address: address, status: 'Pending'
  });
  saveJobs(jobs);
  renderJobs();

  ['j-name','j-phone','j-vehicle','j-date','j-price','j-address'].forEach(function (id) {
    document.getElementById(id).value = '';
  });
}

function updateJobStatus(id, status) {
  var jobs = getJobs();
  jobs = jobs.map(function (j) {
    if (j.id === id) j.status = status;
    return j;
  });
  saveJobs(jobs);
}

function removeJob(id) {
  if (!confirm('Remove this job? This cannot be undone.')) return;
  var jobs = getJobs().filter(function (j) { return j.id !== id; });
  saveJobs(jobs);
  renderJobs();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('add-job-btn').addEventListener('click', addJob);

  var gateScreen = document.getElementById('gate-screen');
  var dashScreen = document.getElementById('dashboard-screen');
  var gateInput = document.getElementById('gate-input');
  var gateSubmit = document.getElementById('gate-submit');

  function unlock() {
    gateScreen.style.display = 'none';
    dashScreen.style.display = 'block';
    renderJobs();
  }

  if (sessionStorage.getItem(GATE_KEY) === 'true') {
    unlock();
  }

  gateSubmit.addEventListener('click', function () {
    if (gateInput.value === ACCESS_CODE) {
      sessionStorage.setItem(GATE_KEY, 'true');
      unlock();
    } else {
      alert('Incorrect code.');
    }
  });
  gateInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') gateSubmit.click();
  });
});
