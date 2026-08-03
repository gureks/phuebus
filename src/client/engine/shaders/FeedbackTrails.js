// FeedbackTrails.js — Ping-pong buffer decay + Audio-Reactive Dispersion + GPU Frame-Difference Optical Flow
//
// Inputs:
// - tCurrent (sampler2D) -> Active frame render texture
// - tPrev (sampler2D) -> Previous feedback texture (read target)
// - tPrevFrame (sampler2D) -> Previous raw camera frame texture
// - uDecay (float) -> Trail fade decay rate [0.5 - 0.99]
// - uTime (float) -> Time elapsed in seconds
// - uResolution (vec2) -> Canvas size in pixels
// - uBass (float) -> Bass energy [0.0 - 1.0]
// - uDispersion (float) -> Wave particle dispersion amplitude [0.0 - 0.008]
// - uAudioDispersionSensitivity (float) -> Bass impact on smoke dispersion [0.0 - 5.0]
// - uMotionFlowScale (float) -> Optical flow push multiplier [0.0 - 20.0]
//
// Algorithm:
// - Computes local motion vectors by multiplying the spatial gradient of the current frame with the temporal frame difference.
// - Offsets previous trails coordinates opposite to motion vectors (`vUv - motionVector`), making trails follow movement paths.
// - Scales high-frequency sine wave dispersion on uBass kicks to push trails outward.

export const TRAILS_FRAG = `
uniform sampler2D tCurrent;
uniform sampler2D tPrev;
uniform sampler2D tPrevFrame;
uniform float uDecay;
uniform float uTime;
uniform vec2 uResolution;
uniform float uBass;
uniform float uDispersion;
uniform float uAudioDispersionSensitivity;
uniform float uMotionFlowScale;
varying vec2 vUv;

// Extract luminance
float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 current = texture2D(tCurrent, vUv);
  vec2 texel = 1.0 / uResolution;
  
  // 1. Calculate GPU-based Local Optical Flow Vector
  vec3 currCam = texture2D(tCurrent, vUv).rgb;
  vec3 prevCam = texture2D(tPrevFrame, vUv).rgb;
  vec3 tempDiff = currCam - prevCam;
  
  // Spatial gradient of current frame
  float dx = getLuma(texture2D(tCurrent, vUv + vec2(texel.x, 0.0)).rgb) - getLuma(texture2D(tCurrent, vUv - vec2(texel.x, 0.0)).rgb);
  float dy = getLuma(texture2D(tCurrent, vUv + vec2(0.0, texel.y)).rgb) - getLuma(texture2D(tCurrent, vUv - vec2(0.0, texel.y)).rgb);
  
  // Motion vector is spatial gradient * temporal difference magnitude
  vec2 motionVector = vec2(dx, dy) * getLuma(abs(tempDiff)) * uMotionFlowScale;
  
  // Apply motion vector to pull previous trails
  vec2 uvPrev = vUv - motionVector;
  
  // 2. Audio-Reactive Wave Dispersion (Kick drum pushes smoke outward)
  float activeDispersion = uDispersion * (1.0 + uBass * uAudioDispersionSensitivity);
  if (activeDispersion > 0.0) {
    uvPrev.x += sin(vUv.y * 30.0 + uTime * 6.0) * activeDispersion;
    uvPrev.y += cos(vUv.x * 30.0 + uTime * 6.0) * activeDispersion;
    
    // Radial outwards scale
    uvPrev = (uvPrev - 0.5) * 0.996 + 0.5;
  }
  
  uvPrev = clamp(uvPrev, 0.0, 1.0);
  vec4 prev = texture2D(tPrev, uvPrev);
  
  // 3. Blend current and decayed previous trails
  vec3 blended = max(current.rgb, prev.rgb * uDecay);
  float alpha = max(current.a, prev.a * uDecay);
  
  gl_FragColor = vec4(blended, alpha);
}
`;
