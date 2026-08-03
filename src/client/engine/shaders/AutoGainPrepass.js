// AutoGainPrepass.js — Fragment shaders for average luminance extraction and adaptive gain
//
// 1. LUMA_DOWN_FRAG:
//    - Input: tDiffuse (sampler2D) -> Video texture
//    - Output: vec4 with RGB = average scene luminance
//    - Algorithm: Downsamples frame by sampling an 8x8 grid evenly spaced across the UV range
//
// 2. AUTOGAIN_FRAG:
//    - Input: tDiffuse (sampler2D) -> Video texture
//             uAvgLuma (float) -> Smooth average scene luminance [0.0 - 1.0]
//             uMaxGain (float) -> Maximum brightness multiplier threshold
//    - Output: vec4 equalized and clamped pixel color
//    - Algorithm: gain = mix(1.0, uMaxGain, 1.0 - pow(uAvgLuma, 0.3)). Clamps color to [0.0, 1.0] to prevent stroboscopic blowouts in bright lighting conditions.

export const LUMA_DOWN_FRAG = `
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
  float sum = 0.0;
  // Sample an 8x8 grid evenly covering [0,1] UV coordinates
  for (int x = 0; x < 8; x++) {
    for (int y = 0; y < 8; y++) {
      vec2 sampleUv = vec2(float(x) * 2.0 + 1.0, float(y) * 2.0 + 1.0) / 16.0;
      vec3 color = texture2D(tDiffuse, sampleUv).rgb;
      sum += dot(color, vec3(0.299, 0.587, 0.114));
    }
  }
  float avgLuma = sum / 64.0;
  gl_FragColor = vec4(vec3(avgLuma), 1.0);
}
`;

export const AUTOGAIN_FRAG = `
uniform sampler2D tDiffuse;
uniform float uAvgLuma;
uniform float uMaxGain;
uniform vec2 uVideoScale;
varying vec2 vUv;

void main() {
  // Translate UV coordinates to center, apply aspect scaling, and translate back
  vec2 uv = (vUv - 0.5) * uVideoScale + 0.5;
  
  // Render letterbox/pillarbox black bars outside of video bounds
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  vec4 color = texture2D(tDiffuse, uv);
  
  // Adaptive gain formula: heavier boost for darker average scene luminance
  float gain = mix(1.0, uMaxGain, 1.0 - pow(uAvgLuma, 0.3));
  
  // Highlight clamp to prevent blowouts
  vec3 equalized = clamp(color.rgb * gain, 0.0, 1.0);
  
  gl_FragColor = vec4(equalized, color.a);
}
`;
