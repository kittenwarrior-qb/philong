import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import './style.css';

// Thêm state mới: copy file .fbx (Mixamo) vào public/models rồi khai báo ở đây.
const STATES = [
  { key: 'idle', label: 'Idle', file: 'idle.fbx' },
  { key: 'walking', label: 'Walking', file: 'walking.fbx' },
  { key: 'catwalk', label: 'Catwalk', file: 'catwalk.fbx' },
  { key: 'silly', label: 'Silly Dance', file: 'silly-dancing.fbx' },
  { key: 'chicken', label: 'Chicken Dance', file: 'chicken-dance.fbx' },
  { key: 'flair', label: 'Flair', file: 'flair.fbx' },
  { key: 'tpose', label: 'T-Pose', file: 'tpose.fbx' },
];
const BASE_STATE = 'idle';
const FADE = 0.4;

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const statesEl = document.getElementById('states');

// --- Renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe4eb);
scene.fog = new THREE.Fog(0xdfe4eb, 8, 20);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.3, 5.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

// --- Lights ---
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2d0, 1.3));

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(3, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -3;
scene.add(key);

const rim = new THREE.DirectionalLight(0x93c5fd, 0.9);
rim.position.set(-3, 3, -4);
scene.add(rim);

// --- Floor ---
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4, 64),
  new THREE.MeshStandardMaterial({ color: 0xe8ecf1, roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.PolarGridHelper(4, 16, 8, 64, 0xcbd5e1, 0xdde3ea);
grid.position.y = 0.001;
scene.add(grid);

// --- Loading ---
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  loaderText.textContent = `Đang tải nhân vật… ${Math.round((loaded / total) * 100)}%`;
};
const fbxLoader = new FBXLoader(manager);
fbxLoader.setPath('/models/');
const fallbackMap = new THREE.TextureLoader(manager).load('/models/basecolor.jpg');
fallbackMap.colorSpace = THREE.SRGBColorSpace;

let mixer;
let model;
const actions = {};
let current;

// Bỏ track di chuyển root (Hips.position x/z) để nhân vật đi tại chỗ.
function makeInPlace(clip) {
  clip.tracks.forEach((t) => {
    if (!/Hips\.position$/.test(t.name)) return;
    const v = t.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = v[0];
      v[i + 2] = v[2];
    }
  });
  return clip;
}

function prepareModel(fbx) {
  // Mixamo xuất đơn vị cm -> scale về mét, cao ~1.8m.
  const box = new THREE.Box3().setFromObject(fbx);
  const height = box.max.y - box.min.y;
  fbx.scale.setScalar(1.8 / height);

  fbx.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = false;
    // Mesh retopology từ OBJ không có normal -> tự tính, nếu không sẽ bị đen.
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    obj.material = new THREE.MeshStandardMaterial({
      map: fallbackMap,
      roughness: 0.85,
      metalness: 0,
    });
  });
  return fbx;
}

function setState(name) {
  const next = actions[name];
  if (!next || next === current) return;
  next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
  if (current) current.fadeOut(FADE);
  current = next;
  statesEl.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === name);
  });
}

function buildButtons() {
  STATES.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${i + 1}. ${s.label}`;
    btn.dataset.key = s.key;
    btn.disabled = true;
    btn.addEventListener('click', () => setState(s.key));
    statesEl.appendChild(btn);
  });
  window.addEventListener('keydown', (e) => {
    const s = STATES[Number(e.key) - 1];
    if (s) setState(s.key);
  });
}

async function init() {
  buildButtons();
  const base = STATES.find((s) => s.key === BASE_STATE);

  model = prepareModel(await fbxLoader.loadAsync(base.file));
  scene.add(model);
  mixer = new THREE.AnimationMixer(model);

  const results = await Promise.allSettled(
    STATES.map((s) => (s === base ? Promise.resolve(model) : fbxLoader.loadAsync(s.file)))
  );
  results.forEach((r, i) => {
    const s = STATES[i];
    const btn = statesEl.querySelector(`[data-key="${s.key}"]`);
    if (r.status !== 'fulfilled' || !r.value.animations.length) {
      console.warn(`Không load được animation: ${s.file}`, r.reason);
      btn.remove();
      return;
    }
    const clip = makeInPlace(r.value.animations[0].clone());
    clip.name = s.key;
    actions[s.key] = mixer.clipAction(clip);
    btn.disabled = false;
  });

  setState(BASE_STATE);
  loaderEl.classList.add('hidden');
}

init().catch((err) => {
  console.error(err);
  loaderText.textContent = 'Lỗi tải model — xem console.';
});

// --- Loop ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Đèn fill phía trước để mặt nhân vật sáng rõ.
const fill = new THREE.DirectionalLight(0xfff4e6, 0.5);
fill.position.set(-2, 2, 5);
scene.add(fill);
