/* BridgeLearn V15 — Three.js Interactive Globe */
import * as THREE from 'three';

let renderer, scene, camera, globe, stars, animId;

function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;

  const W = 120, H = 120;
  canvas.width  = W;
  canvas.height = H;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.z = 2.5;

  // Globe sphere with ocean color
  const geo  = new THREE.SphereGeometry(1, 48, 48);
  const mat  = new THREE.MeshPhongMaterial({
    color:     0x1a6bb5,   // ocean blue
    emissive:  0x071b3e,
    shininess: 60,
    specular:  new THREE.Color(0x4fc3f7),
  });
  globe = new THREE.Mesh(geo, mat);
  scene.add(globe);

  // Land patches (green blobs as continents approximation)
  const continents = [
    { lat: 40,  lon: 10,  w: 0.55, h: 0.45 },  // Europe
    { lat: 10,  lon: 20,  w: 0.65, h: 0.70 },  // Africa
    { lat: 50,  lon: 90,  w: 0.80, h: 0.55 },  // Asia
    { lat: 45,  lon: -90, w: 0.55, h: 0.65 },  // N.America
    { lat: -15, lon: -55, w: 0.40, h: 0.50 },  // S.America
    { lat: -25, lon: 135, w: 0.45, h: 0.40 },  // Australia
  ];
  continents.forEach(({ lat, lon, w, h }) => {
    const cGeo = new THREE.SphereGeometry(0.01, 8, 8);
    const landGeo = new THREE.SphereGeometry(1.005, 12, 8);
    // Use a sprite-like approach with small elongated spheres
    const patch = new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 8, 6),
      new THREE.MeshPhongMaterial({ color: 0x2e7d32, emissive: 0x1b5e20 })
    );
    // Scale to make patch
    patch.scale.set(w * 0.18, h * 0.12, 0.05);
    // Position on sphere surface
    const phi   = (90 - lat)  * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    patch.position.set(
      -Math.sin(phi) * Math.cos(theta),
       Math.cos(phi),
       Math.sin(phi) * Math.sin(theta)
    );
    patch.lookAt(0, 0, 0);
    scene.add(patch);
  });

  // Atmosphere glow
  const atmGeo = new THREE.SphereGeometry(1.08, 32, 32);
  const atmMat = new THREE.MeshPhongMaterial({
    color:       0x4fc3f7,
    transparent: true,
    opacity:     0.12,
    side:        THREE.BackSide,
  });
  scene.add(new THREE.Mesh(atmGeo, atmMat));

  // Stars background
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    starPos[i * 3]     = (Math.random() - 0.5) * 20;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04 }));
  scene.add(stars);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffd54f, 1.2);
  sun.position.set(3, 2, 3);
  scene.add(sun);

  animate();
}

function animate() {
  animId = requestAnimationFrame(animate);
  if (globe) globe.rotation.y += 0.005;
  if (stars) stars.rotation.y += 0.0005;
  renderer?.render(scene, camera);
}

function destroyGlobe() {
  if (animId) cancelAnimationFrame(animId);
  renderer?.dispose();
  renderer = null;
}

// Init when world screen becomes active
document.addEventListener('DOMContentLoaded', () => {
  // Watch for world screen activation
  const observer = new MutationObserver(() => {
    const worldScreen = document.getElementById('screen-world');
    if (worldScreen?.classList.contains('active')) {
      if (!renderer) initGlobe();
    }
  });
  const sc = document.querySelector('.screens-container');
  if (sc) observer.observe(sc, { subtree: true, attributeFilter: ['class'] });
});

window.BLGlobe = { init: initGlobe, destroy: destroyGlobe };
