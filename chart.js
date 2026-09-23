/* Minimal dependency-free SVG line chart.
   One series, so there is no legend — the title names it.
   Marks follow the house spec: 2px line, 8px markers with a 2px
   surface ring, hairline grid, one direct label on the newest point,
   and a crosshair + tooltip on hover/touch. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PAD = { top: 18, right: 58, bottom: 26, left: 44 };
  var HEIGHT = 240;

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* Round a range outward to friendly tick values. */
  function niceScale(min, max, count) {
    if (min === max) { min -= 5; max += 5; }
    var raw = (max - min) / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return { min: lo, max: hi, ticks: ticks };
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* points: [{ x: epochMs, y: Number, label: String }] */
  function render(wrap, points, opts) {
    opts = opts || {};
    wrap.innerHTML = '';

    if (!points.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No data yet.';
      wrap.appendChild(empty);
      return;
    }

    if (opts.title) {
      var t = document.createElement('div');
      t.className = 'chart-title';
      t.textContent = opts.title;
      wrap.appendChild(t);
    }

    var W = Math.max(280, wrap.clientWidth - 16);
    var H = HEIGHT;
    var plotW = W - PAD.left - PAD.right;
    var plotH = H - PAD.top - PAD.bottom;

    var ys = points.map(function (p) { return p.y; });
    var scale = niceScale(Math.min.apply(null, ys), Math.max.apply(null, ys), 4);

    var xMin = points[0].x;
    var xMax = points[points.length - 1].x;
    var xSpan = xMax - xMin || 1;

    function sx(x) {
      return points.length === 1
        ? PAD.left + plotW / 2
        : PAD.left + ((x - xMin) / xSpan) * plotW;
    }
    function sy(y) {
      return PAD.top + plotH - ((y - scale.min) / (scale.max - scale.min)) * plotH;
    }

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      width: W, height: H,
      role: 'img',
      'aria-label': opts.title || 'Progress chart'
    });

    /* Soft fill under the line — decorative, kept well below the ink. */
    var defs = el('defs');
    var grad = el('linearGradient', { id: 'lt-fade', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': 'var(--series-1)', 'stop-opacity': 0.22 }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': 'var(--series-1)', 'stop-opacity': 0 }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    /* Gridlines + y labels */
    scale.ticks.forEach(function (v) {
      var y = sy(v);
      svg.appendChild(el('line', {
        x1: PAD.left, y1: y, x2: W - PAD.right, y2: y,
        stroke: 'var(--grid)', 'stroke-width': 1
      }));
      var lbl = el('text', {
        x: PAD.left - 10, y: y + 4,
        'text-anchor': 'end',
        fill: 'var(--muted)', 'font-size': 11
      });
      lbl.textContent = v;
      svg.appendChild(lbl);
    });

    /* Baseline */
    svg.appendChild(el('line', {
      x1: PAD.left, y1: PAD.top + plotH, x2: W - PAD.right, y2: PAD.top + plotH,
      stroke: 'var(--axis)', 'stroke-width': 1
    }));

    /* X labels — first, last, and a midpoint when there is room */
    var xIdx = points.length > 3 ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
                                 : points.map(function (_, i) { return i; });
    xIdx.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i) {
      var x = sx(points[i].x);
      var lbl = el('text', {
        x: x, y: H - 8,
        'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
        fill: 'var(--muted)', 'font-size': 11
      });
      lbl.textContent = fmtDate(points[i].x);
      svg.appendChild(lbl);
    });

    if (points.length > 1) {
      var d = points.map(function (p, i) {
        return (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1);
      }).join(' ');

      svg.appendChild(el('path', {
        d: d + ' L' + sx(xMax).toFixed(1) + ' ' + (PAD.top + plotH) +
           ' L' + sx(xMin).toFixed(1) + ' ' + (PAD.top + plotH) + ' Z',
        fill: 'url(#lt-fade)', stroke: 'none'
      }));

      svg.appendChild(el('path', {
        d: d, fill: 'none',
        stroke: 'var(--series-1)', 'stroke-width': 2,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    }

    /* Crosshair sits under the markers so it never hides one. */
    var cross = el('line', {
      y1: PAD.top, y2: PAD.top + plotH,
      stroke: 'var(--axis)', 'stroke-width': 1, opacity: 0
    });
    svg.appendChild(cross);

    /* Markers: 2px surface ring keeps them legible where the line doubles back. */
    var dots = points.map(function (p) {
      var g = el('circle', {
        cx: sx(p.x), cy: sy(p.y), r: 4,
        fill: 'var(--series-1)',
        stroke: 'var(--surface-1)', 'stroke-width': 2
      });
      svg.appendChild(g);
      return g;
    });

    /* One direct label, on the newest point only. */
    var last = points[points.length - 1];
    var lastLbl = el('text', {
      x: Math.min(sx(last.x) + 9, W - 4), y: sy(last.y) + 4,
      'text-anchor': sx(last.x) + 9 > W - PAD.right ? 'end' : 'start',
      fill: 'var(--text-primary)', 'font-size': 12, 'font-weight': 600
    });
    lastLbl.textContent = Math.round(last.y * 10) / 10;
    svg.appendChild(lastLbl);

    wrap.appendChild(svg);

    /* ── Hover layer ─────────────────────────────────────── */
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    wrap.appendChild(tip);

    function nearest(clientX) {
      var rect = svg.getBoundingClientRect();
      var px = (clientX - rect.left) * (W / rect.width);
      var best = 0, bestD = Infinity;
      points.forEach(function (p, i) {
        var d = Math.abs(sx(p.x) - px);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }

    function show(e) {
      var i = nearest(e.clientX);
      var p = points[i];
      var x = sx(p.x), y = sy(p.y);

      cross.setAttribute('x1', x);
      cross.setAttribute('x2', x);
      cross.setAttribute('opacity', 1);
      dots.forEach(function (dot, j) { dot.setAttribute('r', j === i ? 6 : 4); });

      tip.innerHTML = '<div class="tip-date">' + fmtDate(p.x) + '</div>' +
                      '<div class="tip-value">' + (p.label || p.y) + '</div>';
      tip.classList.add('show');

      var rect = svg.getBoundingClientRect();
      var scaleX = rect.width / W;
      var left = x * scaleX;
      tip.style.left = Math.max(4, Math.min(left - tip.offsetWidth / 2, rect.width - tip.offsetWidth - 4)) + 'px';
      tip.style.top = Math.max(0, y * scaleX - tip.offsetHeight - 12) + 'px';
    }

    function hide() {
      cross.setAttribute('opacity', 0);
      dots.forEach(function (dot) { dot.setAttribute('r', 4); });
      tip.classList.remove('show');
    }

    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  }

  window.LiftChart = { render: render };
})();
