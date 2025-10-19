import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// === Scene & Camera ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101010);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(20, 20, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// === Lights ===
scene.add(new THREE.AmbientLight(0x404040));
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(50, 50, 50);
scene.add(light);

// === AI Sphere ===
const aiGeo = new THREE.SphereGeometry(0.5, 16, 16);
const aiMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const aiSphere = new THREE.Mesh(aiGeo, aiMat);
scene.add(aiSphere);

// === Cubes ===
const cubeSize = 1;
const cubes = [];

// Start position
const position = new THREE.Vector3(0, 0, 0);
aiSphere.position.copy(position);

// Helper to generate a random color
function randomColor() {
  return new THREE.Color(Math.random(), Math.random(), Math.random());
}

// Possible movement directions
const directions = [
  new THREE.Vector3(1, 0, 0),   // East
  new THREE.Vector3(-1, 0, 0),  // West
  new THREE.Vector3(0, 1, 0),   // Up
  new THREE.Vector3(0, -1, 0),  // Down
  new THREE.Vector3(0, 0, 1),   // North
  new THREE.Vector3(0, 0, -1),  // South
];

// === Function to move AI and place cube ===
function stepAI() {
  // Place cube at current position
  const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const cube = new THREE.Mesh(cubeGeo, cubeMat);
  cube.position.copy(position);
  scene.add(cube);
  cubes.push(cube);

  // Pick a random direction and move
  const dir = directions[Math.floor(Math.random() * directions.length)];
  position.add(dir);
  aiSphere.position.copy(position);
}

// === Animation Loop ===
let lastStepTime = 0;
function animate(time) {
  requestAnimationFrame(animate);
  controls.update();

  // Step AI every 200ms
  if (time - lastStepTime > 200) {
    stepAI();
    lastStepTime = time;
  }

  renderer.render(scene, camera);
}

animate();

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
