import { createDoorAudio } from "../core/audio.js";
import { getScene } from "../navigation/sceneRegistry.js";
import { canNavigate } from "../navigation/sceneGraph.js";
import { getEnvironment } from "../environment/environmentState.js";

const frame = document.querySelector("#scene-frame");
const camera = document.querySelector("#gate-camera");
const hall = document.querySelector("#hall-view");
const gateButton = document.querySelector("#gate-hotspot");
const returnButton = document.querySelector("#return-entry");
const sceneCopy = document.querySelector("#scene-copy");
const fallback = document.querySelector("#image-fallback");
const sound = document.querySelector("#door-sound");
const canvas = document.querySelector("#scene-canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const totalTime = 5300;
const returnDuration = 3600;
const sceneOverscan = 1.04;
const doorwayCenterX = 3.34;
// A fixed, distant image plane gives the illustrated hall modest perspective
// motion without excessively cropping the vault at the end of the walk.
const hallPlane = { z: -220, anchorX: 0.50, anchorY: 0.46 };
let scene = "gate";
let busy = false;
let ready = false;
let timeline = 0;
let renderer;
const doorAudio = createDoorAudio(sound);
let activeAnimation = null;

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const toWorld = ([u, v]) => [(u - 0.5) * 20, (0.5 - v) * 20, 0];

// Trace the original doorway, including its slanted centre seam and unequal
// shoulders. UV coordinates come from the original illustration, not the
// incompatible front-facing sprite. No raster asset is stretched into place.
const apex = [0.666, 0.516];
const seam = [0.667, 0.721];
const leftOutline = [seam, [0.620, 0.722], [0.620, 0.590],
  [0.622, 0.575], [0.628, 0.560], [0.639, 0.543], [0.651, 0.529], apex];
const rightOutline = [seam, apex, [0.679, 0.528], [0.690, 0.542],
  [0.702, 0.560], [0.709, 0.576], [0.714, 0.591], [0.714, 0.720]];
const openingOutline = [...leftOutline.slice(1), ...rightOutline.slice(2)];

function poseAt(time, width, height) {
  const p = clamp(time / totalTime);
  const size = Math.max(width, height);
  const visibleHeight = 20 * height / size;
  const startY = 10 - visibleHeight / 2 - (20 - visibleHeight) * 0.63;
  // Centre on the doorway itself, not on the square illustration. Landscape
  // needs extra crop so panning toward its right-hand door cannot expose an edge.
  const focal = Math.max(1.4 * size,
    width * 28 / (2 * (10 - Math.abs(doorwayCenterX)))) * sceneOverscan;
  return {
    // Walk straight through the centre seam; do not sweep in from the left.
    eye: [doorwayCenterX, startY + (-3.03 - startY) * p, 28 - 36 * p],
    opening: ease(p / 0.58),
    focal,
  };
}

function returnTimelineAt(progress) {
  // Equal world-distance steps are not equal screen-distance steps in a
  // perspective projection. Interpolate reciprocal depth so the hall's visible
  // scale and position retreat at a constant rate, starting on the first frame.
  const p = clamp(progress);
  if (p === 0) return totalTime;
  if (p === 1) return 0;
  const outsideDepth = 28 - hallPlane.z;
  const insideDepth = -8 - hallPlane.z;
  const depth = 1 / ((1 - p) / insideDepth + p / outsideDepth);
  return totalTime * clamp((28 - (depth + hallPlane.z)) / 36);
}

// Fit once per viewport, NOT once per camera pose. Refitting every frame would
// cancel camera motion and pin the hall to the screen like a static overlay.
// A straight path has affine frustum bounds, so the union of its two endpoints
// covers every intermediate frame in both directions, with no filler layers.
function hallBoundsForViewport(width, height, aspect) {
  const padding = Math.max(3, Math.min(width, height) * 0.015);
  const views = [0, totalTime].map(time => {
    const pose = poseAt(time, width, height);
    const unitsPerPixel = (pose.eye[2] - hallPlane.z) / pose.focal;
    const halfWidth = (width / 2 + padding) * unitsPerPixel;
    const halfHeight = (height / 2 + padding) * unitsPerPixel;
    return { left: pose.eye[0] - halfWidth, right: pose.eye[0] + halfWidth,
      top: pose.eye[1] + halfHeight, bottom: pose.eye[1] - halfHeight };
  });
  const left = Math.min(...views.map(view => view.left));
  const right = Math.max(...views.map(view => view.right));
  const top = Math.max(...views.map(view => view.top));
  const bottom = Math.min(...views.map(view => view.bottom));
  const imageHeight = Math.max(top - bottom, (right - left) / aspect);
  const imageWidth = imageHeight * aspect;
  const imageLeft = left - (imageWidth - (right - left)) * hallPlane.anchorX;
  const imageTop = top + (imageHeight - (top - bottom)) * hallPlane.anchorY;
  return {
    left: imageLeft, right: imageLeft + imageWidth,
    top: imageTop, bottom: imageTop - imageHeight,
  };
}

function setControls() {
  gateButton.disabled = !ready || busy || scene !== "gate";
  gateButton.hidden = scene !== "gate" || busy;
  returnButton.disabled = !ready || busy || scene !== "great_hall";
  returnButton.hidden = scene !== "great_hall" || busy;
  sceneCopy.hidden = scene === "great_hall" || frame.dataset.state === "error";
  frame.setAttribute("aria-busy", String(!ready || busy));
}

function render(time) {
  timeline = time;
  const width = frame.clientWidth, height = frame.clientHeight;
  if (renderer && width > 0 && height > 0) {
    renderer.draw(poseAt(time, width, height));
  }
}

function updateLayout() {
  const width = frame.clientWidth, height = frame.clientHeight;
  if (!width || !height) return;
  const initialPose = poseAt(0, width, height);
  const projectU = (u) => width / 2 + ((u - 0.5) * 20 - initialPose.eye[0]) * initialPose.focal / initialPose.eye[2];
  const projectV = (v) => height / 2 - ((0.5 - v) * 20 - initialPose.eye[1]) * initialPose.focal / initialPose.eye[2];
  frame.style.setProperty("--scene-overscan", String(sceneOverscan));
  // The loading image must use the same crop as WebGL, avoiding a jump when
  // the renderer becomes ready. Its square source keeps its original ratio.
  const loadingImage = document.querySelector("#gate-image");
  loadingImage.style.left = projectU(0) + "px";
  loadingImage.style.top = projectV(0) + "px";
  loadingImage.style.width = (projectU(1) - projectU(0)) + "px";
  loadingImage.style.height = (projectV(1) - projectV(0)) + "px";
  const minU = 0.620, maxU = 0.714, minV = 0.516, maxV = 0.722;
  gateButton.style.left = projectU(minU) + "px";
  gateButton.style.top = projectV(minV) + "px";
  gateButton.style.width = (projectU(maxU) - projectU(minU)) + "px";
  gateButton.style.height = (projectV(maxV) - projectV(minV)) + "px";
  gateButton.style.clipPath = "polygon(" + openingOutline.map(([u,v]) =>
    ((u-minU)/(maxU-minU)*100) + "% " + ((v-minV)/(maxV-minV)*100) + "%").join(",") + ")";
  if (renderer) renderer.resize(width, height);
  render(timeline);
}

function animateTo(destination, duration, clock, options = {}) {
  if (activeAnimation) return Promise.reject(new Error("An animation is already running."));
  if (reducedMotion.matches) { render(destination); return Promise.resolve(); }
  const start = timeline;
  return new Promise((resolve, reject) => {
    const animation = { frameId: null };
    activeAnimation = animation;
    const startedAt = performance.now();
    const step = (now) => {
      try {
        const elapsed = clock ? clock() : now - startedAt;
        const progress = clamp(elapsed / duration);
        render(options.timeAtProgress ? options.timeAtProgress(progress)
          : start + (destination - start) * progress);
        if (options.onFrame) options.onFrame(timeline, progress);
        if (progress < 1) animation.frameId = window.requestAnimationFrame(step);
        else { activeAnimation = null; resolve(); }
      } catch (error) {
        activeAnimation = null;
        reject(error);
      }
    };
    animation.frameId = window.requestAnimationFrame(step);
  });
}

function pointInDoorway(u, v) {
  let inside = false;
  for (let i = 0, j = openingOutline.length - 1; i < openingOutline.length; j = i++) {
    const a = openingOutline[i], b = openingOutline[j];
    if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function gateReentersView(pose, width, height) {
  if (width <= 0 || height <= 0 || pose.eye[2] <= 0.025) return false;
  // An inset avoids firing on the first subpixel of a frame corner. Trigger
  // when a small but visible portion of the door frame actually appears.
  const inset = 0.025;
  for (const x of [width * inset, width * (1 - inset)]) {
    for (const y of [height * inset, height * (1 - inset)]) {
      const worldX = pose.eye[0] + (x - width / 2) * pose.eye[2] / pose.focal;
      const worldY = pose.eye[1] + (height / 2 - y) * pose.eye[2] / pose.focal;
      if (!pointInDoorway(worldX / 20 + 0.5, 0.5 - worldY / 20)) return true;
    }
  }
  return false;
}

async function enterHall() {
  if (!ready || busy || scene !== "gate") return;
  if (!canNavigate(scene, "great_hall")) return;
  busy = true;
  setControls();
  frame.dataset.state = "entering";
  try {
    const clock = await doorAudio.start();
    await animateTo(totalTime, totalTime, clock);
    scene = "great_hall";
    hall.setAttribute("aria-hidden", "false");
    canvas.setAttribute("aria-label", "Inside the Great Hall");
    frame.dataset.state = "hall";
  } finally {
    busy = false;
    setControls();
  }
}

// Return uses constant projected hall motion, not an audio playback clock. Sound
// is unlocked on click but starts only when the door frame reenters the view.
async function returnToEntrance() {
  if (!ready || busy || scene !== "great_hall") return;
  if (!canNavigate(scene, "gate")) return;
  busy = true;
  setControls();
  frame.dataset.state = "returning";
  sceneCopy.hidden = true;
  doorAudio.stop();
  camera.hidden = false;
  let soundTriggered = false;
  try {
    await animateTo(0, returnDuration, undefined, {
      timeAtProgress: returnTimelineAt,
      onFrame(time) {
        if (soundTriggered) return;
        const width = frame.clientWidth, height = frame.clientHeight;
        if (!gateReentersView(poseAt(time, width, height), width, height)) return;
        soundTriggered = true;
        void doorAudio.start().catch(error => console.warn("Door sound could not play:", error));
      },
    });
    scene = "gate";
    hall.setAttribute("aria-hidden", "true");
    canvas.setAttribute("aria-label", "Hogwarts entrance");
    frame.dataset.state = "gate";
  } finally {
    busy = false;
    setControls();
  }
}

function loadImage(image) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
    };
    const loaded = () => {
      cleanup();
      if (!image.naturalWidth) { reject(new Error("Scene image is empty")); return; }
      if (image.decode) image.decode().then(resolve, reject);
      else resolve();
    };
    const failed = () => { cleanup(); reject(new Error("Scene image unavailable: " + image.getAttribute("src"))); };
    const timeout = window.setTimeout(failed, 15000);
    image.addEventListener("load", loaded);
    image.addEventListener("error", failed);
    if (image.complete) { if (image.naturalWidth > 0) loaded(); else failed(); }
  });
}

function createSceneRenderer(canvas, gateImage, hallImage) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) throw new Error("This browser cannot render the 3D doorway.");
  const vertexSource = `
    attribute vec3 a_position;
    attribute vec2 a_uv;
    attribute vec3 a_normal;
    uniform vec3 u_eye;
    uniform vec2 u_focal;
    varying vec2 v_uv;
    varying vec3 v_normal;
    varying vec3 v_position;
    void main() {
      vec3 q = a_position - u_eye;
      float depth = -q.z;
      float nearPlane = 0.025;
      float farPlane = 500.0;
      float A = (farPlane + nearPlane) / (farPlane - nearPlane);
      float B = -2.0 * farPlane * nearPlane / (farPlane - nearPlane);
      gl_Position = vec4(q.x * u_focal.x, q.y * u_focal.y, A * depth + B, depth);
      v_uv = a_uv;
      v_normal = a_normal;
      v_position = a_position;
    }`;
  const fragmentSource = `
    precision highp float;
    uniform sampler2D u_texture;
    uniform int u_mode;
    uniform float u_tone;
    uniform float u_opening;
    uniform vec3 u_sideColor;
    uniform vec3 u_eye;
    uniform vec2 u_hole[${openingOutline.length}];
    uniform vec3 u_pivots[2];
    uniform vec3 u_axes[2];
    uniform float u_angles[2];
    varying vec2 v_uv;
    varying vec3 v_normal;
    varying vec3 v_position;
    bool inDoorway(vec2 p) {
      bool inside = false;
      vec2 b = u_hole[${openingOutline.length - 1}];
      for (int i = 0; i < ${openingOutline.length}; i++) {
        vec2 a = u_hole[i];
        if ((a.y > p.y) != (b.y > p.y)) {
          float edgeX = (b.x-a.x) * (p.y-a.y) / (b.y-a.y) + a.x;
          if (p.x < edgeX) inside = !inside;
        }
        b = a;
      }
      return inside;
    }
    vec3 turn(vec3 p, vec3 axis, float angle) {
      return p*cos(angle) + cross(axis,p)*sin(angle) + axis*dot(axis,p)*(1.0-cos(angle));
    }
    float doorShadow(vec3 point) {
      vec3 ray = vec3(-4.0,6.0,10.0) - point;
      float shade = 0.0;
      for (int k=0; k<2; k++) {
        vec3 axis=u_axes[k];
        vec3 pivot=u_pivots[k];
        vec3 normal=turn(vec3(0.0,0.0,1.0),axis,u_angles[k]);
        vec3 planePoint=pivot+turn(vec3(0.0,0.0,0.06),axis,u_angles[k]);
        float denominator=dot(normal,ray);
        if(abs(denominator)>0.0001) {
          float t=dot(normal,planePoint-point)/denominator;
          if(t>0.001 && t<1.0) {
            vec3 local=turn(point+ray*t-pivot,axis,-u_angles[k])+pivot;
            vec2 uv=vec2(local.x/20.0+0.5,0.5-local.y/20.0);
            float seamX=0.666+(uv.y-0.516)/0.205*0.001;
            bool ownLeaf=k==0 ? uv.x<=seamX : uv.x>=seamX;
            if(ownLeaf && inDoorway(uv)) shade=0.22;
          }
        }
      }
      return shade*clamp(u_eye.z/5.0,0.0,1.0);
    }
    void main() {
      if (u_mode == 0 && inDoorway(v_uv)) discard;
      vec3 color = texture2D(u_texture, v_uv).rgb;
      vec3 normal = normalize(v_normal);
      vec3 light = normalize(vec3(-0.5, 0.6, 1.0));
      float diffuse = max(dot(normal, light), 0.0);
      if (u_mode == 1) {
        float illumination = mix(1.0, 0.5 + 0.5 * diffuse, u_opening);
        color *= illumination * u_tone;
        vec3 view = normalize(u_eye - v_position);
        float glint = pow(max(dot(reflect(-light, normal), view), 0.0), 24.0);
        color += vec3(1.0, 0.67, 0.29) * glint * 0.06 * u_opening;
      }
      if (u_mode == 2) {
        float grain = 0.94 + 0.06 * sin(v_uv.y * 1100.0 + v_uv.x * 90.0);
        color = u_sideColor * (0.5 + 0.8 * diffuse) * grain;
      }
      if ((u_mode == 2 || u_mode == 3) && u_eye.z>0.0 && u_opening>0.0) {
        color *= 1.0-doorShadow(v_position);
      }
      gl_FragColor = vec4(color, 1.0);
    }`;
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(result));
    }
    return result;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const locations = {};
  for (const name of ["eye","focal","mode","tone","opening","sideColor","texture"]) {
    locations[name] = gl.getUniformLocation(program, "u_" + name);
  }
  gl.uniform2fv(gl.getUniformLocation(program, "u_hole[0]"), new Float32Array(openingOutline.flat()));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, count, offset] of [["position",3,0],["uv",2,12],["normal",3,20]]) {
    const attribute = gl.getAttribLocation(program, "a_" + name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, count, gl.FLOAT, false, 32, offset);
  }
  function texture(image) {
    const result = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, result);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return result;
  }
  const gateTexture = texture(gateImage), hallTexture = texture(hallImage);
  gl.uniform1i(locations.texture, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.02, 0.035, 0.07, 1);
  const vertex = (position, uv, normal) => [...position,...uv,...normal];
  function face(points, uvs, normal) {
    const result = [];
    for (let i = 1; i < points.length - 1; i++) {
      for (const j of [0,i,i+1]) result.push(...vertex(points[j],uvs[j],normal));
    }
    return result;
  }
  function quad(points, uvs, normal=[0,0,1]) { return face(points, uvs, normal); }
  const imageUVs = [[0,0],[1,0],[1,1],[0,1]];
  const exterior = quad([[-10,10,0],[10,10,0],[10,-10,0],[-10,-10,0]],imageUVs);
  const hallAspect = hallImage.naturalWidth / hallImage.naturalHeight;

  function makeDoor(outline, hingeBottom, hingeTop, sign) {
    const front = outline.map(toWorld);
    const depth = 0.12; // Visible solid timber, rather than a zero-thickness card.
    const back = front.map(([x,y]) => [x,y,-depth]);
    const sides = [];
    for (let i=0; i<front.length; i++) {
      const j=(i+1)%front.length;
      const dx=front[j][0]-front[i][0], dy=front[j][1]-front[i][1];
      const length=Math.hypot(dx,dy);
      sides.push(...quad([front[i],front[j],back[j],back[i]],
        [outline[i],outline[j],outline[j],outline[i]], [dy/length,-dx/length,0]));
    }
    const pivot = toWorld(hingeBottom); pivot[2] = -depth/2;
    const top = toWorld(hingeTop);
    const axis = [top[0]-pivot[0],top[1]-pivot[1],0];
    const length = Math.hypot(...axis);
    return {front:face(front,outline,[0,0,1]),back:face(back,outline,[0,0,-1]),
      sides,pivot,axis:axis.map(v=>v/length),sign};
  }
  const doors = [
    makeDoor(leftOutline,[0.620,0.722],[0.620,0.590],1),
    makeDoor(rightOutline,[0.714,0.720],[0.714,0.591],-1),
  ];
  const pivotLocation=gl.getUniformLocation(program,"u_pivots[0]");
  const axisLocation=gl.getUniformLocation(program,"u_axes[0]");
  const angleLocation=gl.getUniformLocation(program,"u_angles[0]");
  gl.uniform3fv(pivotLocation,new Float32Array(doors.flatMap(door=>door.pivot)));
  gl.uniform3fv(axisLocation,new Float32Array(doors.flatMap(door=>door.axis)));

  // Recessed stone jambs make the opening itself read as a deep passage.
  const jambs = [];
  for(let i=0;i<openingOutline.length;i++) {
    const j=(i+1)%openingOutline.length;
    const a=toWorld(openingOutline[i]), b=toWorld(openingOutline[j]);
    const c=[b[0],b[1],-0.42],d=[a[0],a[1],-0.42];
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    jambs.push(...quad([a,b,c,d],[openingOutline[i],openingOutline[j],openingOutline[j],openingOutline[i]],
      [dy/length,-dx/length,0]));
  }
  function drawMesh(mesh, tex, mode, tone=1, sideColor=[0.25,0.12,0.045]) {
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.uniform1i(locations.mode,mode);
    gl.uniform1f(locations.tone,tone);
    gl.uniform3fv(locations.sideColor,sideColor);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh),gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES,0,mesh.length/8);
  }
  function hallQuad(bounds, z=hallPlane.z) {
    return quad([[bounds.left,bounds.top,z],[bounds.right,bounds.top,z],
      [bounds.right,bounds.bottom,z],[bounds.left,bounds.bottom,z]],imageUVs);
  }
  let width=1,height=1;
  let hallMesh;
  return {
    resize(w,h) {
      width=w;height=h;
      hallMesh=hallQuad(hallBoundsForViewport(w,h,hallAspect));
      const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(4000000/(w*h)));
      const pixelWidth=Math.max(1,Math.round(w*ratio));
      const pixelHeight=Math.max(1,Math.round(h*ratio));
      // Assigning either dimension clears the framebuffer. Avoid doing that
      // for observer notifications that did not actually change its size.
      if(canvas.width!==pixelWidth) canvas.width=pixelWidth;
      if(canvas.height!==pixelHeight) canvas.height=pixelHeight;
      gl.viewport(0,0,canvas.width,canvas.height);
    },
    draw(pose) {
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform3fv(locations.eye,pose.eye);
      gl.uniform2f(locations.focal,2*pose.focal/width,2*pose.focal/height);
      gl.uniform1f(locations.opening,pose.opening);
      gl.uniform1fv(angleLocation,new Float32Array(doors.map(door=>pose.opening*88*Math.PI/180*door.sign)));
      // The preloaded hall is always drawn first and covers the full viewport,
      // including when the gate is behind the near plane. Neither scene texture
      // is removed during entry, return, or a responsive layout change.
      drawMesh(hallMesh,hallTexture,3);
      if(pose.eye[2]>0.025) drawMesh(exterior,gateTexture,0);
      drawMesh(jambs,gateTexture,2,1,[0.36,0.20,0.09]);
      for(const door of doors) {
        const angle=pose.opening*88*Math.PI/180*door.sign;
        drawMesh(rotateDoorMesh(door.back,door,angle),gateTexture,1,0.55);
        drawMesh(rotateDoorMesh(door.sides,door,angle),gateTexture,2);
        drawMesh(rotateDoorMesh(door.front,door,angle),gateTexture,1);
      }
    }
  };
}

// Rotation about the actual hinge line. Both the face and every thickness
// edge use the same rigid transform; their attachment cannot drift.
function rotateDoorMesh(mesh, door, angle) {
  const result=new Float32Array(mesh.length);
  const [ax,ay,az]=door.axis, c=Math.cos(angle),s=Math.sin(angle),k=1-c;
  function rotate(x,y,z) {
    const dot=ax*x+ay*y+az*z;
    return [x*c+(ay*z-az*y)*s+ax*dot*k,
      y*c+(az*x-ax*z)*s+ay*dot*k,z*c+(ax*y-ay*x)*s+az*dot*k];
  }
  for(let i=0;i<mesh.length;i+=8) {
    const p=rotate(mesh[i]-door.pivot[0],mesh[i+1]-door.pivot[1],mesh[i+2]-door.pivot[2]);
    const n=rotate(mesh[i+5],mesh[i+6],mesh[i+7]);
    result.set([p[0]+door.pivot[0],p[1]+door.pivot[1],p[2]+door.pivot[2],mesh[i+3],mesh[i+4],...n],i);
  }
  return result;
}

async function initialize() {
  updateLayout();
  setControls();
  try {
    await Promise.all([...Array.from(frame.querySelectorAll("img"),loadImage),doorAudio.prepare()]);
    renderer=createSceneRenderer(canvas,document.querySelector("#gate-image"),document.querySelector("#hall-image"));
    const activeScene = getScene(scene);
    frame.dataset.environment = getEnvironment(activeScene).kind;
    updateLayout();
    document.querySelector("#gate-image").hidden=true;
    ready=true;
    frame.dataset.state="gate";
    fallback.hidden=true;
  } catch(error) {
    console.warn(error);
    frame.dataset.state="error";
    fallback.hidden=false;
    camera.hidden=true;
    hall.hidden=true;
    sceneCopy.hidden=true;
  }
  setControls();
}

gateButton.addEventListener("click",enterHall);
returnButton.addEventListener("click",returnToEntrance);
sound.addEventListener("error",()=>console.warn("Door sound unavailable."));
window.addEventListener("resize",updateLayout);
canvas.addEventListener("webglcontextlost",(event)=>{
  event.preventDefault();
  ready=false;
  fallback.hidden=false;
  setControls();
});
canvas.addEventListener("webglcontextrestored",()=>{ timeline=0;scene="gate";busy=false;void initialize(); });
if(typeof ResizeObserver!=="undefined") new ResizeObserver(updateLayout).observe(frame);
void initialize();
