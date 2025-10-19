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
camera.position.set(0, 5, 15);

// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Orbit Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// === Lights ===
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(10, 10, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// === Raycaster & Mouse ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// === Objects ===
const dots = [];
const lines = [];

// Sphere geometry & material (reuse)
const sphereGeo = new THREE.SphereGeometry(0.2, 16, 16);
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

// === Functions ===
function addDot(position) {
  const dot = new THREE.Mesh(sphereGeo, sphereMat.clone());
  dot.position.copy(position);
  scene.add(dot);
  dots.push(dot);

  // Create lines from this dot to all others
  for (let i = 0; i < dots.length - 1; i++) {
    const other = dots[i];
    const points = [dot.position.clone(), other.position.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    lines.push(line);
  }
}

// Handle middle click
window.addEventListener('mousedown', (event) => {
  if (event.button === 1) { // middle mouse
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Place dot at a fixed distance (say 10 units) from the camera along the ray
    const dir = raycaster.ray.direction.clone();
    const pos = raycaster.ray.origin.clone().add(dir.multiplyScalar(10));

    addDot(pos);
  }
});

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
