import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;
let plane = new THREE.Plane();
let intersection = new THREE.Vector3();
let offset = new THREE.Vector3();
let dragConstraint = null;

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

// === Scene & Camera ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 5, 10);

// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Orbit Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;        // smooth motion
controls.dampingFactor = 0.05;
controls.target.set(0, 2, 0);         // optional: focus on center
controls.update();

// === Lights ===
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// === Physics World ===
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // gravity

// === Floor ===
const floorBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane()
});
floorBody.quaternion.setFromEuler(-Math.PI/2, 0, 0);
world.addBody(floorBody);

const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI/2;
scene.add(floorMesh);

// === Objects Array ===
const objects = [];

function createPhysicsMesh(shape, size, mass, color, position) {
  let mesh;
  if (shape === 'box') {
    const geometry = new THREE.BoxGeometry(size.x*2, size.y*2, size.z*2);
    mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  } else if (shape === 'sphere') {
    const geometry = new THREE.SphereGeometry(size.radius, 32, 32);
    mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  } else if (shape === 'cylinder') {
    const geometry = new THREE.CylinderGeometry(size.radiusTop, size.radiusBottom, size.height, 32);
    mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  }
  mesh.position.copy(position);
  scene.add(mesh);

  let body;
  if (shape === 'box') {
    const boxShape = new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z));
    body = new CANNON.Body({ mass, shape: boxShape });
  } else if (shape === 'sphere') {
    const sphereShape = new CANNON.Sphere(size.radius);
    body = new CANNON.Body({ mass, shape: sphereShape });
  } else if (shape === 'cylinder') {
    const cylinderShape = new CANNON.Cylinder(size.radiusTop, size.radiusBottom, size.height, 32);
    body = new CANNON.Body({ mass, shape: cylinderShape });
  }
  body.position.copy(position);
  world.addBody(body);

  objects.push({ mesh, body });
}

// === Add Objects Functions ===
function addBox() {
  createPhysicsMesh('box', { x: 1, y: 1, z: 1 }, 1, 0xff0000, new THREE.Vector3(0,5,0));
}
function addSphere() {
  createPhysicsMesh('sphere', { radius: 1 }, 1, 0x00ff00, new THREE.Vector3(Math.random()*2-1,5,0));
}
function addCylinder() {
  createPhysicsMesh('cylinder', { radiusTop: 0.5, radiusBottom: 0.5, height: 2 }, 1, 0x0000ff, new THREE.Vector3(Math.random()*2-1,5,0));
}

// === Animation Loop ===
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  world.step(1/60, dt, 3);

  objects.forEach(obj => {
    obj.mesh.position.copy(obj.body.position);
    obj.mesh.quaternion.copy(obj.body.quaternion);
  });

  controls.update();           // <-- update OrbitControls
  renderer.render(scene, camera);
}

animate();

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose functions to HTML buttons
window.addBox = addBox;
window.addSphere = addSphere;
window.addCylinder = addCylinder;

function onMouseDown(event) {
  // normalize mouse coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));

  if (intersects.length > 0) {
    selectedObject = objects.find(o => o.mesh === intersects[0].object);

    // compute offset
    plane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(plane.normal),
      intersects[0].point
    );
    offset.copy(intersects[0].point).sub(selectedObject.mesh.position);

    controls.enabled = false; // <<< disable OrbitControls while dragging
  }
}

function onMouseMove(event) {
  if (!selectedObject) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(plane, intersection);

  // move physics body toward mouse intersection
  selectedObject.body.position.copy(intersection.sub(offset));
  selectedObject.body.velocity.set(0, 0, 0);
  selectedObject.body.angularVelocity.set(0, 0, 0);
}

function onMouseUp(event) {
  selectedObject = null;
  controls.enabled = true; // <<< re-enable OrbitControls when done
}

if (selectedObject) {
  const force = intersection.sub(selectedObject.body.position).scale(50);
  selectedObject.body.applyForce(force, selectedObject.body.position);
}
