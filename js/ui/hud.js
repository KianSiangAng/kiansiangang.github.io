/* ================================================================
   HUD.JS — Performance heads-up display

   Press ` (backtick) or run `perf` in the terminal. Shows what the
   frame loop is actually costing: FPS, per-frame render time, live
   particle count, the graphics backend in use, the module boot
   report and — where the browser exposes it — JS heap size.

   Kept deliberately cheap: it only redraws when the gfx module
   publishes a stats sample (twice a second), never per frame.
================================================================ */

export function createHUD({ bus, kernel }) {
  const panel = document.createElement('aside');
  panel.className = 'hud';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Performance heads-up display');

  const title = document.createElement('header');
  title.className = 'hud__title';
  title.textContent = 'perf ▸ press ` to close';

  const body = document.createElement('dl');
  body.className = 'hud__body';

  const graph = document.createElement('canvas');
  graph.className = 'hud__graph';
  graph.width = 220;
  graph.height = 40;

  panel.append(title, graph, body);
  document.body.appendChild(panel);

  const ctx = graph.getContext('2d');
  const samples = new Array(55).fill(60);

  function row(term, value) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    body.append(dt, dd);
  }

  function drawGraph() {
    ctx.clearRect(0, 0, graph.width, graph.height);

    // 60fps reference line
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, graph.height - (60 / 70) * graph.height);
    ctx.lineTo(graph.width, graph.height - (60 / 70) * graph.height);
    ctx.stroke();

    ctx.beginPath();
    samples.forEach((fps, index) => {
      const x = (index / (samples.length - 1)) * graph.width;
      const y = graph.height - (Math.min(fps, 70) / 70) * graph.height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const worst = Math.min(...samples);
    ctx.strokeStyle = worst < 30 ? '#ff6b6b' : worst < 50 ? '#ffd166' : '#3bff88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function update(stats) {
    if (panel.hidden) return;
    body.replaceChildren();
    row('fps', String(stats.fps));
    row('frame', `${stats.frameMs.toFixed(2)} ms`);
    row('backend', stats.backend);
    row('particles', String(stats.petals));
    row('frames', String(stats.frames));

    const memory = performance.memory;
    if (memory) row('heap', `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MB`);

    const report = kernel?.report?.() || {};
    const ready = Object.values(report).filter((s) => s === 'ready').length;
    row('modules', `${ready}/${Object.keys(report).length} ready`);

    const failed = Object.entries(report).filter(([, s]) => s === 'failed');
    if (failed.length) row('failed', failed.map(([n]) => n).join(', '));

    drawGraph();
  }

  bus.on('gfx.stats', (stats) => {
    samples.push(stats.fps);
    samples.shift();
    update(stats);
  });

  function toggle() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) bus.emit('achievement.unlock', { id: 'hud' });
  }

  bus.on('hud.toggle', toggle);

  return { toggle, element: panel, isOpen: () => !panel.hidden };
}
