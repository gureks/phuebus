// FeedbackTrails.js — Ping-pong buffer decay + UV wave dispersion
//
// Inputs:
// - tCurrent (sampler2D) -> Active frame render texture
// - tPrev (sampler2D) -> Previous feedback texture (read target)
// - uDecay (float) -> Trail fade decay rate [0.5 - 0.99]
// - uTime (float) -> Time elapsed in seconds
// - uDispersion (float) -> Wave particle dispersion amplitude [0.0 - 0.008]
//
// Algorithm:
// - Samples the previous feedback buffer with a wavy UV coordinate offset to simulate rising smoke/particles.
// - Blends using a max() threshold: max(currentFrame, decay * previousFrame). This keeps trails sharp and prevents brightness washout.

export const TRAILS_FRAG = `
uniform sampler2D tCurrent;
uniform sampler2D tPrev;
uniform float uDecay;
uniform float uTime;
uniform float uDispersion;
varying vec2 vUv;

void main() {
  vec4 current = texture2D(tCurrent, vUv);
  
  // 1. Calculate wavy UV offset for trails dispersion
  vec2 uvPrev = vUv;
  if (uDispersion > 0.0) {
    uvPrev.x += sin(vUv.y * 30.0 + uTime * 6.0) * uDispersion;
    uvPrev.y += cos(vUv.x * 30.0 + uTime * 6.0) * uDispersion;
    
    // Expands slightly outwards to create radial dispersion
    uvPrev = (uvPrev - 0.5) * 0.996 + 0.5;
  }
  
  // Clamp UVs to avoid edge wraps
  uvPrev = clamp(uvPrev, 0.0, 1.0);
  vec4 prev = texture2D(tPrev, uvPrev);
  
  // 2. Perform max blending to preserve the brightest trails
  vec3 blended = max(current.rgb, prev.rgb * uDecay);
  float alpha = max(current.a, prev.a * uDecay);
  
  gl_FragColor = vec4(blended, alpha);
}
`;
