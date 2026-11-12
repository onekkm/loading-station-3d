import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { building, createLoadingStation, manualIntake, stackerPosition, warehouse } from './model.js';
import { avatarCameraOffset, loadWarehouseAvatar } from './warehouse-avatar.js';

const areaDirections = {
  overview: { iso: [-1, 0.38, 0.55], side: [-1, 0, 0], top: [-0.0001, 1, 0] },
  inbound: { iso: [-0.5, 0.48, 1], side: [0, 0, 1], top: [0, 1, 0.0001] },
  outbound: { side: [0, 0, -1], top: [0, 1, 0.0001] },
};
const detailViews = {
  inbound: {
    transfer: { position: [0.6, 11.6, -11.95], target: [7.0, 1.2, -21.65], fov: 55 },
    'rack-side': { position: [5.4, 11.75, -37.1], target: [17.25, 2.55, -25.2], fov: 51 },
    'manual-intake': {
      position: [5.0, 4.05, manualIntake.z + 4.06],
      target: [10.96, 1.22, manualIntake.z - 0.19],
      fov: 50,
    },
  },
  outbound: {
    'outbound-transfer': { position: [4.3, 11, 30.9], target: [8.48, 1.28, 22.5], fov: 56 },
    'outbound-rack-side': {
      position: [stackerPosition.x - 0.9, 9.7, 36.6],
      target: [stackerPosition.x, 3.1, 24.78],
      fov: 48,
    },
    'aisle-stacker': {
      position: [stackerPosition.x - 0.22, 3.85, warehouse.rack.farEnd + 5.65],
      target: [stackerPosition.x, 5.0, stackerPosition.z],
      fov: 62,
    },
  },
};
const up = new THREE.Vector3(0, 1, 0);
const distance = 128;
const perspectiveFar = 400;
const flightSpeed = 14;
const flightVerticalKeys = new Set(['KeyE', 'KeyQ']);
const movementKeys = new Set([
  'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown',
  'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight',
  ...flightVerticalKeys,
]);

function createDaylight(sunDirection) {
  const width = 256;
  const height = 128;
  const pixels = new Uint16Array(width * height * 4);
  const direction = new THREE.Vector3();
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let row = 0; row < height; row++) {
    const latitude = ((row + 0.5) / height - 0.5) * Math.PI;
    const elevation = Math.sin(latitude);
    const horizontal = Math.cos(latitude);
    const sky = THREE.MathUtils.smoothstep(elevation, -0.09, 0.55);
    const base = THREE.MathUtils.lerp(0.11, 0.48, sky);
    const windowBand = Math.exp(-(((elevation - 0.34) / 0.17) ** 2));
    for (let column = 0; column < width; column++) {
      const azimuth = ((column + 0.5) / width - 0.5) * Math.PI * 2;
      direction.set(Math.cos(azimuth) * horizontal, elevation, Math.sin(azimuth) * horizontal);
      const highlight = 4.8 * Math.exp((direction.dot(sunDirection) - 1) * 73);
      const windowLight = 0.75 * windowBand * Math.exp((Math.cos(azimuth - 0.74) - 1) * 8);
      const index = (row * width + column) * 4;
      pixels[index] = toHalf(base * (1 - sky * 0.07) + highlight + windowLight * 0.91);
      pixels[index + 1] = toHalf(base + highlight * 0.94 + windowLight);
      pixels[index + 2] = toHalf(base * (0.91 + sky * 0.16) + highlight * 0.83 + windowLight);
      pixels[index + 3] = toHalf(1);
    }
  }
  const environment = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.minFilter = environment.magFilter = THREE.LinearFilter;
  environment.needsUpdate = true;
  return environment;
}

export function createViewer(host, { axes, onSelect, onViewChange, onAvatarReady, onAvatarSelection, initialArea = 'overview', initialView = 'iso' }) {
  const scene = new THREE.Scene();
  const { model, groups } = createLoadingStation();
  scene.add(model);
  model.updateMatrixWorld(true);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '可旋转的立体仓库三维模型');

  scene.add(new THREE.HemisphereLight(0xeef0ee, 0x8a8478, 0.42));
  const sun = new THREE.DirectionalLight(0xfff5e9, 2.4);
  sun.position.set(-36, 59, 37);
  sun.target.position.set(5, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 38, bottom: -38, near: 4, far: 130 });
  sun.shadow.bias = -0.00009;
  sun.shadow.normalBias = 0.016;
  sun.shadow.radius = 2.2;
  sun.shadow.intensity = 0.91;
  scene.add(sun, sun.target);
  scene.environment = createDaylight(sun.position.clone().sub(sun.target.position).normalize());
  scene.environmentIntensity = 0.72;
  const fill = new THREE.DirectionalLight(0xe8eced, 0.24);
  fill.position.set(13, 9, -18);
  scene.add(fill);

  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(210, 210), new THREE.ShadowMaterial({ opacity: 0.24 }));
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = -0.52;
  groundShadow.receiveShadow = true;
  scene.add(groundShadow);

  const grid = new THREE.GridHelper(164, 82, 0x858682, 0x585956);
  grid.position.y = -0.515;
  grid.material.transparent = true;
  grid.material.opacity = 0.21;
  grid.material.depthWrite = false;
  scene.add(grid);

  const selection = new THREE.Box3Helper(new THREE.Box3(), 0x87ebd8);
  selection.material.transparent = true;
  selection.material.opacity = 0.65;
  selection.visible = false;
  scene.add(selection);

  const bounds = new Map();
  const framingPoints = { overview: [], inbound: [], outbound: [] };
  const addCorners = ({ min, max }, points) => {
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z));
      }
    }
  };
  for (const [id, group] of groups) {
    bounds.set(id, new THREE.Box3().setFromObject(group));
  }
  model.traverse((object) => {
    if (object.isMesh) addCorners(new THREE.Box3().setFromObject(object), framingPoints.overview);
  });
  const overallBounds = new THREE.Box3().setFromObject(model);
  const sceneExtent = overallBounds.getBoundingSphere(new THREE.Sphere());
  const laneWall = warehouse.floor.wallZ;
  for (const id of ['inbound', 'outbound']) {
    const group = groups.get(id);
    group.traverse((object) => {
      if (object.isMesh) addCorners(new THREE.Box3().setFromObject(object), framingPoints[id]);
    });
    const laneBounds = bounds.get(id).clone();
    laneBounds.min.x = Math.min(laneBounds.min.x, -13.3);
    laneBounds.min.y = 0;
    laneBounds.max.y = 2.2;
    if (id === 'inbound') laneBounds.min.z = -laneWall;
    else laneBounds.max.z = laneWall;
    addCorners(laneBounds, framingPoints[id]);
  }

  const orthographic = new THREE.OrthographicCamera(-24, 24, 15, -15, 0.1, 260);
  const perspective = new THREE.PerspectiveCamera(50, 1, 0.1, perspectiveFar);
  const clippedCamera = new THREE.PerspectiveCamera();
  let camera = orthographic;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.16;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.85;
  controls.minZoom = 0.27;
  controls.maxZoom = 7;
  controls.minDistance = 3;
  controls.maxDistance = 230;
  controls.maxPolarAngle = Math.PI * 0.54;
  const compass = [
    [new THREE.Vector3(1, 0, 0), axes.querySelector('.axis-x')],
    [new THREE.Vector3(0, 1, 0), axes.querySelector('.axis-y')],
    [new THREE.Vector3(0, 0, 1), axes.querySelector('.axis-z')],
  ].map(([axis, element]) => ({
    axis, element, line: element.querySelector('line'), label: element.querySelector('text'),
  }));
  const cameraRotation = new THREE.Quaternion();
  const screenAxis = new THREE.Vector3();

  let activeView = initialView;
  let activeArea = initialArea;
  let currentSelection;
  let fitted = true;
  let aspect = 1;
  let span = 30;
  let frameRequest = 0;
  let transition;
  let lastMoveFrame = 0;
  let avatar;
  let avatarSelected = false;
  let followingAvatar = false;
  let flying = false;
  let matchedFov;
  const avatarReady = loadWarehouseAvatar(model, scene).then((loaded) => {
    avatar = loaded;
    onAvatarReady(true);
    invalidate();
  }).catch((error) => {
    console.error('无法载入仓库数字人。', error);
    onAvatarReady(false);
  });
  const pressedKeys = new Set();
  const cameraOffset = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const flightStep = new THREE.Vector3();
  const lookAngles = new THREE.Spherical();
  const avatarDirection = new THREE.Vector3();

  function invalidate() {
    if (!frameRequest) frameRequest = requestAnimationFrame(draw);
  }

  function viewCamera() {
    if (!followingAvatar) return camera;
    const { frontX, rearX, endZ } = building;
    const { x, z } = camera.position;
    const limitedX = THREE.MathUtils.clamp(x, frontX + 0.22, rearX - 0.22);
    const limitedZ = THREE.MathUtils.clamp(z, -endZ + 0.22, endZ - 0.22);
    if (x === limitedX && z === limitedZ) return camera;
    // Clip only the rendered camera so rotating away from a wall restores the orbit distance.
    const target = controls.target;
    const fractionX = x === limitedX ? 1 : (limitedX - target.x) / (x - target.x);
    const fractionZ = z === limitedZ ? 1 : (limitedZ - target.z) / (z - target.z);
    clippedCamera.copy(camera, false);
    clippedCamera.position.lerpVectors(target, camera.position, Math.min(fractionX, fractionZ));
    clippedCamera.updateMatrixWorld(true);
    return clippedCamera;
  }

  function draw(time) {
    frameRequest = 0;
    if (transition) {
      const { start, offset, startDirection, endDirection, startTarget, endTarget, startZoom } = transition;
      const progress = Math.min((time - start) / 350, 1);
      const eased = 1 - (1 - progress) ** 3;
      offset.setFromSphericalCoords(
        THREE.MathUtils.lerp(startDirection.radius, endDirection.radius, eased),
        THREE.MathUtils.lerp(startDirection.phi, endDirection.phi, eased),
        THREE.MathUtils.lerp(startDirection.theta, endDirection.theta, eased),
      );
      controls.target.lerpVectors(startTarget, endTarget, eased);
      camera.position.copy(controls.target).add(offset);
      camera.zoom = THREE.MathUtils.lerp(startZoom, 1, eased);
      camera.updateProjectionMatrix();
      if (progress < 1) invalidate();
      else transition = undefined;
    }
    if (pressedKeys.size || (avatarSelected && avatar.settling)) {
      move(Math.max(0, (time - lastMoveFrame) / 1000));
      lastMoveFrame = time;
      if (pressedKeys.size || (avatarSelected && avatar.settling)) invalidate();
    }
    controls.update();
    renderer.render(scene, viewCamera());
    cameraRotation.copy(camera.quaternion).invert();
    for (const { axis, element, line, label } of compass) {
      screenAxis.copy(axis).applyQuaternion(cameraRotation);
      element.style.display = Math.hypot(screenAxis.x, screenAxis.y) < 0.18 ? 'none' : '';
      line.setAttribute('x2', 35 + screenAxis.x * 22);
      line.setAttribute('y2', 35 - screenAxis.y * 22);
      label.setAttribute('x', 35 + screenAxis.x * 31);
      label.setAttribute('y', 35 - screenAxis.y * 31);
    }
  }
  controls.addEventListener('change', invalidate);

  function resizeProjection() {
    if (camera === perspective) {
      camera.aspect = aspect;
      const detail = detailViews[activeArea]?.[activeView];
      if (followingAvatar) {
        camera.fov = 53;
      } else if (matchedFov !== undefined) {
        camera.fov = matchedFov;
      } else if (detail) {
        const halfFov = Math.tan(THREE.MathUtils.degToRad(detail.fov / 2)) * Math.max(1, 1.14 / aspect);
        camera.fov = Math.min(69, THREE.MathUtils.radToDeg(2 * Math.atan(halfFov)));
      } else {
        const halfFov = Math.tan(THREE.MathUtils.degToRad(26)) * Math.min(1, 1.25 / aspect);
        camera.fov = Math.max(46, THREE.MathUtils.radToDeg(2 * Math.atan(halfFov)));
      }
    } else {
      camera.left = -span * aspect / 2;
      camera.right = span * aspect / 2;
      camera.top = span / 2;
      camera.bottom = -span / 2;
    }
    camera.updateProjectionMatrix();
  }

  function switchCamera(nextCamera) {
    transition = undefined;
    controls.enableDamping = false;
    controls.update();
    camera = nextCamera;
    controls.object = camera;
    controls.enableDamping = true;
  }

  function move(seconds) {
    const forward = Number(pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp'))
      - Number(pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown'));
    const right = Number(pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight'))
      - Number(pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft'));
    if (!avatarSelected) {
      const vertical = Number(pressedKeys.has('KeyE')) - Number(pressedKeys.has('KeyQ'));
      if (seconds > 0 && (forward || right || vertical)) moveCamera(forward, right, vertical, seconds);
      return;
    }
    camera.getWorldDirection(avatarDirection);
    avatarDirection.y = 0;
    avatarDirection.normalize();
    cameraRight.crossVectors(avatarDirection, up);
    avatarDirection.multiplyScalar(forward).addScaledVector(cameraRight, right).normalize();
    const displacement = avatar.update(avatarDirection, Math.min(seconds, 0.2), pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight'));
    if (followingAvatar) {
      camera.position.add(displacement);
      controls.target.add(displacement);
    }
  }

  function startFlight() {
    if (flying) return;
    if (camera === orthographic) {
      // Match the framing at the orbit target before moving in perspective.
      switchCamera(perspective);
      camera.position.copy(orthographic.position);
      const halfHeight = (orthographic.top - orthographic.bottom) / (2 * orthographic.zoom);
      matchedFov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / controls.getDistance()));
      resizeProjection();
    }
    flying = true;
    controls.mouseButtons.LEFT = null;
    controls.maxPolarAngle = Math.PI;
  }

  function stopFlight() {
    if (!flying) return;
    flying = false;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.maxPolarAngle = Math.PI * 0.54;
  }

  function moveCamera(forward, right, vertical, seconds) {
    startFlight();
    cameraOffset.subVectors(controls.target, camera.position).normalize();
    cameraRight.crossVectors(cameraOffset, up).normalize();
    flightStep.copy(cameraOffset).multiplyScalar(forward).addScaledVector(cameraRight, right).addScaledVector(up, vertical);
    if (flightStep.lengthSq() < 0.000001) return;
    flightStep.normalize().multiplyScalar(flightSpeed * seconds);
    camera.position.add(flightStep);
    controls.target.add(flightStep);
    const far = Math.max(perspectiveFar, camera.position.distanceTo(sceneExtent.center) + sceneExtent.radius);
    if (far !== camera.far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  function lookAround(deltaX, deltaY) {
    const sensitivity = 2 * Math.PI * controls.rotateSpeed / Math.max(1, host.clientHeight);
    cameraOffset.subVectors(controls.target, camera.position);
    lookAngles.setFromVector3(cameraOffset);
    lookAngles.theta -= deltaX * sensitivity;
    lookAngles.phi += deltaY * sensitivity;
    lookAngles.makeSafe();
    controls.target.copy(camera.position).add(cameraOffset.setFromSpherical(lookAngles));
    controls.update();
    invalidate();
  }

  function fitView(view, animate = true) {
    if (view === 'avatar') {
      if (followingAvatar) detachAvatarView();
      else followAvatar();
      return;
    }
    if (!avatarSelected) pressedKeys.clear();
    stopFollowing();
    stopFlight();
    matchedFov = undefined;
    activeView = view;
    fitted = true;
    const detail = detailViews[activeArea]?.[view];
    if (detail || (activeArea === 'outbound' && view === 'iso')) {
      switchCamera(perspective);
      camera.far = perspectiveFar;
      if (detail) {
        controls.target.fromArray(detail.target);
        camera.position.fromArray(detail.position);
      } else {
        const { areaOffset } = warehouse;
        controls.target.set(-4.5, 0.8, areaOffset + 2.64);
        camera.position.set(-19.9, 10, areaOffset + 3.48);
      }
      resizeProjection();
      controls.update();
      onViewChange(view, activeArea);
      invalidate();
      return;
    }
    if (camera !== orthographic) {
      switchCamera(orthographic);
      animate = false;
    }
    const direction = new THREE.Vector3(...areaDirections[activeArea][view]).normalize();
    const right = new THREE.Vector3().crossVectors(up, direction).normalize();
    const vertical = new THREE.Vector3().crossVectors(direction, right);
    const box = new THREE.Box2();
    const projected = new THREE.Vector2();
    for (const point of framingPoints[activeArea]) {
      box.expandByPoint(projected.set(point.dot(right), point.dot(vertical)));
    }
    const center = box.getCenter(new THREE.Vector2());
    const size = box.getSize(new THREE.Vector2());
    const depth = (bounds.get(activeArea) ?? overallBounds).getCenter(new THREE.Vector3()).dot(direction);
    const target = right.multiplyScalar(center.x).addScaledVector(vertical, center.y).addScaledVector(direction, depth);
    const endOffset = direction.multiplyScalar(distance);
    const previousSpan = span;
    span = Math.max(size.x * 1.16 / aspect, size.y * 1.2);
    resizeProjection();

    if (animate) {
      const startDirection = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const endDirection = new THREE.Spherical().setFromVector3(endOffset);
      const difference = endDirection.theta - startDirection.theta;
      endDirection.theta = startDirection.theta + THREE.MathUtils.euclideanModulo(difference + Math.PI, Math.PI * 2) - Math.PI;
      transition = {
        start: performance.now(),
        offset: new THREE.Vector3(),
        startDirection,
        endDirection,
        startTarget: controls.target.clone(),
        endTarget: target,
        startZoom: camera.zoom * span / previousSpan,
      };
    } else {
      transition = undefined;
      camera.zoom = 1;
      controls.target.copy(target);
      camera.position.copy(target).add(endOffset);
      camera.updateProjectionMatrix();
      controls.update();
    }
    onViewChange(view, activeArea);
    invalidate();
  }

  function focusArea(area) {
    activeArea = area;
    fitView('iso');
  }

  function setAvatarSelected(selected) {
    if (!avatar || avatarSelected === selected) return;
    pressedKeys.clear();
    avatarSelected = selected;
    avatar.setSelected(selected);
    if (selected) onSelect(undefined);
    else {
      avatar.stop();
      detachAvatarView();
    }
    onAvatarSelection(selected);
    invalidate();
  }

  function toggleAvatarControl() {
    setAvatarSelected(!avatarSelected);
  }

  function stopFollowing() {
    if (!followingAvatar) return;
    followingAvatar = false;
    controls.enablePan = true;
    controls.minDistance = 3;
    controls.maxDistance = 230;
    controls.maxPolarAngle = Math.PI * 0.54;
  }

  function detachAvatarView() {
    if (!followingAvatar) return;
    const rendered = viewCamera();
    stopFollowing();
    camera.getWorldDirection(cameraOffset);
    camera.position.copy(rendered.position);
    if (controls.getDistance() < controls.minDistance) {
      controls.target.copy(camera.position).addScaledVector(cameraOffset, controls.minDistance);
    }
    matchedFov = camera.fov;
    onViewChange(null, activeArea);
    invalidate();
  }

  function followAvatar() {
    if (!avatar) return;
    if (!avatarSelected) pressedKeys.clear();
    stopFlight();
    switchCamera(perspective);
    followingAvatar = true;
    controls.enablePan = false;
    controls.minDistance = 1.9;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.49;
    fitted = false;
    camera.far = perspectiveFar;
    controls.target.copy(avatar.root.position);
    controls.target.y += 0.98;
    camera.position.copy(controls.target).add(avatarCameraOffset);
    resizeProjection();
    controls.update();
    onViewChange('avatar', activeArea);
    invalidate();
  }

  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (!width || !height) return;
    aspect = width / height;
    renderer.setSize(width, height, false);
    if (fitted) fitView(activeView, false);
    else resizeProjection();
    invalidate();
  });
  resize.observe(host);

  function setMovementKey(code, pressed) {
    if (!pressed) {
      pressedKeys.delete(code);
      return;
    }
    if (pressedKeys.has(code)) return;
    const fromIdle = pressedKeys.size === 0;
    if (fromIdle && !avatarSelected) {
      const wasFollowing = followingAvatar;
      detachAvatarView();
      fitted = false;
      transition = undefined;
      if (!wasFollowing) onViewChange(null, activeArea);
    }
    pressedKeys.add(code);
    if (fromIdle) {
      lastMoveFrame = performance.now();
      move(0.02);
    }
    invalidate();
  }

  window.addEventListener('keydown', (event) => {
    const sprintKey = avatarSelected && (event.code === 'ShiftLeft' || event.code === 'ShiftRight');
    if ((!movementKeys.has(event.code) && !sprintKey) || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (avatarSelected && flightVerticalKeys.has(event.code)) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    if (!event.repeat) setMovementKey(event.code, true);
  });
  window.addEventListener('keyup', (event) => setMovementKey(event.code, false));
  window.addEventListener('blur', () => pressedKeys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pressedKeys.clear();
  });

  const raycaster = new THREE.Raycaster();
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    const { clientX: x, clientY: y, button } = event;
    const looking = flying && event.pointerType === 'mouse' && button === 0;
    pointerStart = { x, y, button, looking, lastX: x, lastY: y, dragged: false };
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!event.isPrimary || !pointerStart) return;
    const { clientX: x, clientY: y } = event;
    if (!pointerStart.dragged && Math.hypot(pointerStart.x - x, pointerStart.y - y) < 5) return;
    pointerStart.dragged = true;
    fitted = false;
    transition = undefined;
    if (pointerStart.looking && flying) {
      lookAround(x - pointerStart.lastX, y - pointerStart.lastY);
      pointerStart.lastX = x;
      pointerStart.lastY = y;
    }
    if (!followingAvatar && pointerStart.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey) onViewChange(null, activeArea);
  });
  renderer.domElement.addEventListener('wheel', () => {
    fitted = false;
    transition = undefined;
  }, { passive: true });
  renderer.domElement.addEventListener('pointercancel', () => { pointerStart = undefined; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!event.isPrimary) return;
    const start = pointerStart;
    pointerStart = undefined;
    if (!start || start.dragged || start.button !== 0 || Math.hypot(start.x - event.clientX, start.y - event.clientY) >= 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1,
    );
    const rendered = viewCamera();
    rendered.updateMatrixWorld();
    raycaster.setFromCamera(pointer, rendered);
    const visible = [];
    model.traverseVisible((object) => {
      if (object.isMesh && groups.has(object.parent.userData.component)) visible.push(object);
    });
    const avatarMeshes = new Set();
    avatar?.root.traverseVisible((object) => {
      if (!object.isSkinnedMesh) return;
      object.computeBoundingSphere();
      avatarMeshes.add(object);
      visible.push(object);
    });
    const [hit] = raycaster.intersectObjects(visible, false);
    if (avatarMeshes.has(hit?.object)) toggleAvatarControl();
    else {
      setAvatarSelected(false);
      onSelect(hit?.object.parent.userData.component);
    }
  });

  function select(id) {
    currentSelection = id;
    let group = groups.get(id);
    selection.visible = Boolean(group?.children.some((child) => child.visible));
    while (group && selection.visible) {
      selection.visible = group.visible;
      group = group.parent;
    }
    if (selection.visible) selection.box.copy(bounds.get(id)).expandByScalar(0.055);
    invalidate();
  }

  function setVisible(id, visible) {
    groups.get(id).visible = visible;
    renderer.shadowMap.needsUpdate = true;
    if (currentSelection) select(currentSelection);
    invalidate();
  }

  function toggleGrid(visible) {
    grid.visible = visible;
    invalidate();
  }

  async function exportModel() {
    await avatarReady;
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const data = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: false, animations: avatar?.clips ?? [] });
    return new Blob([data], { type: 'model/gltf-binary' });
  }

  return { fitView, focusArea, select, setVisible, toggleGrid, toggleAvatarControl, setAvatarSelected, setMovementKey, exportModel };
}
