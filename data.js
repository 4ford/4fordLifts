/* Storage, the exercise library, and all the derived numbers
   (tonnage, streaks, XP, plateaus) that the views read. */
(function () {
  'use strict';

  var KEY = 'lift-tracker/v1';

  /* ── Exercise library ──────────────────────────────────── */
  var LIBRARY = [
    { group: 'Chest', exercises: [
      'Bench Press', 'Incline Bench Press', 'Decline Bench Press',
      'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly',
      'Cable Fly', 'Machine Chest Press', 'Pec Deck', 'Push-up', 'Dip'
    ]},
    { group: 'Back', exercises: [
      'Deadlift', 'Barbell Row', 'Pendlay Row', 'Dumbbell Row',
      'T-Bar Row', 'Seated Cable Row', 'Lat Pulldown', 'Pull-up',
      'Chin-up', 'Rack Pull', 'Shrug', 'Face Pull', 'Straight-Arm Pulldown'
    ]},
    { group: 'Shoulders', exercises: [
      'Overhead Press', 'Push Press', 'Dumbbell Shoulder Press',
      'Arnold Press', 'Machine Shoulder Press', 'Lateral Raise',
      'Cable Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Upright Row'
    ]},
    { group: 'Arms', exercises: [
      'Barbell Curl', 'EZ Bar Curl', 'Dumbbell Curl', 'Hammer Curl',
      'Preacher Curl', 'Incline Dumbbell Curl', 'Cable Curl', 'Concentration Curl',
      'Close-Grip Bench Press', 'Skullcrusher', 'Tricep Pushdown',
      'Overhead Tricep Extension', 'Machine Tricep Press', 'Bench Dip'
    ]},
    { group: 'Legs', exercises: [
      'Back Squat', 'Front Squat', 'Hack Squat', 'Leg Press',
      'Romanian Deadlift', 'Stiff-Leg Deadlift', 'Lunge', 'Bulgarian Split Squat',
      'Leg Extension', 'Leg Curl', 'Hip Thrust', 'Good Morning',
      'Calf Raise', 'Seated Calf Raise', 'Goblet Squat'
    ]},
    { group: 'Core', exercises: [
      'Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel',
      'Russian Twist', 'Decline Sit-up', 'Wood Chop', 'Back Extension'
    ]}
  ];

  /* Reverse index so a logged lift can show its muscle group. */
  var GROUP_OF = {};
  LIBRARY.forEach(function (g) {
    g.exercises.forEach(function (e) { GROUP_OF[e] = g.group; });
  });

  /* ── Storage ───────────────────────────────────────────── */
  function load() {
    var base = {
      v: 4, unit: 'lbs', sets: [], bodyweight: [], goals: {}, custom: [],
      profile: { name: '', theme: 'volt' }
    };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var p = JSON.parse(raw);
      if (!p || !Array.isArray(p.sets)) return base;
      /* v1 had no bodyweight log; v2 had no profile; v3 had no custom lifts. */
      return {
        v: 4,
        unit: p.unit || 'lbs',
        sets: p.sets,
        bodyweight: Array.isArray(p.bodyweight) ? p.bodyweight : [],
        goals: p.goals || {},
        custom: Array.isArray(p.custom) ? p.custom : [],
        profile: {
          name: (p.profile && p.profile.name) || '',
          theme: (p.profile && p.profile.theme) || 'volt'
        }
      };
    } catch (e) {
      console.warn('Could not read saved data:', e);
      return base;
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Could not save:', e);
      return false;
    }
  }

  /* ── Dates ─────────────────────────────────────────────── */
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* Local-time parse — new Date('2026-09-23') is UTC and can land
     a day early west of Greenwich. */
  function isoToMs(iso) {
    var p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }

  /* Monday-based week index, used for the training streak. */
  function weekIndex(iso) {
    var d = new Date(isoToMs(iso));
    var day = (d.getDay() + 6) % 7;          // Mon = 0
    d.setDate(d.getDate() - day);
    return Math.floor(d.getTime() / 604800000);
  }

  /* ── Lift math ─────────────────────────────────────────── */
  function e1rm(weight, reps) {
    return reps === 1 ? weight : weight * (1 + reps / 30);
  }

  function volume(sets) {
    return sets.reduce(function (v, s) { return v + s.weight * s.reps; }, 0);
  }

  function sessionDates(sets) {
    var seen = {};
    sets.forEach(function (s) { seen[s.date] = true; });
    return Object.keys(seen).sort();
  }

  /* Consecutive weeks containing at least one session, counting back
     from this week. The current week doesn't break the streak until
     it ends, so an untrained Monday doesn't wipe out 12 weeks. */
  function streak(sets) {
    var weeks = {};
    sets.forEach(function (s) { weeks[weekIndex(s.date)] = true; });
    var now = weekIndex(todayISO());

    var current = 0;
    var w = weeks[now] ? now : now - 1;
    while (weeks[w]) { current++; w--; }

    var keys = Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; });
    var best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      run = (prev !== null && k === prev + 1) ? run + 1 : 1;
      if (run > best) best = run;
      prev = k;
    });

    return { current: current, best: Math.max(best, current) };
  }

  /* ── XP & levels ───────────────────────────────────────── */
  /* Volume is the bulk of it, with a bonus for showing up and for
     beating a lift's previous best. */
  var XP_PER_VOLUME = 0.02;   // 50 lbs moved = 1 XP
  var XP_PER_SESSION = 25;
  var XP_PER_PR = 50;

  function xpBreakdown(sets) {
    var vol = Math.round(volume(sets) * XP_PER_VOLUME);
    var sessions = sessionDates(sets).length * XP_PER_SESSION;

    /* A PR is any set that beat the best e1RM for that lift at the
       time it was logged — so the count only ever grows. */
    var best = {};
    var prs = 0;
    sets.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .forEach(function (s) {
        var est = e1rm(s.weight, s.reps);
        if (best[s.exercise] === undefined) { best[s.exercise] = est; return; }
        if (est > best[s.exercise] + 0.01) { best[s.exercise] = est; prs++; }
      });

    return {
      volume: vol,
      sessions: sessions,
      prs: prs * XP_PER_PR,
      prCount: prs,
      total: vol + sessions + prs * XP_PER_PR
    };
  }

  /* Each level costs a bit more than the last. */
  function xpForLevel(n) {
    return n <= 1 ? 0 : Math.round(300 * Math.pow(n - 1, 1.45));
  }

  var RANKS = [
    'Untrained', 'Novice', 'Beginner', 'Apprentice', 'Intermediate',
    'Seasoned', 'Advanced', 'Strong', 'Veteran', 'Elite',
    'Beast', 'Monster', 'Titan', 'Freak', 'Legend'
  ];

  function levelFor(xp) {
    var n = 1;
    while (xpForLevel(n + 1) <= xp && n < 99) n++;
    var floor = xpForLevel(n);
    var ceil = xpForLevel(n + 1);
    return {
      level: n,
      rank: RANKS[Math.min(n - 1, RANKS.length - 1)],
      into: xp - floor,
      need: ceil - floor,
      pct: Math.max(0, Math.min(1, (xp - floor) / (ceil - floor)))
    };
  }

  /* ── Plateaus ──────────────────────────────────────────── */
  /* A session counts as progress if any set in it was a weight PR
     (heaviest ever), a rep PR (more reps at a weight than ever done at
     that weight or heavier), or a new best e1RM — the last so a set
     wearing a PR badge can never sit on a plateau. Rep PRs only count
     at a weight lifted before, or a first-ever light warm-up would
     "beat" every heavier set on reps.

     Stalling and plateau each need a session count *and* a time span,
     so three sessions in one week — or one session a month — can't
     trip them on their own. */
  var STALL = { sessions: 3, weeks: 2 };
  var PLATEAU = { sessions: 5, weeks: 4 };
  var MIN_SESSIONS = 4;       // fewer than this and there's no trend to read
  var DORMANT_WEEKS = 6;      // not trained lately: parked, not plateaued

  /* When one set qualifies several ways, report the plainest. */
  var PR_RANK = { weight: 0, reps: 1, e1rm: 2 };

  function plateau(sets, name) {
    var byDay = {};
    sets.forEach(function (s) {
      if (s.exercise === name) (byDay[s.date] = byDay[s.date] || []).push(s);
    });
    var days = Object.keys(byDay).sort();
    if (days.length < MIN_SESSIONS) {
      return { status: 'new', sessions: days.length, need: MIN_SESSIONS - days.length };
    }

    var heaviest = 0, best = 0;
    var repsAt = {};              // weight -> most reps ever done at it
    var perDay = {};              // date -> that session's best e1RM
    var lastIdx = 0, last = null;

    function mostRepsFrom(w) {
      var m = 0;
      for (var k in repsAt) if (+k >= w && repsAt[k] > m) m = repsAt[k];
      return m;
    }

    days.forEach(function (d, i) {
      /* Judge every set against history from *before* this session. */
      var hit = null;
      byDay[d].forEach(function (s) {
        var est = e1rm(s.weight, s.reps);
        perDay[d] = Math.max(perDay[d] || 0, est);
        if (i === 0) return;
        var kind = s.weight > heaviest ? 'weight'
                 : repsAt[s.weight] !== undefined && s.reps > mostRepsFrom(s.weight) ? 'reps'
                 : est > best + 0.01 ? 'e1rm' : null;
        if (kind && (!hit || PR_RANK[kind] < PR_RANK[hit.kind])) hit = { kind: kind, set: s };
      });
      if (i === 0) hit = { kind: 'first', set: byDay[d][0] };
      if (hit) { lastIdx = i; last = hit; }

      byDay[d].forEach(function (s) {
        heaviest = Math.max(heaviest, s.weight);
        best = Math.max(best, e1rm(s.weight, s.reps));
        repsAt[s.weight] = Math.max(repsAt[s.weight] || 0, s.reps);
      });
    });

    var today = isoToMs(todayISO());
    var lastDay = days[lastIdx];
    var since = days.length - 1 - lastIdx;
    var weeks = (today - isoToMs(lastDay)) / 604800000;
    var idle = (today - isoToMs(days[days.length - 1])) / 604800000;

    /* How far the last few sessions sit under the peak — separates
       "holding steady" from "sliding backwards". */
    var recent = Math.max.apply(null, days.slice(-3).map(function (d) { return perDay[d]; }));

    var status = 'progressing';
    if (idle >= DORMANT_WEEKS) status = 'dormant';
    else if (since >= PLATEAU.sessions && weeks >= PLATEAU.weeks) status = 'plateau';
    else if (since >= STALL.sessions && weeks >= STALL.weeks) status = 'stalling';

    return {
      status: status,
      sessions: days.length,
      best: best,
      last: { date: lastDay, kind: last.kind, weight: last.set.weight, reps: last.set.reps },
      since: since,
      weeks: Math.floor(weeks),
      idleWeeks: Math.floor(idle),
      off: best > 0 ? 1 - recent / best : 0
    };
  }

  /* A lifetime-tonnage number means nothing on its own — anchor it. */
  /* Rough real-world weights, spaced so there's always a next one in
     reach — a single session lands around the car/truck rungs. */
  var COMPARISONS = [
    { lbs: 65,       one: 'a golden retriever',   many: 'golden retrievers' },
    { lbs: 600,      one: 'a grizzly bear',       many: 'grizzly bears' },
    { lbs: 1000,     one: 'a grand piano',        many: 'grand pianos' },
    { lbs: 3000,     one: 'a car',                many: 'cars' },
    { lbs: 5000,     one: 'a pickup truck',       many: 'pickup trucks' },
    { lbs: 13000,    one: 'an elephant',          many: 'elephants' },
    { lbs: 33000,    one: 'a school bus',         many: 'school buses' },
    { lbs: 80000,    one: 'a loaded semi truck',  many: 'loaded semi trucks' },
    { lbs: 300000,   one: 'a blue whale',         many: 'blue whales' },
    { lbs: 450000,   one: 'the Statue of Liberty', many: 'Statues of Liberty' },
    { lbs: 925000,   one: 'the Space Station',    many: 'Space Stations' },
    { lbs: 22000000, one: 'the Eiffel Tower',     many: 'Eiffel Towers' }
  ];

  function compare(lbs) {
    if (lbs <= 0) return '';
    var pick = COMPARISONS[0];
    for (var i = 0; i < COMPARISONS.length; i++) {
      if (lbs / COMPARISONS[i].lbs >= 1) pick = COMPARISONS[i];
    }
    var n = lbs / pick.lbs;
    var label = n >= 1.1 ? (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + ' ' + pick.many
                         : 'about ' + pick.one;
    return 'That’s ' + label + '.';
  }

  /* The next rung up, and how far along the way to it you are. */
  function nextMilestone(lbs) {
    for (var i = 0; i < COMPARISONS.length; i++) {
      if (COMPARISONS[i].lbs > lbs) {
        return { one: COMPARISONS[i].one, lbs: COMPARISONS[i].lbs,
                 left: COMPARISONS[i].lbs - lbs, pct: Math.max(0, lbs) / COMPARISONS[i].lbs };
      }
    }
    return null;
  }

  var THEMES = [
    { id: 'volt',  label: 'Volt',  a1: '#ccff33', a2: '#b14aff' },
    { id: 'ultra', label: 'Ultra', a1: '#b14aff', a2: '#2ee6d6' },
    { id: 'ice',   label: 'Ice',   a1: '#2ee6d6', a2: '#ff4fd8' },
    { id: 'ember', label: 'Ember', a1: '#ff9d2e', a2: '#b14aff' },
    { id: 'neon',  label: 'Neon',  a1: '#ff2e97', a2: '#ccff33' }
  ];

  window.LiftData = {
    KEY: KEY,
    LIBRARY: LIBRARY,
    THEMES: THEMES,
    groupOf: function (name) { return GROUP_OF[name] || 'Other'; },
    load: load,
    save: save,
    todayISO: todayISO,
    isoToMs: isoToMs,
    e1rm: e1rm,
    volume: volume,
    sessionDates: sessionDates,
    streak: streak,
    xpBreakdown: xpBreakdown,
    levelFor: levelFor,
    xpForLevel: xpForLevel,
    plateau: plateau,
    compare: compare,
    nextMilestone: nextMilestone
  };
})();
