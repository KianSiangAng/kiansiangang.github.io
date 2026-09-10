/* ================================================================
   SHADERS.JS — GLSL ES 3.0 sources

   One full-screen fragment shader: a procedural sky. A vertical
   gradient, five octaves of fBm cloud in two layers for depth, a
   sun (or moon) whose glow drifts with the pointer, and a vignette.

   Day and night are a uniform rather than a second shader, so the
   light/dark toggle drives the sky directly — dawn colours become
   deep blues, the sun becomes a moon, and the clouds cool off.
================================================================ */

export const vertexShader = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/* Shared noise helpers, prepended to both fragment shaders. */
const PRELUDE = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform float uAlpha;      // layer opacity
uniform float uDark;       // 0 = light scheme, 1 = dark scheme
uniform vec2  uPointer;    // normalised cursor position

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);          // smoothstep interpolation
  return mix(
    mix(hash(i),                hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p);
    p *= 2.02;                                // lacunarity
    amplitude *= 0.5;                         // gain
  }
  return value;
}
`;

export const ghibliFragment = `${PRELUDE}
void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  // --- sky gradient -------------------------------------------
  vec3 top    = mix(vec3(0.44, 0.67, 0.87), vec3(0.05, 0.07, 0.16), uDark);
  vec3 bottom = mix(vec3(0.96, 0.90, 0.79), vec3(0.15, 0.16, 0.27), uDark);
  vec3 colour = mix(bottom, top, smoothstep(0.0, 1.0, uv.y));

  // --- clouds -------------------------------------------------
  vec2 drift = vec2(uTime * 0.011, uTime * 0.0028);
  float clouds = fbm(p * 2.6 + drift);
  clouds = smoothstep(0.46, 0.96, clouds + 0.16 * uv.y);
  vec3 cloudColour = mix(vec3(1.0, 0.985, 0.96), vec3(0.44, 0.47, 0.63), uDark);
  colour = mix(colour, cloudColour, clouds * 0.72);

  // second, slower layer for depth
  float far = fbm(p * 1.3 - drift * 0.4);
  colour = mix(colour, cloudColour, smoothstep(0.62, 1.0, far) * 0.28);

  // --- sun / moon ---------------------------------------------
  vec2 sunPos = vec2(0.76 * aspect, 0.80) + (uPointer - 0.5) * 0.05;
  float d = distance(p, sunPos);
  float glow = exp(-d * d * 16.0);
  vec3 sunColour = mix(vec3(1.0, 0.93, 0.76), vec3(0.78, 0.84, 1.0), uDark);
  colour += sunColour * glow * 0.5;
  colour += sunColour * smoothstep(0.055, 0.03, d) * 0.55;   // the disc itself

  // --- vignette -----------------------------------------------
  float vignette = smoothstep(1.3, 0.3, length(uv - 0.5) * 1.6);
  colour *= mix(0.8, 1.0, vignette);

  fragColor = vec4(colour, uAlpha);
}`;
