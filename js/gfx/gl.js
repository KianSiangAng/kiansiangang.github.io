/* ================================================================
   GL.JS — A minimal WebGL2 wrapper

   Everything this site draws in WebGL is a full-screen quad with a
   fragment shader, so the wrapper only needs to:

     - acquire a WebGL2 context (and say so clearly when it can't)
     - compile and link programs, reporting shader errors with the
       offending line highlighted — debugging GLSL through a
       browser console is otherwise miserable
     - cache uniform locations
     - own one static quad buffer shared by every program
     - survive WEBGL_context_lost / restored

   No WebGL2? The caller falls back to the CSS gradient that is
   already in the stylesheet. The page never depends on the GPU.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('gl');

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,          // a full-screen quad has no edges to alias
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: false,
  });

  if (!gl) throw new Error('WebGL2 unavailable');

  /* -- one quad, reused by every program -- */
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  // A single oversized triangle covers the viewport with 3 vertices
  // instead of 6, and avoids the diagonal seam of a two-triangle quad.

  function compile(type, source, label) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || '';
      const lineMatch = info.match(/ERROR:\s*\d+:(\d+)/);
      const lines = source.split('\n');
      const context = lineMatch
        ? lines
            .slice(Math.max(0, Number(lineMatch[1]) - 3), Number(lineMatch[1]) + 2)
            .map((l, i) => `  ${Math.max(1, Number(lineMatch[1]) - 2) + i} | ${l}`)
            .join('\n')
        : '';
      gl.deleteShader(shader);
      throw new Error(`${label} shader failed to compile:\n${info}\n${context}`);
    }
    return shader;
  }

  function createProgram(vertexSource, fragmentSource, label = 'program') {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource, `${label} vertex`);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource, `${label} fragment`);

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`${label} failed to link: ${info}`);
    }

    const uniforms = new Map();
    function location(name) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name);
    }

    log.debug(`compiled "${label}"`);

    return {
      program,
      use() { gl.useProgram(program); },
      /** set('uTime', 1.2) / set('uResolution', [w, h]) */
      set(name, value) {
        const loc = location(name);
        if (loc === null) return;                       // optimised away
        if (typeof value === 'number') gl.uniform1f(loc, value);
        else if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
        else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
        else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
      },
      dispose() { gl.deleteProgram(program); },
    };
  }

  function drawQuad() {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Size the drawing buffer to the display size, DPR-capped. */
  function resize(maxDpr = 1.75) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (width === 0 || height === 0) return false;
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    return true;
  }

  return {
    gl,
    canvas,
    createProgram,
    drawQuad,
    resize,
    clear() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    enableBlending() {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    },
    onContextLost(handler) {
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();            // required for restore to fire
        log.warn('context lost');
        handler();
      });
    },
    onContextRestored(handler) {
      canvas.addEventListener('webglcontextrestored', () => {
        log.info('context restored');
        handler();
      });
    },
    dispose() {
      gl.deleteBuffer(quad);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
