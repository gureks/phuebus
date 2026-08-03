// NeonAura.js — Skeletal Landmark Neon Overlay
//
// Inputs:
// - tDiffuse (sampler2D) -> Camera texture
// - uLandmarks (vec2[33]) -> Skeletal joint positions in [0,1] normalized space. Inactive indices are set to (-1, -1).
// - uTime (float) -> Time elapsed in seconds
// - uBass (float) -> Bass energy [0.0 - 1.0] (controls joint dot pulses)
// - uMid (float) -> Mid energy [0.0 - 1.0] (controls bone segment line pulses)
// - uGlowRadius (float) -> Glow width modifier [0.001 - 0.02]
// - uHue (float) -> Aura color hue rotation angle in radians [0.0 - 6.283]
//
// Algorithm:
// - Solves 2D distance-to-segment formulas for 12 hardcoded skeletal connections (shoulders, torso, limbs).
// - Solves radial distance glows for the major joint points.
// - Modulates joint glows on uBass, bone segment glows on uMid, and shifts colors dynamically.
// - Blends additively onto the input camera texture.

export const NEON_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uLandmarks[33];
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uGlowRadius;
uniform float uHue;
varying vec2 vUv;

// Calculate distance from point P to line segment V-W
float distToSegment(vec2 p, vec2 v, vec2 w) {
  float l2 = dot(v - w, v - w);
  if (l2 == 0.0) return distance(p, v);
  float t = max(0.0, min(1.0, dot(p - v, w - v) / l2));
  vec2 projection = v + t * (w - v);
  return distance(p, projection);
}

// Axis-angle rotation around diagonal white axis (1,1,1) for fast RGB hue shifting
vec3 hueShift(vec3 color, float angle) {
  vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float cosAngle = cos(angle);
  return color * cosAngle + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - cosAngle);
}

void main() {
  vec4 camera = texture2D(tDiffuse, vUv);
  
  float jointGlow = 0.0;
  float boneGlow = 0.0;
  
  // Use options radius or default to uGlowRadius
  float r = uGlowRadius;

  // 1. Joint point glow additions (focusing on joints 11-16 and 23-28)
  #define ADD_JOINT(idx) \
    if (uLandmarks[idx].x >= 0.0) { \
      float d = distance(vUv, uLandmarks[idx]); \
      jointGlow += r / (d * d * 15.0 + d * 0.15 + 0.001); \
    }

  ADD_JOINT(11) // L Shoulder
  ADD_JOINT(12) // R Shoulder
  ADD_JOINT(13) // L Elbow
  ADD_JOINT(14) // R Elbow
  ADD_JOINT(15) // L Wrist
  ADD_JOINT(16) // R Wrist
  ADD_JOINT(23) // L Hip
  ADD_JOINT(24) // R Hip
  ADD_JOINT(25) // L Knee
  ADD_JOINT(26) // R Knee
  ADD_JOINT(27) // L Ankle
  ADD_JOINT(28) // R Ankle

  // 2. Bone segment line glow additions
  #define ADD_BONE(idxA, idxB) \
    if (uLandmarks[idxA].x >= 0.0 && uLandmarks[idxB].x >= 0.0) { \
      float d = distToSegment(vUv, uLandmarks[idxA], uLandmarks[idxB]); \
      boneGlow += r / (d * 1.5 + 0.003); \
    }

  // Torso & Hips
  ADD_BONE(11, 12) // Shoulders
  ADD_BONE(11, 23) // Left Torso
  ADD_BONE(12, 24) // Right Torso
  ADD_BONE(23, 24) // Hips

  // Arms
  ADD_BONE(11, 13) // Left Upper Arm
  ADD_BONE(13, 15) // Left Forearm
  ADD_BONE(12, 14) // Right Upper Arm
  ADD_BONE(14, 16) // Right Forearm

  // Legs
  ADD_BONE(23, 25) // Left Thigh
  ADD_BONE(25, 27) // Left Shin
  ADD_BONE(24, 26) // Right Thigh
  ADD_BONE(26, 28) // Right Shin

  // 3. Assemble and apply color shifts
  // Base neon blue-cyan (0.0, 1.0, 1.0)
  vec3 baseAuraColor = vec3(0.0, 1.0, 1.0);
  vec3 glowColor = hueShift(baseAuraColor, uHue);
  
  // Modulate glows: joints on bass, bones on mids
  float totalGlowVal = jointGlow * (1.0 + uBass * 2.0) + boneGlow * (1.0 + uMid * 1.5);
  vec3 skeletalVisual = glowColor * totalGlowVal;
  
  // Additively blend skeletal aura on top of camera feed
  vec3 finalRGB = camera.rgb + skeletalVisual;
  
  gl_FragColor = vec4(clamp(finalRGB, 0.0, 1.0), camera.a);
}
`;
