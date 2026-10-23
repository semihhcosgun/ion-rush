import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
/** Same two race HUD shades, composited with the existing final image pass. */
export const HudFXAAShader={...FXAAShader,uniforms:{...FXAAShader.uniforms,hudShade:{value:0}},fragmentShader:FXAAShader.fragmentShader.replace('void main() {','uniform float hudShade;\nvoid main() {').replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',`gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
 if(hudShade>0.){
  float y=1.-vUv.y;
  float baseAlpha=(1.-clamp(y/.23,0.,1.))*(136./255.)+clamp((y-.7)/.3,0.,1.)*(153./255.);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(4.,12.,24.)/255.,baseAlpha);
  if(hudShade<1.5){
   float shadeAlpha=(1.-clamp(y/.3,0.,1.))*(179./255.)+clamp((y-.7)/.3,0.,1.)*(102./255.);
   gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(3.,11.,22.)/255.,shadeAlpha);
  }
 }`)};
