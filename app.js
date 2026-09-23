/* Lift Tracker — all state lives in localStorage on this device. */
(function () {
  'use strict';

  var KEY = 'lift-tracker/v1';

  var COMMON = [
    'Back Squat', 'Front Squat', 'Bench Press', 'Incline Bench Press',
    'Overhead Press', 'Deadlift', 'Romanian Deadlift', 'Barbell Row',
    'Pull-up', 'Chin-up', 'Dip', 'Lat Pulldown', 'Leg Press',
    'Lunge', 'Hip Thrust', 'Bicep Curl', 'Tricep Extension',
    'Lateral Raise', 'Calf Raise', 'Face Pull'
  ];

  /* ── State ─────────────────────────────────────────────── */
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sets)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read saved data:', e);
    }
    return { v: 1, unit: 'lbs', sets: [] };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast('Could not save — storage may be full');
      console.error(e);
    }
  }

  /* ── Helpers ───────────────────────────────────────────── */
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* Parse as local time — new Date('2026-09-23') would be UTC and
     can land on the previous day west of Greenwich. */
  function isoToMs(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }

  function fmtDay(iso) {
    var ms = isoToMs(iso);
    var t = isoToMs(todayISO());
    var days = Math.round((t - ms) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return new Date(ms).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
    });
  }

  /* Epley estimated one-rep max. */
  function e1rm(weight, reps) {
    return reps === 1 ? weight : weight * (1 + reps / 30);
  }

  function round(n) { return Math.round(n * 10) / 10; }
  function num(n) { return round(n).toLocaleString(); }
  function unit() { return state.unit; }

  function exercises() {
    var seen = {};
    state.sets.forEach(function (s) { seen[s.exercise] = true; });
    return Object.keys(seen).sort();
  }

  function setsFor(name) {
    return state.sets.filter(function (s) { return s.exercise === name; });
  }

  function byDateDesc(a, b) { return a < b ? 1 : a > b ? -1 : 0; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── Toast ─────────────────────────────────────────────── */
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ── Rest timer ────────────────────────────────────────── */
  var timerEl = document.getElementById('timer');
  var timerValue = document.getElementById('timerValue');
  var timerStart = null, timerInt = null;

  function startTimer() {
    timerStart = Date.now();
    timerEl.hidden = false;
    tickTimer();
    clearInterval(timerInt);
    timerInt = setInterval(tickTimer, 1000);
  }
  function tickTimer() {
    var s = Math.floor((Date.now() - timerStart) / 1000);
    timerValue.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function stopTimer() {
    clearInterval(timerInt);
    timerEl.hidden = true;
  }
  document.getElementById('timerStop').addEventListener('click', stopTimer);

  /* ── Tabs ──────────────────────────────────────────────── */
  var currentView = 'log';
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { showView(tab.dataset.view); });
  });

  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(function (v) {
      v.hidden = v.id !== 'view-' + name;
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === name));
    });
    window.scrollTo(0, 0);
    if (name === 'history') renderHistory();
    if (name === 'progress') renderProgress();
    if (name === 'data') renderData();
  }

  /* ── Log view ──────────────────────────────────────────── */
  var form = document.getElementById('setForm');
  var fDate = document.getElementById('f-date');
  var fExercise = document.getElementById('f-exercise');
  var fWeight = document.getElementById('f-weight');
  var fReps = document.getElementById('f-reps');
  var fRpe = document.getElementById('f-rpe');
  var fNotes = document.getElementById('f-notes');

  fDate.value = todayISO();

  document.querySelectorAll('.step').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.dataset.target || 'f-weight');
      var next = (parseFloat(input.value) || 0) + parseFloat(btn.dataset.step);
      input.value = Math.max(0, round(next));
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var exercise = fExercise.value.trim();
    var weight = parseFloat(fWeight.value);
    var reps = parseInt(fReps.value, 10);
    if (!exercise || !isFinite(weight) || !reps) return;

    state.sets.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      date: fDate.value || todayISO(),
      exercise: exercise,
      weight: weight,
      reps: reps,
      rpe: fRpe.value ? parseFloat(fRpe.value) : null,
      notes: fNotes.value.trim() || ''
    });
    save();

    fNotes.value = '';
    startTimer();
    renderLog();
    refreshExerciseList();
    toast('Set added');
  });

  document.getElementById('repeatBtn').addEventListener('click', function () {
    var last = state.sets[state.sets.length - 1];
    if (!last) return;
    fExercise.value = last.exercise;
    fWeight.value = last.weight;
    fReps.value = last.reps;
    if (last.rpe) fRpe.value = last.rpe;
    form.requestSubmit();
  });

  function refreshExerciseList() {
    var list = document.getElementById('exerciseList');
    var names = exercises();
    COMMON.forEach(function (c) { if (names.indexOf(c) === -1) names.push(c); });
    list.innerHTML = names.map(function (n) {
      return '<option value="' + escapeHtml(n) + '">';
    }).join('');
  }

  /* Best e1RM ever recorded for an exercise — used for the PR badge. */
  function bestE1rm(name) {
    return setsFor(name).reduce(function (m, s) {
      return Math.max(m, e1rm(s.weight, s.reps));
    }, 0);
  }

  function renderSetGroups(container, sets, showDelete) {
    var groups = {};
    var order = [];
    sets.forEach(function (s) {
      if (!groups[s.exercise]) { groups[s.exercise] = []; order.push(s.exercise); }
      groups[s.exercise].push(s);
    });

    container.innerHTML = '';
    order.forEach(function (name) {
      var rows = groups[name];
      var best = bestE1rm(name);
      var volume = rows.reduce(function (v, s) { return v + s.weight * s.reps; }, 0);

      var wrap = document.createElement('div');
      wrap.className = 'group';

      var head = document.createElement('div');
      head.className = 'group-head';
      head.innerHTML = '<span>' + escapeHtml(name) + '</span>' +
        '<span class="meta">' + rows.length + ' set' + (rows.length > 1 ? 's' : '') +
        ' &middot; ' + num(volume) + ' ' + unit() + '</span>';
      wrap.appendChild(head);

      rows.forEach(function (s, i) {
        var est = e1rm(s.weight, s.reps);
        var isPr = best > 0 && Math.abs(est - best) < 0.01;

        var row = document.createElement('div');
        row.className = 'set-row';
        row.innerHTML =
          '<span class="set-n">' + (i + 1) + '</span>' +
          '<span class="set-main">' + num(s.weight) + ' ' + unit() + ' &times; ' + s.reps +
            (s.rpe ? ' <span class="set-sub">@ RPE ' + s.rpe + '</span>' : '') +
            (s.notes ? '<div class="set-sub">' + escapeHtml(s.notes) + '</div>' : '') +
          '</span>' +
          (isPr ? '<span class="pr-badge">PR</span>' : '') +
          '<span class="set-e1rm">' + num(est) + '</span>';

        if (showDelete) {
          var del = document.createElement('button');
          del.className = 'del';
          del.type = 'button';
          del.innerHTML = '&times;';
          del.setAttribute('aria-label', 'Delete set');
          del.addEventListener('click', function () { deleteSet(s.id); });
          row.appendChild(del);
        }
        wrap.appendChild(row);
      });

      container.appendChild(wrap);
    });
  }

  function deleteSet(id) {
    state.sets = state.sets.filter(function (s) { return s.id !== id; });
    save();
    renderLog();
    if (currentView === 'history') renderHistory();
    if (currentView === 'progress') renderProgress();
    toast('Set deleted');
  }

  function renderLog() {
    var date = fDate.value || todayISO();
    var sets = state.sets.filter(function (s) { return s.date === date; });
    var list = document.getElementById('todayList');

    document.getElementById('todayLabel').textContent = fmtDay(date);
    document.getElementById('repeatBtn').disabled = state.sets.length === 0;

    if (!sets.length) {
      list.innerHTML = '<div class="empty">No sets logged yet.</div>';
      document.getElementById('todayMeta').textContent = '';
      return;
    }

    var volume = sets.reduce(function (v, s) { return v + s.weight * s.reps; }, 0);
    document.getElementById('todayMeta').textContent =
      sets.length + ' sets · ' + num(volume) + ' ' + unit() + ' total';

    renderSetGroups(list, sets, true);
  }

  fDate.addEventListener('change', renderLog);

  /* ── History view ──────────────────────────────────────── */
  function renderHistory() {
    var list = document.getElementById('historyList');
    var dates = {};
    state.sets.forEach(function (s) { (dates[s.date] = dates[s.date] || []).push(s); });
    var keys = Object.keys(dates).sort(byDateDesc);

    if (!keys.length) {
      list.innerHTML = '<div class="empty">Nothing logged yet.<br>Add a set on the Log tab.</div>';
      return;
    }

    list.innerHTML = '';
    keys.forEach(function (date) {
      var sets = dates[date];
      var volume = sets.reduce(function (v, s) { return v + s.weight * s.reps; }, 0);
      var names = sets.map(function (s) { return s.exercise; })
                      .filter(function (v, i, a) { return a.indexOf(v) === i; });

      var det = document.createElement('details');
      det.className = 'group';

      var sum = document.createElement('summary');
      sum.className = 'group-head';
      sum.style.cursor = 'pointer';
      sum.innerHTML = '<span>' + fmtDay(date) + '</span>' +
        '<span class="meta">' + names.length + ' exercise' + (names.length > 1 ? 's' : '') +
        ' &middot; ' + num(volume) + ' ' + unit() + '</span>';
      det.appendChild(sum);

      var body = document.createElement('div');
      renderSetGroups(body, sets, true);
      det.appendChild(body);

      list.appendChild(det);
    });
  }

  /* ── Progress view ─────────────────────────────────────── */
  var pSelect = document.getElementById('p-exercise');
  pSelect.addEventListener('change', renderProgress);

  function renderProgress() {
    var names = exercises();
    var body = document.getElementById('progressBody');

    if (!names.length) {
      pSelect.innerHTML = '';
      body.innerHTML = '<div class="empty">Log a few sets and your progress shows up here.</div>';
      return;
    }

    var chosen = names.indexOf(pSelect.value) > -1 ? pSelect.value : names[0];
    pSelect.innerHTML = names.map(function (n) {
      return '<option' + (n === chosen ? ' selected' : '') + '>' + escapeHtml(n) + '</option>';
    }).join('');

    var sets = setsFor(chosen);

    /* One point per session: that day's best estimated 1RM. */
    var perDay = {};
    sets.forEach(function (s) {
      var est = e1rm(s.weight, s.reps);
      if (!perDay[s.date] || est > perDay[s.date].est) {
        perDay[s.date] = { est: est, set: s };
      }
    });
    var days = Object.keys(perDay).sort();
    var points = days.map(function (d) {
      return {
        x: isoToMs(d),
        y: round(perDay[d].est),
        label: num(perDay[d].est) + ' ' + unit() + ' est. 1RM' +
               '<br>' + num(perDay[d].set.weight) + ' × ' + perDay[d].set.reps
      };
    });

    var bestEst = Math.max.apply(null, points.map(function (p) { return p.y; }));
    var heaviest = sets.reduce(function (m, s) { return s.weight > m.weight ? s : m; }, sets[0]);
    var volume = sets.reduce(function (v, s) { return v + s.weight * s.reps; }, 0);

    body.innerHTML =
      '<div class="tiles">' +
        tile('Est. 1RM', num(bestEst), unit()) +
        tile('Heaviest set', num(heaviest.weight) + ' × ' + heaviest.reps, '') +
        tile('Total volume', num(volume), unit()) +
        tile('Sessions', days.length, '') +
      '</div>' +
      '<div class="chart-wrap" id="chartWrap"></div>' +
      '<button type="button" class="table-toggle" id="tableToggle">Show data table</button>' +
      '<div id="tableBody" hidden></div>' +
      '<h2 class="section-title">Best by reps</h2>' +
      prTable(sets);

    window.LiftChart.render(
      document.getElementById('chartWrap'),
      points,
      { title: 'Estimated 1RM — ' + chosen + ' (' + unit() + ')' }
    );

    var tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = sessionTable(days, perDay);
    document.getElementById('tableToggle').addEventListener('click', function () {
      tableBody.hidden = !tableBody.hidden;
      this.textContent = tableBody.hidden ? 'Show data table' : 'Hide data table';
    });
  }

  function tile(label, value, u) {
    return '<div class="tile"><div class="tile-label">' + label + '</div>' +
           '<div class="tile-value">' + value +
           (u ? ' <span class="tile-unit">' + u + '</span>' : '') + '</div></div>';
  }

  function sessionTable(days, perDay) {
    return '<div class="card"><table><thead><tr>' +
      '<th>Date</th><th>Top set</th><th>Est. 1RM</th></tr></thead><tbody>' +
      days.slice().reverse().map(function (d) {
        var p = perDay[d];
        return '<tr><td>' + fmtDay(d) + '</td><td>' +
          num(p.set.weight) + ' × ' + p.set.reps + '</td><td>' +
          num(p.est) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function prTable(sets) {
    var best = {};
    sets.forEach(function (s) {
      if (!best[s.reps] || s.weight > best[s.reps].weight) best[s.reps] = s;
    });
    var reps = Object.keys(best).map(Number).sort(function (a, b) { return a - b; });
    if (!reps.length) return '';

    return '<div class="card"><table><thead><tr>' +
      '<th>Reps</th><th>Weight</th><th>Date</th></tr></thead><tbody>' +
      reps.map(function (r) {
        return '<tr><td>' + r + '</td><td>' + num(best[r].weight) + ' ' + unit() +
               '</td><td>' + fmtDay(best[r].date) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* Re-render the chart when the viewport changes width. */
  var resizeTimer;
  window.addEventListener('resize', function () {
    if (currentView !== 'progress') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderProgress, 150);
  });

  /* ── Data view ─────────────────────────────────────────── */
  function renderData() {
    document.querySelectorAll('.seg').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit));
    });
    document.getElementById('dataStats').textContent =
      state.sets.length + ' sets across ' + exercises().length + ' exercises.';
  }

  document.querySelectorAll('.seg').forEach(function (b) {
    b.addEventListener('click', function () {
      state.unit = b.dataset.unit;
      save();
      document.querySelectorAll('.unit-label').forEach(function (u) { u.textContent = state.unit; });
      renderData();
      renderLog();
      toast('Units set to ' + state.unit + ' (existing numbers are unchanged)');
    });
  });

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  document.getElementById('exportJson').addEventListener('click', function () {
    download('lift-tracker-' + todayISO() + '.json', JSON.stringify(state, null, 2), 'application/json');
  });

  document.getElementById('exportCsv').addEventListener('click', function () {
    var rows = [['date', 'exercise', 'weight', 'unit', 'reps', 'rpe', 'est_1rm', 'notes']];
    state.sets.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (s) {
      rows.push([s.date, s.exercise, s.weight, state.unit, s.reps, s.rpe || '',
                 round(e1rm(s.weight, s.reps)), s.notes || '']);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    download('lift-tracker-' + todayISO() + '.csv', csv, 'text/csv');
  });

  var importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', function () { importFile.click(); });

  importFile.addEventListener('change', function () {
    var file = importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.sets)) throw new Error('Not a Lift Tracker backup');
        if (state.sets.length &&
            !confirm('Replace your ' + state.sets.length + ' existing sets with ' +
                     data.sets.length + ' from this file?')) return;
        state = { v: 1, unit: data.unit || 'lbs', sets: data.sets };
        save();
        boot();
        toast('Imported ' + data.sets.length + ' sets');
      } catch (e) {
        toast('That file could not be read');
        console.error(e);
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    if (!state.sets.length) return toast('Nothing to delete');
    if (!confirm('Delete all ' + state.sets.length + ' sets? This cannot be undone.')) return;
    if (!confirm('Really delete everything? Export a backup first if you might want it.')) return;
    state = { v: 1, unit: state.unit, sets: [] };
    save();
    boot();
    toast('All data deleted');
  });

  /* ── Boot ──────────────────────────────────────────────── */
  function boot() {
    document.querySelectorAll('.unit-label').forEach(function (u) { u.textContent = state.unit; });
    refreshExerciseList();
    renderLog();
    renderData();
    if (currentView === 'history') renderHistory();
    if (currentView === 'progress') renderProgress();
  }

  boot();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
  }
})();
