import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene, camera, renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 6, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.5);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(5, 10, 7);
scene.add(dir);

// Floor / subtle grid
const grid = new THREE.GridHelper(50, 50, 0x222233, 0x0c0c0f);
grid.material.opacity = 0.12;
grid.material.transparent = true;
scene.add(grid);

// UI elements
const fileInput = document.getElementById('file');
const micBtn = document.getElementById('micBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const sensitivityEl = document.getElementById('sensitivity');
const colorEl = document.getElementById('color');
const barsSelect = document.getElementById('bars');

// Audio setup
let audioCtx = null;
let analyser = null;
let dataArray = null;
let sourceNode = null;
let audioElement = null;
let microphoneStream = null;
let isPlaying = false;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Visualizer instanced bars
let instanceCount = parseInt(barsSelect.value, 10);
let instancedMesh = null;
let indicesToFreq = [];
const radius = 6;
const barWidth = 0.25;
const barDepth = 0.8;
const baseHeight = 0.1;

function setupInstances(count) {
  if (instancedMesh) {
    scene.remove(instancedMesh);
    instancedMesh.geometry.dispose();
    instancedMesh.material.dispose();
    instancedMesh = null;
  }

  instanceCount = count;
  const geometry = new THREE.BoxGeometry(barWidth, 1, barDepth);
  const material = new THREE.MeshStandardMaterial({ color: colorEl.value, emissive: colorEl.value, emissiveIntensity: 0.25, metalness: 0.1, roughness: 0.6 });
  instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(instancedMesh);

  // initial placement around circle
  indicesToFreq = [];
  for (let i = 0; i < instanceCount; i++) {
    const angle = (i / instanceCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3(x, baseHeight / 2, z);
    const lookAt = new THREE.Vector3(0, 0, 0);
    const up = new THREE.Vector3(0,1,0);
    // rotation to face center
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, lookAt, up));
    const scale = new THREE.Vector3(1, baseHeight, 1);

    m.compose(pos, quat, scale);
    instancedMesh.setMatrixAt(i, m);

    // map instance index to approximate frequency bin index (we'll reassign later when analyser created)
    indicesToFreq.push(Math.floor((i / instanceCount) * 1024));
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
}

// initial instances
setupInstances(instanceCount);

// re-create instances when bars count changes
barsSelect.addEventListener('change', () => {
  setupInstances(parseInt(barsSelect.value, 10));
  initAnalyser(); // recreate analyser mapping if needed
});

// change color live
colorEl.addEventListener('input', () => {
  if (instancedMesh) {
    instancedMesh.material.color.set(colorEl.value);
    instancedMesh.material.emissive.set(colorEl.value);
  }
});

// build analyser (or update)
function initAnalyser() {
  if (!audioCtx) return;
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
  }
  const fftSize = analyser.fftSize;
  const bins = analyser.frequencyBinCount; // fftSize/2
  dataArray = new Uint8Array(bins);

  // remap instance index -> frequency bin index (logarithmic feel)
  indicesToFreq = [];
  for (let i = 0; i < instanceCount; i++) {
    const t = i / instanceCount;
    // bias low frequencies a bit: use exponential mapping
    const idx = Math.floor(((Math.pow(2, t * 8) - 1) / (Math.pow(2, 8) - 1)) * (bins - 1));
    indicesToFreq.push(Math.min(bins - 1, Math.max(0, idx)));
  }
}

// play / pause handlers
playBtn.addEventListener('click', async () => {
  ensureAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (audioElement) {
    audioElement.play();
    isPlaying = true;
  }
});

pauseBtn.addEventListener('click', () => {
  if (audioElement) {
    audioElement.pause();
    isPlaying = false;
  }
});

// file input
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  stopMicIfAny();
  ensureAudio();

  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
    audioElement.remove();
  }

  audioElement = document.createElement('audio');
  audioElement.src = URL.createObjectURL(f);
  audioElement.crossOrigin = "anonymous";
  audioElement.loop = true;

  sourceNode = audioCtx.createMediaElementSource(audioElement);
  initAnalyser();
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  audioElement.play();
  isPlaying = true;
});

// microphone
micBtn.addEventListener('click', async () => {
  stopAudioElementIfAny();
  ensureAudio();
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    alert('Microphone access denied or not available.');
    return;
  }
  sourceNode = audioCtx.createMediaStreamSource(microphoneStream);
  initAnalyser();
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination); // optional: avoid feedback by not connecting to destination if using mic
  isPlaying = true;
  // if you don't want to hear mic through speakers, omit connecting analyser->destination
});

// helpers to stop
function stopMicIfAny() {
  if (microphoneStream) {
    const tracks = microphoneStream.getTracks();
    tracks.forEach(t => t.stop());
    microphoneStream = null;
  }
}
function stopAudioElementIfAny() {
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
    audioElement.remove();
    audioElement = null;
  }
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch {}
    sourceNode = null;
  }
  if (analyser) {
    try { analyser.disconnect(); } catch {}
    analyser = null;
  }
}

// core animation
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();

  // read frequency data
  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);

    const sensitivity = parseFloat(sensitivityEl.value);

    const tmpMat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < instanceCount; i++) {
      const freqIdx = indicesToFreq[i];
      const v = dataArray[freqIdx] / 255; // 0..1
      const height = Math.max(baseHeight, v * sensitivity * 8);

      // compute position on circle
      const angle = (i / instanceCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pos.set(x, height / 2, z);

      // orient so face center
      const lookAt = new THREE.Vector3(0, pos.y, 0); // tilt to center
      quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, lookAt, new THREE.Vector3(0,1,0)));

      scale.set(1, height, 1);

      tmpMat.compose(pos, quat, scale);
      instancedMesh.setMatrixAt(i, tmpMat);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    // slight emissive pulse based on low/overall energy
    const bass = (dataArray[Math.floor(50 / (analyser.sampleRate / analyser.fftSize))] || 0) / 255;
    if (instancedMesh && instancedMesh.material) {
      const col = new THREE.Color(colorEl.value).multiplyScalar(0.6 + Math.min(1, bass * 1.5));
      instancedMesh.material.emissive.copy(col);
      instancedMesh.material.emissiveIntensity = 0.35 + bass * 1.5;
    }
  }

  // rotate a little for motion
  scene.rotation.y += dt * 0.02;

  controls.update();
  renderer.render(scene, camera);
}
animate();

// resize
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// initialize audio analyser if audio context already present
function autoInitAudio() {
  ensureAudio();
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
  initAnalyser();
}
autoInitAudio();
