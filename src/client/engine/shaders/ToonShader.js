// ToonShader.js — Posterization + Sobel Edge Outline + Audio Edge Glow
//
// Inputs:
// - tDiffuse (sampler2D) -> Input texture
// - uResolution (vec2) -> Canvas size in pixels
// - uTime (float) -> Time elapsed in seconds
// - uBass (float) -> Real-time bass energy [0.0 - 1.0]
// - uEdgeSensitivity (float) -> Sobel gradient threshold [0.01 - 0.5]
// - uColorSteps (float) -> Color quantization steps [2.0 - 16.0]
// - uHue (float) -> Edge glow color rotation angle in radians [0.0 - 6.283]
//
// Algorithm:
// - Extracts luminance to calculate 3x3 Sobel convolution horizontal/vertical gradients.
// - Quantizes color channels to produce the retro cell-shaded / posterized look.
// - Performs smooth edge mixing using smoothstep, rendering an outline that glows on the bass beat.

export const TOON_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uEdgeSensitivity;
uniform float uColorSteps;
uniform float uHue;
varying vec2 vUv;

// Extract luminance (ITU-R BT.601 weights)
float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// Axis-angle rotation around diagonal white axis (1,1,1) for fast RGB hue shifting
vec3 hueShift(vec3 color, float angle) {
  vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float cosAngle = cos(angle);
  return color * cosAngle + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - cosAngle);
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  
  // 1. Posterization
  vec3 postColor = floor(color.rgb * uColorSteps + 0.5) / uColorSteps;
  
  // 2. Sobel Edge Detection (3x3 Kernel)
  vec2 texel = 1.0 / uResolution;
  
  float c00 = getLuma(texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0)).rgb);
  float c10 = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 0.0, -1.0)).rgb);
  float c20 = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 1.0, -1.0)).rgb);
  
  float c01 = getLuma(texture2D(tDiffuse, vUv + texel * vec2(-1.0,  0.0)).rgb);
  float c21 = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 1.0,  0.0)).rgb);
  
  float c02 = getLuma(texture2D(tDiffuse, vUv + texel * vec2(-1.0,  1.0)).rgb);
  float c12 = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 0.0,  1.0)).rgb);
  float c22 = getLuma(texture2D(tDiffuse, vUv + texel * vec2( 1.0,  1.0)).rgb);
  
  float gx = -1.0 * c00 + 1.0 * c20 - 2.0 * c01 + 2.0 * c21 - 1.0 * c02 + 1.0 * c22;
  float gy = -1.0 * c00 - 2.0 * c10 - 1.0 * c20 + 1.0 * c02 + 2.0 * c12 + 1.0 * c22;
  
  float g = sqrt(gx * gx + gy * gy);
  
  // 3. Smooth Edge Mapping & Audio reactive glow
  // Base edge color is neon magenta (1.0, 0.0, 0.5)
  vec3 baseEdgeColor = vec3(1.0, 0.0, 0.5);
  vec3 glowColor = hueShift(baseEdgeColor, uHue) * (1.0 + uBass * 3.0);
  
  // Smoothly blend edge outlines over posterized color
  float edgeFactor = smoothstep(uEdgeSensitivity, uEdgeSensitivity + 0.08, g);
  vec3 finalColor = mix(postColor, glowColor, edgeFactor);
  
  gl_FragColor = vec4(finalColor, color.a);
}
`;
