/* Views and interaction. Data lives in data.js, charts in chart.js. */
(function () {
  'use strict';

  var D = window.LiftData;
  var state = D.load();
  var currentView = 'log';
  var selected = '';          // exercise chosen in the picker

  /* ── Small helpers ─────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function round(n) { return Math.round(n * 10) / 10; }
  function num(n) { return round(n).toLocaleString(); }
  function unit() { return state.unit; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDay(iso) {
    var ms = D.isoToMs(iso);
    var days = Math.round((D.isoToMs(D.todayISO()) - ms) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    var d = new Date(ms);
    return d.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
    });
  }

  function persist() {
    if (!D.save(state)) toast('Could not save — storage may be full');
  }

  /* ── Toast ─────────────────────────────────────────────── */
  var toastEl = $('toast'), toastTimer;
  function toast(msg, win) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('win', !!win);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, win ? 3000 : 2200);
  }

  /* ── Rest timer ────────────────────────────────────────── */
  var timerEl = $('timer'), timerValue = $('timerValue');
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
  timerEl.addEventListener('click', function () {
    clearInterval(timerInt);
    timerEl.hidden = true;
  });

  /* ── Tabs ──────────────────────────────────────────────── */
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { showView(tab.dataset.view); });
  });

  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + name; });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === name));
    });
    window.scrollTo(0, 0);
    if (name === 'history') renderHistory();
    if (name === 'progress') renderProgress();
    if (name === 'you') renderYou();
  }

  /* ── Exercise picker sheet ─────────────────────────────── */
  var sheet = $('sheet'), backdrop = $('sheetBackdrop');
  var sheetSearch = $('sheetSearch'), sheetBody = $('sheetBody'), groupChips = $('groupChips');
  var activeGroup = 'Recent';

  function recentExercises() {
    var seen = {}, out = [];
    state.sets.slice().reverse().forEach(function (s) {
      if (!seen[s.exercise]) { seen[s.exercise] = true; out.push(s.exercise); }
    });
    return out;
  }

  function lastSetFor(name) {
    for (var i = state.sets.length - 1; i >= 0; i--) {
      if (state.sets[i].exercise === name) return state.sets[i];
    }
    return null;
  }

  function openSheet() {
    activeGroup = recentExercises().length ? 'Recent' : 'Chest';
    sheetSearch.value = '';
    backdrop.hidden = false;
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    renderChips();
    renderSheetList();
  }

  function closeSheet() {
    backdrop.hidden = true;
    sheet.hidden = true;
    document.body.style.overflow = '';
  }

  $('pickerBtn').addEventListener('click', openSheet);
  $('sheetClose').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  });

  function renderChips() {
    var groups = [];
    if (recentExercises().length) groups.push('Recent');
    D.LIBRARY.forEach(function (g) { groups.push(g.group); });

    groupChips.innerHTML = '';
    groups.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = g;
      b.setAttribute('aria-pressed', String(g === activeGroup));
      b.addEventListener('click', function () {
        activeGroup = g;
        sheetSearch.value = '';
        renderChips();
        renderSheetList();
        sheetBody.scrollTop = 0;
      });
      groupChips.appendChild(b);
    });
  }

  function renderSheetList() {
    var q = sheetSearch.value.trim().toLowerCase();
    sheetBody.innerHTML = '';

    var sections = [];
    if (q) {
      /* Search spans everything: the library plus anything logged. */
      var pool = [];
      D.LIBRARY.forEach(function (g) { pool = pool.concat(g.exercises); });
      recentExercises().forEach(function (n) { if (pool.indexOf(n) === -1) pool.push(n); });
      var hits = pool.filter(function (n) { return n.toLowerCase().indexOf(q) > -1; });
      sections.push({ title: hits.length ? 'Matches' : '', items: hits });
    } else if (activeGroup === 'Recent') {
      sections.push({ title: 'Recently logged', items: recentExercises() });
    } else {
      D.LIBRARY.forEach(function (g) {
        if (g.group === activeGroup) sections.push({ title: g.group, items: g.exercises });
      });
    }

    sections.forEach(function (sec) {
      if (sec.title) {
        var h = document.createElement('div');
        h.className = 'sheet-group';
        h.textContent = sec.title;
        sheetBody.appendChild(h);
      }
      sec.items.forEach(function (name) {
        var last = lastSetFor(name);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sheet-item';
        b.innerHTML = '<span>' + esc(name) + '</span>' +
          (last ? '<span class="recent">' + num(last.weight) + ' × ' + last.reps + '</span>' : '');
        b.addEventListener('click', function () { choose(name); });
        sheetBody.appendChild(b);
      });
    });

    /* Anything not in the library can still be logged. */
    var exact = q && sections.some(function (s) {
      return s.items.some(function (n) { return n.toLowerCase() === q; });
    });
    if (q && !exact) {
      var custom = document.createElement('button');
      custom.type = 'button';
      custom.className = 'sheet-item';
      custom.innerHTML = '<span>Use “' + esc(sheetSearch.value.trim()) + '”</span>' +
                         '<span class="recent">custom</span>';
      custom.addEventListener('click', function () { choose(sheetSearch.value.trim()); });
      sheetBody.appendChild(custom);
    }
  }

  sheetSearch.addEventListener('input', renderSheetList);

  function choose(name) {
    selected = name;
    var btn = $('pickerBtn');
    btn.classList.add('chosen');
    $('pickerLabel').textContent = name;
    $('pickerGroup').textContent = D.groupOf(name) === 'Other' ? '' : D.groupOf(name);
    closeSheet();

    /* Prefill with the last numbers used for this lift. */
    var last = lastSetFor(name);
    if (last) {
      $('f-weight').value = last.weight;
      $('f-reps').value = last.reps;
    }
    renderLog();
  }

  /* ── Log ───────────────────────────────────────────────── */
  var form = $('setForm'), fDate = $('f-date');
  fDate.value = D.todayISO();

  document.querySelectorAll('.step').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.dataset.target || 'f-weight');
      input.value = Math.max(0, round((parseFloat(input.value) || 0) + parseFloat(btn.dataset.step)));
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!selected) { openSheet(); return; }

    var weight = parseFloat($('f-weight').value);
    var reps = parseInt($('f-reps').value, 10);
    if (!isFinite(weight) || !reps) return;

    var before = D.levelFor(D.xpBreakdown(state.sets).total).level;
    var prevBest = bestE1rm(selected);

    state.sets.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      date: fDate.value || D.todayISO(),
      exercise: selected,
      weight: weight,
      reps: reps,
      rpe: $('f-rpe').value ? parseFloat($('f-rpe').value) : null,
      notes: $('f-notes').value.trim() || ''
    });
    persist();

    $('f-notes').value = '';
    startTimer();
    renderLog();
    renderStreakChip();

    var after = D.levelFor(D.xpBreakdown(state.sets).total).level;
    var isPr = prevBest > 0 && D.e1rm(weight, reps) > prevBest + 0.01;

    if (after > before) toast('LEVEL UP — ' + D.levelFor(D.xpBreakdown(state.sets).total).rank, true);
    else if (isPr) toast('NEW PR on ' + selected, true);
    else toast('Set added');
  });

  $('repeatBtn').addEventListener('click', function () {
    var last = state.sets[state.sets.length - 1];
    if (!last) return;
    if (!selected) choose(last.exercise);
    $('f-weight').value = last.weight;
    $('f-reps').value = last.reps;
    form.requestSubmit();
  });

  function bestE1rm(name) {
    return state.sets.reduce(function (m, s) {
      return s.exercise === name ? Math.max(m, D.e1rm(s.weight, s.reps)) : m;
    }, 0);
  }

  function renderSetGroups(container, sets) {
    var groups = {}, order = [];
    sets.forEach(function (s) {
      if (!groups[s.exercise]) { groups[s.exercise] = []; order.push(s.exercise); }
      groups[s.exercise].push(s);
    });

    container.innerHTML = '';
    order.forEach(function (name) {
      var rows = groups[name];
      var best = bestE1rm(name);

      var wrap = document.createElement('div');
      wrap.className = 'group';
      wrap.innerHTML = '<div class="group-head"><span>' + esc(name) + '</span>' +
        '<span class="meta">' + rows.length + ' set' + (rows.length === 1 ? '' : 's') +
        ' · ' + num(D.volume(rows)) + ' ' + unit() + '</span></div>';

      rows.forEach(function (s, i) {
        var est = D.e1rm(s.weight, s.reps);
        var isPr = best > 0 && Math.abs(est - best) < 0.01;

        var row = document.createElement('div');
        row.className = 'set-row';
        row.innerHTML =
          '<span class="set-n">' + (i + 1) + '</span>' +
          '<span class="set-main"><b>' + num(s.weight) + '</b> ' + unit() + ' × ' + s.reps +
            (s.rpe ? ' <span class="set-sub">@ ' + s.rpe + '</span>' : '') +
            (s.notes ? '<div class="set-sub">' + esc(s.notes) + '</div>' : '') +
          '</span>' +
          (isPr ? '<span class="pr-badge">PR</span>' : '') +
          '<span class="set-e1rm">' + num(est) + '</span>';

        var del = document.createElement('button');
        del.className = 'del';
        del.type = 'button';
        del.innerHTML = '&times;';
        del.setAttribute('aria-label', 'Delete set');
        del.addEventListener('click', function () {
          state.sets = state.sets.filter(function (x) { return x.id !== s.id; });
          persist();
          renderLog();
          renderStreakChip();
          if (currentView === 'history') renderHistory();
          if (currentView === 'progress') renderProgress();
          toast('Set deleted');
        });
        row.appendChild(del);
        wrap.appendChild(row);
      });

      container.appendChild(wrap);
    });
  }

  function renderLog() {
    var date = fDate.value || D.todayISO();
    var sets = state.sets.filter(function (s) { return s.date === date; });

    $('todayLabel').textContent = fmtDay(date);
    $('repeatBtn').disabled = state.sets.length === 0;

    var list = $('todayList');
    if (!sets.length) {
      list.innerHTML = '<div class="empty">Nothing logged yet.</div>';
      $('todayMeta').textContent = '';
      return;
    }
    $('todayMeta').textContent = sets.length + ' sets · ' + num(D.volume(sets)) + ' ' + unit();
    renderSetGroups(list, sets);
  }

  fDate.addEventListener('change', renderLog);

  /* ── History ───────────────────────────────────────────── */
  function renderHistory() {
    var list = $('historyList');
    var byDate = {};
    state.sets.forEach(function (s) { (byDate[s.date] = byDate[s.date] || []).push(s); });
    var dates = Object.keys(byDate).sort().reverse();

    if (!dates.length) {
      list.innerHTML = '<div class="empty">No sessions yet.<br>Log a set to get started.</div>';
      return;
    }

    list.innerHTML = '';
    dates.forEach(function (date, i) {
      var sets = byDate[date];
      var names = sets.map(function (s) { return s.exercise; })
                      .filter(function (v, j, a) { return a.indexOf(v) === j; });

      var det = document.createElement('details');
      det.className = 'group';
      if (i === 0) det.open = true;

      var sum = document.createElement('summary');
      sum.className = 'group-head';
      sum.innerHTML = '<span>' + fmtDay(date) + '</span><span class="meta">' +
        names.length + ' lift' + (names.length > 1 ? 's' : '') + ' · ' +
        num(D.volume(sets)) + ' ' + unit() + '</span>';
      det.appendChild(sum);

      var body = document.createElement('div');
      renderSetGroups(body, sets);
      det.appendChild(body);
      list.appendChild(det);
    });
  }

  /* ── Progress ──────────────────────────────────────────── */
  var pSelect = $('p-exercise');
  pSelect.addEventListener('change', renderProgress);

  function renderProgress() {
    var names = recentExercises().sort();
    var body = $('progressBody');

    if (!names.length) {
      pSelect.innerHTML = '';
      body.innerHTML = '<div class="empty">Log a few sets and your charts appear here.</div>';
      return;
    }

    var chosen = names.indexOf(pSelect.value) > -1 ? pSelect.value : names[0];
    pSelect.innerHTML = names.map(function (n) {
      return '<option' + (n === chosen ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('');

    var sets = state.sets.filter(function (s) { return s.exercise === chosen; });

    /* One point per session: that day's best estimated 1RM. */
    var perDay = {};
    sets.forEach(function (s) {
      var est = D.e1rm(s.weight, s.reps);
      if (!perDay[s.date] || est > perDay[s.date].est) perDay[s.date] = { est: est, set: s };
    });
    var days = Object.keys(perDay).sort();
    var points = days.map(function (d) {
      return {
        x: D.isoToMs(d), y: round(perDay[d].est),
        label: num(perDay[d].est) + ' ' + unit() + ' est. 1RM<br>' +
               num(perDay[d].set.weight) + ' × ' + perDay[d].set.reps
      };
    });

    var bestEst = Math.max.apply(null, points.map(function (p) { return p.y; }));
    var heaviest = sets.reduce(function (m, s) { return s.weight > m.weight ? s : m; }, sets[0]);

    body.innerHTML =
      '<div class="tiles">' +
        tile('Est. 1RM', num(bestEst), unit()) +
        tile('Heaviest', num(heaviest.weight) + '×' + heaviest.reps, '') +
        tile('Volume', num(D.volume(sets)), unit()) +
        tile('Sessions', days.length, '') +
      '</div>' +
      '<div class="chart-wrap" id="chartWrap"></div>' +
      '<button type="button" class="table-toggle" id="tableToggle">Show data table</button>' +
      '<div id="tableBody" hidden></div>' +
      '<div class="section-head"><h2>Best by reps</h2></div>' +
      prTable(sets);

    window.LiftChart.render($('chartWrap'), points, {
      title: 'Estimated 1RM — ' + chosen + ' (' + unit() + ')'
    });

    var tb = $('tableBody');
    tb.innerHTML = '<div class="card"><table><thead><tr><th>Date</th><th>Top set</th>' +
      '<th>Est. 1RM</th></tr></thead><tbody>' +
      days.slice().reverse().map(function (d) {
        return '<tr><td>' + fmtDay(d) + '</td><td>' + num(perDay[d].set.weight) +
               ' × ' + perDay[d].set.reps + '</td><td>' + num(perDay[d].est) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    $('tableToggle').addEventListener('click', function () {
      tb.hidden = !tb.hidden;
      this.textContent = tb.hidden ? 'Show data table' : 'Hide data table';
    });
  }

  function tile(label, value, u) {
    return '<div class="tile"><div class="tile-label">' + label + '</div><div class="tile-value">' +
           value + (u ? ' <span class="tile-unit">' + u + '</span>' : '') + '</div></div>';
  }

  function prTable(sets) {
    var best = {};
    sets.forEach(function (s) { if (!best[s.reps] || s.weight > best[s.reps].weight) best[s.reps] = s; });
    var reps = Object.keys(best).map(Number).sort(function (a, b) { return a - b; });
    if (!reps.length) return '';
    return '<div class="card"><table><thead><tr><th>Reps</th><th>Weight</th><th>When</th>' +
      '</tr></thead><tbody>' + reps.map(function (r) {
        return '<tr><td>' + r + '</td><td>' + num(best[r].weight) + ' ' + unit() +
               '</td><td>' + fmtDay(best[r].date) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── You ───────────────────────────────────────────────── */
  function renderYou() {
    var xp = D.xpBreakdown(state.sets);
    var lv = D.levelFor(xp.total);
    var st = D.streak(state.sets);
    var total = D.volume(state.sets);

    $('rankName').textContent = lv.rank;
    $('levelN').textContent = lv.level;
    $('levelBadge').textContent = lv.level;
    $('xpInto').textContent = num(xp.total) + ' XP';
    $('xpNext').textContent = num(lv.need - lv.into) + ' to level ' + (lv.level + 1);
    $('xpBreakdown').innerHTML =
      '<span><b>' + num(xp.volume) + '</b> from volume</span>' +
      '<span><b>' + num(xp.sessions) + '</b> from sessions</span>' +
      '<span><b>' + num(xp.prs) + '</b> from ' + xp.prCount + ' PRs</span>';
    /* Next frame, so the bar animates from empty rather than jumping. */
    requestAnimationFrame(function () { $('xpFill').style.width = (lv.pct * 100) + '%'; });

    $('tonnage').textContent = num(total);
    $('tonnageNote').textContent = state.unit === 'lbs' ? D.compare(total) : D.compare(total * 2.205);

    $('streakCur').innerHTML = st.current + ' <span class="tile-unit">wks</span>';
    $('streakBest').innerHTML = st.best + ' <span class="tile-unit">wks</span>';
    $('statSessions').textContent = D.sessionDates(state.sets).length;
    $('statPrs').textContent = xp.prCount;

    renderWeeks();
    renderBodyweight();

    document.querySelectorAll('.seg').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit));
    });
    $('dataStats').textContent = state.sets.length + ' sets · ' +
      recentExercises().length + ' exercises · ' + state.bodyweight.length + ' weigh-ins';
  }

  /* Last 16 weeks, shaded by how many sessions each contained. */
  function renderWeeks() {
    var counts = {};
    state.sets.forEach(function (s) {
      var w = Math.floor(D.isoToMs(s.date) / 604800000);
      (counts[w] = counts[w] || {})[s.date] = true;
    });

    var nowWeek = Math.floor(D.isoToMs(D.todayISO()) / 604800000);
    var cells = '';
    for (var i = 15; i >= 0; i--) {
      var n = Object.keys(counts[nowWeek - i] || {}).length;
      cells += '<div class="week' + (n >= 3 ? ' hot' : n > 0 ? ' on' : '') +
               '" title="' + n + ' session' + (n === 1 ? '' : 's') + '"></div>';
    }
    $('weekGrid').innerHTML = '<div class="weeks">' + cells + '</div>' +
      '<div class="week-key"><span>16 weeks ago</span><span>This week</span></div>';
  }

  /* ── Bodyweight ────────────────────────────────────────── */
  var bwForm = $('bwForm');
  $('bw-date').value = D.todayISO();

  bwForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var w = parseFloat($('bw-weight').value);
    var date = $('bw-date').value || D.todayISO();
    if (!isFinite(w) || w <= 0) return;

    /* One reading per day — a re-log replaces it. */
    state.bodyweight = state.bodyweight.filter(function (b) { return b.date !== date; });
    state.bodyweight.push({ id: date, date: date, weight: w });
    state.bodyweight.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    persist();

    $('bw-weight').value = '';
    renderYou();
    toast('Weight logged');
  });

  function renderBodyweight() {
    var log = state.bodyweight;
    var meta = $('bwMeta');

    if (!log.length) {
      meta.textContent = '';
      $('bwChart').innerHTML = '<div class="empty">Log your weight to see the trend.</div>';
      $('bwList').innerHTML = '';
      return;
    }

    var latest = log[log.length - 1];
    var first = log[0];
    var delta = latest.weight - first.weight;
    meta.textContent = num(latest.weight) + ' ' + unit() +
      (log.length > 1 ? '  ·  ' + (delta >= 0 ? '+' : '') + num(delta) + ' overall' : '');

    window.LiftChart.render($('bwChart'), log.map(function (b) {
      return { x: D.isoToMs(b.date), y: b.weight, label: num(b.weight) + ' ' + unit() };
    }), { title: 'Bodyweight (' + unit() + ')', color: 'var(--cyan)' });

    /* Just the recent ones — the chart covers the rest. */
    var recent = log.slice(-5).reverse();
    var wrap = document.createElement('div');
    wrap.className = 'group';
    recent.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = '<span class="set-main"><b>' + num(b.weight) + '</b> ' + unit() +
                      '</span><span class="set-e1rm">' + fmtDay(b.date) + '</span>';
      var del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.innerHTML = '&times;';
      del.setAttribute('aria-label', 'Delete entry');
      del.addEventListener('click', function () {
        state.bodyweight = state.bodyweight.filter(function (x) { return x.date !== b.date; });
        persist();
        renderYou();
      });
      row.appendChild(del);
      wrap.appendChild(row);
    });
    $('bwList').innerHTML = '';
    $('bwList').appendChild(wrap);
  }

  /* ── Streak chip ───────────────────────────────────────── */
  function renderStreakChip() {
    var st = D.streak(state.sets);
    $('streakChip').hidden = st.current < 1;
    $('streakN').textContent = st.current;
  }

  /* ── Settings & data ───────────────────────────────────── */
  document.querySelectorAll('.seg').forEach(function (b) {
    b.addEventListener('click', function () {
      state.unit = b.dataset.unit;
      persist();
      document.querySelectorAll('.unit-label').forEach(function (u) { u.textContent = state.unit; });
      renderYou();
      renderLog();
      toast('Units set to ' + state.unit + ' — existing numbers unchanged');
    });
  });

  function download(filename, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  $('exportJson').addEventListener('click', function () {
    download('lift-tracker-' + D.todayISO() + '.json', JSON.stringify(state, null, 2), 'application/json');
  });

  $('exportCsv').addEventListener('click', function () {
    var rows = [['date', 'muscle_group', 'exercise', 'weight', 'unit', 'reps', 'rpe', 'est_1rm', 'notes']];
    state.sets.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (s) {
      rows.push([s.date, D.groupOf(s.exercise), s.exercise, s.weight, state.unit,
                 s.reps, s.rpe || '', round(D.e1rm(s.weight, s.reps)), s.notes || '']);
    });
    download('lift-tracker-' + D.todayISO() + '.csv',
      rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n'), 'text/csv');
  });

  var importFile = $('importFile');
  $('importBtn').addEventListener('click', function () { importFile.click(); });

  importFile.addEventListener('change', function () {
    var file = importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.sets)) throw new Error('Not a backup file');
        if (state.sets.length &&
            !confirm('Replace your ' + state.sets.length + ' sets with ' +
                     data.sets.length + ' from this file?')) return;
        state = {
          v: 2, unit: data.unit || 'lbs', sets: data.sets,
          bodyweight: Array.isArray(data.bodyweight) ? data.bodyweight : [],
          goals: data.goals || {}
        };
        persist();
        boot();
        toast('Imported ' + data.sets.length + ' sets');
      } catch (err) {
        toast('That file could not be read');
        console.error(err);
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  $('clearBtn').addEventListener('click', function () {
    if (!state.sets.length && !state.bodyweight.length) return toast('Nothing to delete');
    if (!confirm('Delete everything? This cannot be undone.')) return;
    if (!confirm('Really? Export a backup first if there is any chance you want it.')) return;
    state = { v: 2, unit: state.unit, sets: [], bodyweight: [], goals: {} };
    persist();
    boot();
    toast('All data deleted');
  });

  /* Re-render charts when the viewport width changes. */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (currentView === 'progress') renderProgress();
      if (currentView === 'you') renderYou();
    }, 150);
  });

  /* ── Boot ──────────────────────────────────────────────── */
  function boot() {
    document.querySelectorAll('.unit-label').forEach(function (u) { u.textContent = state.unit; });
    renderLog();
    renderStreakChip();
    if (currentView === 'history') renderHistory();
    if (currentView === 'progress') renderProgress();
    if (currentView === 'you') renderYou();
  }

  boot();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  }
})();
