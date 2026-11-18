/* Hero slideshow: ink floods across the picture from the top right to the bottom left, and the next one appears behind it.
   WebGL (a noise-warped spreading front with an ink-dark fringe). Without WebGL, or with reduced motion, the plain CSS cross-fade stays. */
(() => {
  "use strict";
  const slides = document.querySelector(".hero .slides");
  if (!slides || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const HOLD = 5200, BLEED = 4200;          // ms: time on a picture, time the ink takes to cross it
  const INK = [.737, .235, .078];            // the ink colour: the logo orange. For a white ink use [.95, .92, .88]

  const wait = () => new Promise((ok) => {
    const t0 = Date.now(), tick = () => {
      const imgs = [...slides.querySelectorAll("img")], ready = document.documentElement.classList.contains("hv-live") && imgs.length > 1 && imgs.every((i) => i.complete && i.naturalWidth > 8);
      if (ready) ok(imgs); else if (Date.now() - t0 > 9000) ok(null); else setTimeout(tick, 250);
    }; tick();
  });

  const VERT = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  const FRAG = `precision highp float;varying vec2 v;
uniform sampler2D A,B;uniform vec2 sa,sb,origin;uniform vec3 ink;uniform float t,za,zb,aspect,maxd,seed;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*noise(p);p=p*2.03+17.1;a*=.5;}return s;}
vec3 tex(sampler2D T,vec2 s,float z){return texture2D(T,(v-.5)*s/z+.5).rgb;}
void main(){
  vec2 p=vec2(v.x*aspect,v.y);
  /* domain warping gives the flowing, marbled tendrils of ink in water */
  vec2 w=vec2(fbm(p*1.5+seed),fbm(p*1.5+seed+9.2));
  vec2 q=p+(w-.5)*.7;
  float streak=fbm(q*4.2+w*2.5);
  float field=distance(q,origin*vec2(aspect,1.))/maxd+(streak-.5)*.5;
  float front=mix(-.4,1.6,t);
  float k=front-field;                                  /* > 0: the ink has reached here */
  float bw=.09+.2*noise(q*6.5+seed);                    /* how far the ink runs ahead of the new picture */
  vec3 a=tex(A,sa,za),b=tex(B,sb,zb);
  vec3 c=ink*(.93+.07*streak);                          /* a little marbling inside the ink */
  vec3 col=mix(a,c,smoothstep(0.,.012,k));              /* ink over the old picture, crisp edge */
  col=mix(col,b,smoothstep(bw,bw+.014,k));              /* the new picture shows behind it */
  gl_FragColor=vec4(col,1.);
}`;

  const build = (imgs) => {
    const cv = document.createElement("canvas"); cv.className = "ink"; cv.setAttribute("aria-hidden", "true");
    const gl = cv.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" }); if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG); if (!vs || !fs) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n) => gl.getUniformLocation(pr, n);
    const tx = imgs.map((im) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; });
    gl.uniform1i(u("A"), 0); gl.uniform1i(u("B"), 1);
    return { cv, gl, u, tx, imgs };
  };

  /* object-fit: cover: how much of the picture's width and height is visible */
  const cover = (im, cw, ch) => { const ia = im.naturalWidth / im.naturalHeight, ca = cw / ch; return ia > ca ? [ca / ia, 1] : [1, ia / ca]; };
  const ease = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

  wait().then((imgs) => {
    if (!imgs) return;
    const r = build(imgs); if (!r) return;
    const { cv, gl, u, tx } = r; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .6s";
    slides.appendChild(cv);
    let cw = 0, ch = 0;
    const size = () => { const b = slides.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5), s = Math.min(1, 1600 / Math.max(1, b.width * dpr)); cw = Math.max(2, Math.round(b.width * dpr * s)); ch = Math.max(2, Math.round(b.height * dpr * s)); if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; gl.viewport(0, 0, cw, ch); } };
    new ResizeObserver(size).observe(slides); size();

    let cur = 0, nxt = 1, t0 = performance.now(), bleeding = false, origin = [1.04, 1.04], seed = 1, age = 0, visible = true;
        const draw = (now) => {
      const sinceBleed = bleeding ? now - t0 : 0, p = bleeding ? Math.min(1, sinceBleed / BLEED) : 0, e = ease(p);
      const zoom = (a) => 1.10 - .10 * ease(Math.min(1, a / (HOLD + BLEED)));            /* slow settle, like the old zoom */
      const aA = bleeding ? HOLD + sinceBleed : now - t0, aB = bleeding ? sinceBleed : 0;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx[cur]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tx[nxt]);
      const sa = cover(imgs[cur], cw, ch), sb = cover(imgs[nxt], cw, ch), asp = cw / ch, ox = origin[0] * asp, oy = origin[1];
      gl.uniform2f(u("sa"), sa[0], sa[1]); gl.uniform2f(u("sb"), sb[0], sb[1]);
      gl.uniform1f(u("t"), e); gl.uniform1f(u("za"), zoom(aA)); gl.uniform1f(u("zb"), zoom(aB)); gl.uniform1f(u("aspect"), asp);
      gl.uniform1f(u("maxd"), Math.max(Math.hypot(ox, oy), Math.hypot(asp - ox, oy), Math.hypot(ox, 1 - oy), Math.hypot(asp - ox, 1 - oy)));
      gl.uniform1f(u("seed"), seed); gl.uniform2f(u("origin"), origin[0], origin[1]); gl.uniform3f(u("ink"), INK[0], INK[1], INK[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!bleeding && now - t0 >= HOLD) { bleeding = true; t0 = now; seed = Math.random() * 40; }
      else if (bleeding && p >= 1) { cur = nxt; nxt = (nxt + 1) % imgs.length; bleeding = false; t0 = now - BLEED; }
    };
    /* run only while the hero is on screen and the tab is visible */
    let raf = 0, last = 0, frozen = false;
    const loop = (now) => { raf = 0; if (frozen || !visible || document.hidden) { last = 0; return; } if (last) t0 += 0; draw(now); raf = requestAnimationFrame(loop); };
    const kick = () => { if (!raf && visible && !document.hidden) { const now = performance.now(); if (last) t0 += now - last; raf = requestAnimationFrame(loop); } };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } last = performance.now(); };
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? kick() : stop(); }).observe(slides);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : kick()));
    draw(performance.now());
    cv.style.opacity = "1"; slides.classList.add("ink-on"); setTimeout(() => slides.querySelectorAll("figure").forEach((f) => (f.style.display = "none")), 700);
    window.HVink = { seek(p) { frozen = true; visible = false; stop(); bleeding = true; seed = 7; t0 = performance.now() - p * BLEED; draw(performance.now()); } };  /* for checking a single frame */
    kick();
  });
})();
