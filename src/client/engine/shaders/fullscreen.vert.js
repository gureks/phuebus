// fullscreen.vert.js — Standard fullscreen vertex shader for post-processing
// Inputs: position (vec3), uv (vec2) from PlaneGeometry(2, 2)
// Outputs: vUv (vec2) mapped to fragment shader
// Algorithm: Passthrough directly to WebGL clip space (-1 to 1)

export const VERT_GLSL = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;
