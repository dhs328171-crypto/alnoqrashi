import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ArrowDown, ArrowLeft, AudioLines, Expand, Eye, Focus, Maximize2, Move3D, Pause, Play, RotateCcw, ScanLine, Sparkles, Volume2, X } from 'lucide-react';
import './avatar-styles.css';

type Mode = 'عرض هولوجرامي مباشر' | 'معرض تفاعلي' | 'وضع الواقع الافتراضي';
const OFFICE_IMAGE = '/office-tea-scene.webp';
const NARRATION_SCRIPT = 'أهلًا بك. أنا مستر نقراشي، المدرّس الافتراضي المصري داخل حارس المجد. مهمتي أن أشرح البرمجة خطوة بخطوة، وأحوّل كل فكرة في بايثون إلى مثال بصري بسيط. في هذا الدرس أشرح التكرار: كلمة for تعني أنني أمرّ على كل طالب واحدًا تلو الآخر، ثم تطبع print اسم الطالب على الشاشة. اسحب المجسم لتشاهدني من كل زاوية، واضغط الصوت لإعادة الشرح.';

function AvatarStage({
  onReady,
  onProgress,
  onRotation,
  onVrReady,
  onVrUnsupported,
  onVrAvailable,
  onVrExited,
  onLoadError,
  autoRotate,
  speechActive,
}: {
  onReady: (ready: boolean) => void;
  onProgress: (progress: number) => void;
  onRotation: (active: boolean) => void;
  onVrReady: (begin: () => void) => void;
  onVrUnsupported: () => void;
  onVrAvailable: (available: boolean) => void;
  onVrExited: () => void;
  onLoadError: () => void;
  autoRotate: boolean;
  speechActive: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef(autoRotate);
  rotateRef.current = autoRotate;
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080d19, 0.055);
    const camera = new THREE.PerspectiveCamera(34, host.clientWidth / host.clientHeight, 0.1, 70);
    camera.position.set(0, 1.68, 5.25);
    camera.lookAt(0, 1.48, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.13;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf0dfc3, 0x281b16, 1.75));
    const keyLight = new THREE.DirectionalLight(0xffe6ca, 3.6);
    keyLight.position.set(2.8, 5.5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(512, 512);
    scene.add(keyLight);
    const cyanLight = new THREE.PointLight(0xffd9b5, 8, 8);
    cyanLight.position.set(-1.7, 2.45, 0.45);
    scene.add(cyanLight);
    const goldLight = new THREE.PointLight(0xd39a5d, 12, 7);
    goldLight.position.set(1.2, 1.4, 1.9);
    scene.add(goldLight);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.58, 80), new THREE.MeshBasicMaterial({ color: 0x23cbeb, transparent: true, opacity: 0.055, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.035;
    scene.add(floor);

    const root = new THREE.Group();
    root.position.set(0, -0.02, 0);
    scene.add(root);
    const actor = new THREE.Group();
    root.add(actor);
    let loadedAvatar = false;
    let fallbackAvatar: THREE.Group | null = null;
    let activeSession: XRSession | null = null;

    const mat = (color: number, roughness = 0.55, metalness = 0.04) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const skin = mat(0xb98464, 0.52);
    const suit = mat(0x121e32, 0.62, 0.16);
    const suitEdge = mat(0x23314a, 0.48, 0.16);
    const trousers = mat(0x111a2b, 0.69, 0.1);
    const shirt = mat(0xf1f0e9, 0.38);
    const blackHair = mat(0x15141b, 0.45);
    const fezMat = mat(0x822e32, 0.5);
    const tieMat = mat(0x192742, 0.4, 0.12);
    const brass = new THREE.MeshStandardMaterial({ color: 0xd4ad6b, metalness: 0.68, roughness: 0.31 });
    const makeMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent = actor, x = 0, y = 0, z = 0) => {
      const object = new THREE.Mesh(geometry, material);
      object.position.set(x, y, z);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    };
    const ellipsoid = (material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, parent = actor) => {
      const object = makeMesh(new THREE.SphereGeometry(1, 26, 18), material, parent, x, y, z);
      object.scale.set(sx, sy, sz);
      return object;
    };
    const cylinderBetween = (material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, top: number, bottom: number, segments = 16, parent = actor) => {
      const axis = new THREE.Vector3().subVectors(to, from);
      const object = makeMesh(new THREE.CylinderGeometry(top, bottom, axis.length(), segments, 1), material, parent);
      object.position.copy(from).add(to).multiplyScalar(0.5);
      object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
      return object;
    };

    const createFallback = () => {
      const body = new THREE.Group();
      actor.add(body);
      fallbackAvatar = body;
      // Custom anatomical A-pose so the model stays complete while its photoreal GLB is being prepared.
      ellipsoid(trousers, 0, 0.91, 0, 0.32, 0.18, 0.21, body);
      for (const side of [-1, 1]) {
        const hip = new THREE.Vector3(side * 0.17, 0.86, 0);
        const knee = new THREE.Vector3(side * 0.205, 0.49, 0.025);
        const ankle = new THREE.Vector3(side * 0.21, 0.17, 0);
        cylinderBetween(trousers, hip, knee, 0.125, 0.19, 20, body);
        ellipsoid(trousers, knee.x, knee.y, knee.z, 0.128, 0.15, 0.142, body);
        cylinderBetween(trousers, knee, ankle, 0.086, 0.118, 18, body);
        ellipsoid(suit, side * 0.217, 0.105, 0.052, 0.12, 0.09, 0.24, body);
      }

      // Broad, tapered suit torso, shaped from the waist into a powerful shoulder line.
      const torsoProfile = [
        new THREE.Vector2(0.2, 0.87), new THREE.Vector2(0.235, 1.02), new THREE.Vector2(0.265, 1.18),
        new THREE.Vector2(0.31, 1.38), new THREE.Vector2(0.405, 1.55), new THREE.Vector2(0.435, 1.67),
        new THREE.Vector2(0.365, 1.73), new THREE.Vector2(0.21, 1.72), new THREE.Vector2(0.145, 1.62),
        new THREE.Vector2(0.135, 1.02),
      ];
      const torso = makeMesh(new THREE.LatheGeometry(torsoProfile, 32), suit, body);
      torso.position.y = 0;
      torso.scale.set(1, 1, 0.76);
      ellipsoid(suit, -0.347, 1.61, 0, 0.145, 0.14, 0.23, body);
      ellipsoid(suit, 0.347, 1.61, 0, 0.145, 0.14, 0.23, body);
      cylinderBetween(skin, new THREE.Vector3(0, 1.66, 0), new THREE.Vector3(0, 1.89, 0), 0.12, 0.135, 18, body);

      // Jacket edge and collar details.
      const lapelShape = new THREE.Shape();
      lapelShape.moveTo(0, 0); lapelShape.lineTo(0.115, 0.065); lapelShape.lineTo(0.29, -0.23);
      lapelShape.lineTo(0.205, -0.37); lapelShape.lineTo(0.08, -0.17); lapelShape.closePath();
      const lapelGeometry = new THREE.ExtrudeGeometry(lapelShape, { depth: 0.024, bevelEnabled: true, bevelSize: 0.007, bevelThickness: 0.006, bevelSegments: 2 });
      for (const side of [-1, 1]) {
        const lapel = makeMesh(lapelGeometry, suitEdge, body, side * 0.025, 1.68, 0.305);
        lapel.rotation.y = side === 1 ? 0 : Math.PI;
        if (side === -1) lapel.position.x = -0.02;
      }
      const collar = ellipsoid(shirt, 0, 1.665, 0.195, 0.104, 0.13, 0.04, body);
      collar.rotation.z = Math.PI;
      cylinderBetween(tieMat, new THREE.Vector3(0, 1.67, 0.246), new THREE.Vector3(0, 1.0, 0.245), 0.045, 0.022, 10, body);
      ellipsoid(tieMat, 0, 1.68, 0.258, 0.038, 0.06, 0.022, body);
      for (const y of [1.14, 1.34, 1.53]) {
        const button = makeMesh(new THREE.SphereGeometry(0.018, 12, 8), brass, body, 0.07, y, 0.32);
        button.scale.set(1, 1, 0.38);
      }
      // A thin pocket square is a tailoring signature, not a logo.
      const pocket = ellipsoid(brass, -0.245, 1.49, 0.222, 0.065, 0.013, 0.017, body);
      pocket.rotation.z = -0.15;

      // A-pose sleeves and anatomically attached hands.
      const shoulderPoints: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [];
      for (const side of [-1, 1]) {
        const upper = new THREE.Vector3(side * 0.42, 1.53, 0);
        const elbow = new THREE.Vector3(side * 0.57, 1.19, 0.015);
        const wrist = new THREE.Vector3(side * 0.64, 0.91, 0.025);
        shoulderPoints.push([upper, elbow, wrist]);
        cylinderBetween(suit, upper, elbow, 0.118, 0.14, 20, body);
        ellipsoid(suit, elbow.x, elbow.y, elbow.z, 0.107, 0.12, 0.115, body);
        cylinderBetween(suit, elbow, wrist, 0.087, 0.108, 20, body);
        cylinderBetween(shirt, new THREE.Vector3(side * 0.632, 0.94, 0.025), wrist, 0.084, 0.09, 16, body);
        const hand = ellipsoid(skin, side * 0.648, 0.805, 0.027, 0.07, 0.12, 0.06, body);
        hand.rotation.z = side * -0.12;
        for (let i = 0; i < 4; i++) ellipsoid(skin, side * (0.61 + i * 0.023), 0.716 + Math.abs(i - 1.5) * 0.006, 0.035, 0.014, 0.055, 0.016, body);
        ellipsoid(skin, side * 0.59, 0.81, 0.06, 0.018, 0.047, 0.019, body).rotation.z = side * 0.65;
      }

      // Natural face, swept dark hairstyle, and iconic Egyptian fez.
      ellipsoid(skin, 0, 2.055, 0.02, 0.205, 0.27, 0.194, body);
      ellipsoid(skin, 0, 1.87, 0.045, 0.12, 0.11, 0.135, body);
      for (const side of [-1, 1]) {
        ellipsoid(skin, side * 0.206, 2.06, 0.005, 0.036, 0.062, 0.04, body);
        ellipsoid(mat(0xf1dec9), side * 0.082, 2.088, 0.184, 0.055, 0.026, 0.014, body);
        ellipsoid(mat(0x22202a), side * 0.082, 2.087, 0.196, 0.031, 0.02, 0.009, body);
        ellipsoid(blackHair, side * 0.082, 2.135, 0.192, 0.059, 0.017, 0.018, body);
        ellipsoid(skin, side * 0.085, 2.136, 0.204, 0.012, 0.012, 0.006, body);
      }
      ellipsoid(skin, 0, 2.032, 0.204, 0.023, 0.065, 0.034, body);
      ellipsoid(skin, 0, 1.982, 0.224, 0.03, 0.017, 0.025, body);
      const smile = ellipsoid(mat(0x7f4742), 0, 1.946, 0.211, 0.045, 0.009, 0.012, body);
      smile.rotation.z = 0.01;
      ellipsoid(mat(0xf6ebdf), 0, 1.951, 0.22, 0.037, 0.006, 0.008, body);
      ellipsoid(blackHair, 0, 2.264, 0, 0.21, 0.105, 0.191, body);
      ellipsoid(blackHair, -0.135, 2.24, 0.078, 0.11, 0.079, 0.12, body).rotation.z = 0.45;
      ellipsoid(blackHair, 0.11, 2.26, 0.04, 0.13, 0.084, 0.13, body).rotation.z = -0.24;
      const fez = makeMesh(new THREE.CylinderGeometry(0.143, 0.171, 0.225, 32), fezMat, body, 0, 2.485, 0);
      fez.rotation.z = 0.025;
      makeMesh(new THREE.CylinderGeometry(0.176, 0.176, 0.034, 32), brass, body, 0, 2.373, 0);
      const tassel = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 8, 24), brass);
      tassel.position.set(0.075, 2.38, 0.12); tassel.rotation.x = Math.PI / 2; body.add(tassel);
      const thread = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.076, 2.37, 0.13), new THREE.Vector3(0.125, 2.24, 0.13)]), new THREE.LineBasicMaterial({ color: 0xc29a66 }));
      body.add(thread);

      // Heritage-inspired gold insignia, deliberately abstract and understated.
      const pendant = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.005, 8, 40), brass);
      pendant.position.set(0, 1.038, 0.27); body.add(pendant);
      const base = makeMesh(new THREE.CylinderGeometry(0.66, 0.88, 0.13, 56), mat(0x121b28, 0.38, 0.48), body, 0, -0.015, 0);
      base.castShadow = false;
      const sole = makeMesh(new THREE.CylinderGeometry(0.83, 0.86, 0.022, 64), brass, body, 0, -0.082, 0);
      sole.castShadow = false;
    };

    const ringGroup = new THREE.Group();
    scene.add(ringGroup);
    for (const [radius, tube, color, opacity] of [[1.36, 0.009, 0x39d8ff, 0.78], [1.52, 0.003, 0xc9a46d, 0.62], [1.21, 0.004, 0x64aef0, 0.36]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 128), new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02 + (radius > 1.4 ? 0.018 : 0);
      ringGroup.add(ring);
    }
    ringGroup.visible = false;

    const particleCount = window.innerWidth < 760 ? 115 : 210;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 4.3;
      particlePositions[i * 3 + 1] = Math.random() * 3.65;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
      particleSpeeds[i] = 0.0015 + Math.random() * 0.005;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ size: 0.022, color: 0x70e5ff, transparent: true, opacity: 0.74, sizeAttenuation: true }));
    scene.add(particles);
    particles.visible = false;

    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 256; gridCanvas.height = 256;
    const ctx = gridCanvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = 'rgba(96,195,220,.12)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(111,222,245,.12)'; ctx.beginPath(); ctx.arc(128, 128, 82, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(128, 128, 115, 0, Math.PI * 2); ctx.stroke();
    }
    const gridTexture = new THREE.CanvasTexture(gridCanvas);
    const floorGrid = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: gridTexture, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    floorGrid.rotation.x = -Math.PI / 2;
    floorGrid.position.set(0, -0.087, 0);
    scene.add(floorGrid);
    floorGrid.visible = false;

    const loader = new GLTFLoader();
    loader.load('/hero-citizen-active.glb', (gltf) => {
      actor.clear();
      loadedAvatar = true;
      const avatar = gltf.scene;
      avatar.scale.setScalar(1.55);
      const bounds = new THREE.Box3().setFromObject(avatar);
      const center = bounds.getCenter(new THREE.Vector3());
      avatar.position.sub(center);
      avatar.position.y += 1.43;
      avatar.rotation.y = -Math.PI / 2;
      avatar.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true; node.receiveShadow = true;
          if (node.material instanceof THREE.MeshStandardMaterial) {
            node.material.roughness = Math.max(node.material.roughness, 0.28);
            node.material.envMapIntensity = 1.35;
          }
        }
      });
      if (gltf.animations.length > 0) {
        mixerRef.current = new THREE.AnimationMixer(avatar);
        mixerRef.current.clipAction(gltf.animations[0]).play();
      }
      actor.add(avatar);
      const headBone = avatar.getObjectByName('Head');
      if (headBone) {
        new GLTFLoader().load('/egyptian-fez-head.glb', (headGltf) => {
          const replacementHead = headGltf.scene;
          replacementHead.scale.setScalar(0.18);
          replacementHead.position.set(0, 0, 0);
          replacementHead.traverse((part) => {
            if (part instanceof THREE.Mesh) {
              part.castShadow = true;
              part.receiveShadow = true;
              part.renderOrder = 3;
              if (part.material instanceof THREE.MeshStandardMaterial) {
                part.material.roughness = Math.max(part.material.roughness, 0.72);
                part.material.metalness = Math.min(part.material.metalness, 0.02);
                part.material.envMapIntensity = 0.35;
              }
            }
          });
          headBone.add(replacementHead);
          headBone.updateMatrixWorld(true);
        }, undefined, (error) => console.warn('تعذر تحميل الوجه والطربوش الإضافيين:', error));
      }
      onReady(true);
    }, (event) => {
      onProgress(event.total > 0 ? Math.min(0.99, event.loaded / event.total) : 0.42);
    }, () => {
      createFallback();
      onProgress(1);
      onLoadError();
      onReady(true);
    });

    let dragging = false;
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = 0;
    let pinchStartZoom = camera.position.z;
    let pointerX = 0;
    let pointerY = 0;
    const onDown = (event: PointerEvent) => {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        const [a, b] = [...activePointers.values()];
        pinchStartDistance = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartZoom = camera.position.z;
        dragging = false;
      } else {
        dragging = true; pointerX = event.clientX; pointerY = event.clientY;
      }
      renderer.domElement.classList.add('is-dragging');
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const pointer = activePointers.get(event.pointerId);
      if (!pointer) return;
      pointer.x = event.clientX; pointer.y = event.clientY;
      if (activePointers.size >= 2) {
        const [a, b] = [...activePointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStartDistance > 0) camera.position.z = THREE.MathUtils.clamp(pinchStartZoom * pinchStartDistance / Math.max(distance, 1), 3.2, 7.2);
        return;
      }
      if (!dragging) return;
      root.rotation.y += (event.clientX - pointerX) * 0.007;
      root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + (event.clientY - pointerY) * 0.002, -0.12, 0.12);
      pointerX = event.clientX; pointerY = event.clientY;
      onRotation(true);
    };
    const onUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      dragging = activePointers.size === 1;
      if (dragging) {
        const remaining = [...activePointers.values()][0];
        pointerX = remaining.x; pointerY = remaining.y;
      }
      renderer.domElement.classList.toggle('is-dragging', dragging);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('lostpointercapture', onUp);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault(); camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.002, 3.2, 7.2);
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const beginVr = async () => {
      try {
        if (!navigator.xr) { onVrUnsupported(); return; }
        const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
        activeSession = session;
        let sessionReady = false;
        session.addEventListener('end', () => {
          if (activeSession === session) activeSession = null;
          if (sessionReady) onVrExited();
        }, { once: true });
        await renderer.xr.setSession(session);
        sessionReady = true;
        onVrAvailable(true);
      } catch {
        if (activeSession) { void activeSession.end().catch(() => undefined); activeSession = null; }
        onVrUnsupported();
      }
    };
    onVrReady(beginVr);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;
      if (rotateRef.current && !dragging) root.rotation.y += 0.0025;
      if (fallbackAvatar) {
        fallbackAvatar.position.y = Math.sin(elapsed * 1.12) * 0.025;
        fallbackAvatar.rotation.y += rotateRef.current && !dragging ? 0.0008 : 0;
        fallbackAvatar.rotation.x = Math.sin(elapsed * 0.55) * 0.008;
      }
      ringGroup.rotation.y = Math.sin(elapsed * 0.24) * 0.045;
      ringGroup.visible = speechActive;
      particles.visible = speechActive;
      floorGrid.visible = speechActive;
      cyanLight.intensity = speechActive ? 38 + Math.sin(elapsed * 5.2) * 12 : 27 + Math.sin(elapsed * 1.4) * 5;
      const positions = particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        let y = positions.getY(i) + particleSpeeds[i];
        if (y > 3.9) y = 0.04;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
      if (mixerRef.current) mixerRef.current.update(delta);
      if (loadedAvatar) {
        actor.position.y = Math.sin(elapsed * 1.1) * 0.018;
        if (camera.position.z > 4.9) camera.position.z = THREE.MathUtils.damp(camera.position.z, 4.45, 2, 0.016);
      }
      renderer.render(scene, camera);
    });

    const resize = () => {
      const width = host.clientWidth; const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2));
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const reset = () => { root.rotation.set(0, 0, 0); camera.position.set(0, 1.68, 5.25); camera.lookAt(0, 1.48, 0); };
    const resetHandler = () => reset();
    window.addEventListener('avatar-reset', resetHandler);

    return () => {
      renderer.setAnimationLoop(null);
      const session = activeSession ?? renderer.xr.getSession();
      if (session) void session.end().catch(() => undefined);
      activeSession = null;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      observer.disconnect();
      window.removeEventListener('avatar-reset', resetHandler);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('lostpointercapture', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [onReady, onProgress, onRotation, onVrReady, onVrUnsupported, onVrAvailable, onVrExited, onLoadError, speechActive]);
  return <div className="stage-canvas" ref={hostRef} aria-label="مجسم ثلاثي الأبعاد تفاعلي لشاب مصري يرتدي بدلة رسمية وطربوشاً" />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [mode, setMode] = useState<Mode>('عرض هولوجرامي مباشر');
  const [autoRotate, setAutoRotate] = useState(true);
  const [vrRequested, setVrRequested] = useState(false);
  const [vrAvailable, setVrAvailable] = useState(false);
  const [vrFailed, setVrFailed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechPaused, setSpeechPaused] = useState(false);
  const vrCallback = useRef<() => void>(() => undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const onVrReady = useCallback((begin: () => void) => { vrCallback.current = begin; }, []);
  const onVrUnsupported = useCallback(() => { setVrAvailable(false); setVrFailed(true); }, []);
  const onVrAvailable = useCallback((available: boolean) => { setVrAvailable(available); if (available) setVrFailed(false); }, []);
  const onVrExited = useCallback(() => { setVrRequested(false); setVrFailed(false); setMode('عرض هولوجرامي مباشر'); }, []);
  const onLoadError = useCallback(() => setLoadError(true), []);

  useEffect(() => {
    if (!navigator.xr) return;
    void navigator.xr.isSessionSupported('immersive-vr').then(onVrAvailable).catch(() => onVrAvailable(false));
  }, [onVrAvailable]);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  const showToast = (text: string) => {
    setToast(text); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4200);
  };
  const startVr = () => {
    setVrFailed(false);
    setVrRequested(true);
    setMode('وضع الواقع الافتراضي');
    vrCallback.current();
  };
  const resetView = () => window.dispatchEvent(new Event('avatar-reset'));
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); setFullscreen(true); }
      else { await document.exitFullscreen(); setFullscreen(false); }
    } catch { showToast('وضع ملء الشاشة غير متاح على هذا الجهاز.'); }
  };
  const enterExperience = () => {
    document.querySelector('#avatar-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setMode('معرض تفاعلي');
    setAutoRotate(true);
  };
  const stopNarration = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeechPaused(false);
  };
  const toggleNarration = () => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      showToast('الصوت غير مدعوم في هذا المتصفح. نص الشرح متاح أسفل الصفحة.');
      return;
    }
    const engine = window.speechSynthesis;
    if (isSpeaking) {
      if (speechPaused) { engine.resume(); setSpeechPaused(false); }
      else { engine.pause(); setSpeechPaused(true); }
      return;
    }
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(NARRATION_SCRIPT);
    utterance.lang = 'ar-EG';
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = engine.getVoices();
    const arabicVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('ar-eg'))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('ar'));
    if (arabicVoice) utterance.voice = arabicVoice;
    utterance.onstart = () => { setIsSpeaking(true); setSpeechPaused(false); };
    utterance.onend = () => { setIsSpeaking(false); setSpeechPaused(false); };
    utterance.onerror = (event) => {
      setIsSpeaking(false); setSpeechPaused(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') showToast('تعذر تشغيل الصوت؛ يمكنك قراءة نص الشرح أسفل الصفحة.');
    };
    setIsSpeaking(true);
    engine.speak(utterance);
  };
  return (
    <div className="site-shell avatar-only" dir="rtl">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#home" aria-label="حارس المجد المصري — الصفحة الرئيسية">
          <span className="brand-symbol"><span /><i /><b /></span>
          <span className="brand-copy"><strong>حارس المجد المصري</strong><small>حكاية تُرى... ولا تُروى</small></span>
        </a>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <a className="nav-active" href="#home">الرئيسية</a><a href="#tutor-studio">مختبر التعليم</a><a href="#story">حكاية الحارس</a><a href="#avatar-viewer">استكشف المجسم</a>
        </nav>
        <div className="header-actions"><span className="live-indicator"><i /> مشهد مباشر</span><button className="quiet-icon" aria-label="ملء الشاشة" aria-pressed={fullscreen} onClick={toggleFullscreen}><Expand size={18} /></button></div>
      </header>

      <main id="home">
        <section className="hero-wrap" aria-labelledby="hero-title">
          <div className="hero-topline"><span><span className="eye-glyph">𓂀</span> عرض رقمي مستوحى من الهوية المصرية</span><span className="edition"><i /> التجربة رقم ٠١ <b>—</b> القاهرة، مصر</span></div>
          <div className="hero-layout">
            <div className="hero-copy">
              <div className="eyebrow"><span /> التاريخ يُطلّ عليك من جديد <span /></div>
              <h1 id="hero-title">من روح مصر،<br /><span>يولد الحارس.</span></h1>
              <p className="hero-lead">شخصية مصرية تفاعلية ببدلة رسمية وطربوش، في مشهد مكتبي دافئ. استكشفها من كل زاوية، واستمع إلى شرحها بالعربية.</p>
              <div className="cta-row">
                <button className="primary-cta" onClick={enterExperience}><Move3D size={18} strokeWidth={1.7} /><span>اكتشف المجسم</span><ArrowLeft size={17} className="cta-arrow" /></button>
                <button className="vr-cta" title={vrAvailable ? 'WebXR متاح على هذا الجهاز' : 'قد يتطلب متصفحاً ونظارة تدعمان WebXR'} onClick={startVr}><span className="vr-symbol">VR</span><span>ادخل الواقع الافتراضي</span></button>
              </div>
              <div className="hero-caption"><span><span className="caption-rule" /> تحريك بلمسة أو سحب</span><span>اكتشف التفاصيل من كل زاوية</span></div>
              <div className="feature-chips"><span><Sparkles size={15} /> شخصية متحركة</span><i /><span><ScanLine size={15} /> شرح صوتي بالعربية</span><i /><span><Eye size={15} /> واقع افتراضي مدعوم</span></div>
            </div>

              <div className={`hero-stage office-mode ${ready ? 'stage-ready' : ''}`} id="avatar-viewer">
              <div className={`speech-hologram ${isSpeaking && !speechPaused ? 'is-active' : ''}`} aria-live="polite"><span className="holo-label">مستر نقراشي · شرح مباشر</span><strong>{isSpeaking && !speechPaused ? 'أنا أشرح التكرار في Python' : 'اضغط الصوت لأعرفك بي وأشرح لك'}</strong><p className="holo-explainer">{isSpeaking && !speechPaused ? 'for تمرّ على كل عنصر، و print تعرض النتيجة.' : 'مدرّسك الافتراضي يحوّل الكود إلى صورة.'}</p><div className="holo-code"><i>for</i> student <b>in</b> class:<br /><em>print</em>(student)</div><div className="holo-bars"><i /><i /><i /><i /><i /><i /></div></div><div className="stage-orbit orbit-a" /><div className="stage-orbit orbit-b" />
              <div className="stage-diamond" />
              <div className="generated-portrait office-photo" aria-hidden="true"><img src={OFFICE_IMAGE} alt="" /><div className="portrait-blend" /></div>
              <div className="scanline scanline-main" /><div className="scanline scanline-soft" />
              <AvatarStage onReady={setReady} onProgress={setLoadProgress} onRotation={setRotating} onVrReady={onVrReady} onVrUnsupported={onVrUnsupported} onVrAvailable={onVrAvailable} onVrExited={onVrExited} onLoadError={onLoadError} autoRotate={autoRotate} speechActive={isSpeaking && !speechPaused} />
              <div className="stage-edge edge-top"><span className="corner-tick" /> <span>MISTER NOQRASHI <b>•</b> PYTHON TEACHER</span></div>
              <div className="stage-edge edge-bottom"><span>النسخة الرقمية <b>01 / 04</b></span><span className="stage-lock">◉ اتصال آمن</span></div>
              <div className="side-measure measure-left"><i /><i /><i /><i /><i /><span>١٩٠ سم</span></div>
              <div className="stage-float-tag tag-top"><span className="tag-dot" /> القامة <b>٢٠ عاماً · ١٩٠ سم</b></div>
              <div className="stage-float-tag tag-mid"><span className="scan-mini"><ScanLine size={15} /></span> المسح الحيوي <b>{ready ? 'اكتمل' : 'جاري...'}</b></div>
              <div className="stage-float-tag tag-low">بنية ميزومورف <b>قوة. وقار.</b></div>
              <div className="stage-actions">
                <button className={`stage-action ${autoRotate ? 'selected' : ''}`} onClick={() => setAutoRotate((value) => !value)} title="تدوير تلقائي"><RotateCcw size={18} /><span>تلقائي</span></button>
                <button className="stage-action" onClick={resetView} title="إعادة ضبط زاوية المشاهدة"><Focus size={18} /><span>إعادة الضبط</span></button>
                <button className="stage-action" aria-pressed={fullscreen} onClick={toggleFullscreen} title="ملء الشاشة"><Maximize2 size={18} /><span>ملء الشاشة</span></button>
              </div>
              <div className="sound-button-wrap">
                <span>{isSpeaking ? speechPaused ? 'الشرح متوقف مؤقتًا' : 'يتحدث الآن' : 'اسمع الشرح بالعربية'}</span>
                <button className={`sound-button ${isSpeaking && !speechPaused ? 'is-speaking' : ''}`} type="button" aria-label={isSpeaking ? speechPaused ? 'متابعة الشرح' : 'إيقاف مؤقت للشرح' : 'تشغيل الشرح الصوتي'} aria-pressed={isSpeaking && !speechPaused} onClick={toggleNarration}>{isSpeaking && !speechPaused ? <Pause size={15} /> : <Volume2 size={15} />}</button>
                {isSpeaking && <button className="sound-stop-button" type="button" aria-label="إيقاف الشرح" onClick={stopNarration}><X size={13} /></button>}
              </div>
              <div className="stage-loader" aria-live="polite"><div className={`loader-orbit ${ready ? 'loaded' : ''}`}><span>مصر</span></div><div><strong>{ready ? loadError ? 'المشهد الاحتياطي جاهز' : 'الشخصية التفاعلية جاهزة' : 'تجهيز الشخصية التفاعلية'}</strong><small>{loadError ? 'تعذر تحميل الأصل — استكشف النموذج الاحتياطي' : ready ? 'اسحب لاستكشاف الشخصية' : loadProgress > 0 ? `تحميل النموذج ${Math.round(loadProgress * 100)}٪` : 'جاري تحميل الشخصية'}</small></div><span className={`loader-meter ${ready ? 'done' : ''}`} style={{ width: ready ? '100%' : `${Math.max(7, loadProgress * 100)}%` }} /></div>
              <div className="zoom-hint">{rotating ? 'حرّك المجسم بحرية' : 'اسحب للتدوير  ·  عجلة للتقريب'} <ArrowDown size={13} /></div>
            </div>
          </div>
          <div className="hero-footer"><div className="scroll-cue"><span /> استكشف التجربة <ArrowDown size={14} /></div><span className="footer-index">30° 02′ N&nbsp;&nbsp; 31° 14′ E <i /> القاهرة ٢٠٢٦</span></div>
        </section>

        <section className="below-fold" id="story">
          <div className="below-heading"><span>01 / إرثٌ ينبض بالحياة</span><h2>أكثر من مجرد مجسّم.<br /><i>شعورٌ كامل بالحضور.</i></h2><p>حضورٌ رقمي بتفاصيل دقيقة؛ من انحناءة الكتف إلى انعكاس الضوء على الطربوش. تجوّل، أمعن النظر، واستكشف الحكاية بنفسك.</p></div>
          <div className="story-cards"><article><span className="card-num">٠١</span><Move3D /><h3>انظر من كل زاوية</h3><p>اسحب بحرية حول الشخصية، واقترب من التفاصيل كأنها أمامك.</p></article><article><span className="card-num">٠٢</span><AudioLines /><h3>وقفةٌ تحكي قصة</h3><p>حركة هادئة وتفاصيل حيّة تعبّر عن الثقة والقوة الأصيلة.</p></article><article><span className="card-num">٠٣</span><span className="card-vr">VR</span><h3>ادخل العالم بنفسك</h3><p>انتقل إلى الواقع الافتراضي حيث يتحول المشهد إلى مساحة تعيشها.</p></article></div>
          <div className="narration-transcript"><div className="transcript-icon"><AudioLines size={20} /></div><div><strong>نص الشرح الصوتي</strong><p>{NARRATION_SCRIPT}</p></div></div>
          <div className="model-downloads" aria-label="تنزيل ملفات المجسم">
            <span><strong>ملفات المجسم</strong><small>النسخة المهيكلة هي المعروضة؛ والنسخة عالية التفاصيل متاحة للمراجعة.</small></span>
            <a href="/hero-citizen-active.glb" download>تنزيل النموذج الرئيسي GLB</a>
            <a href="/review/egyptian-citizen-highdetail.glb" download>تنزيل المرشح عالي التفاصيل للمراجعة</a>
          </div>
        </section>
      </main>

      {toast && <div className="toast" role="status"><span>{toast}</span><button aria-label="إغلاق" onClick={() => setToast('')}><X size={15} /></button></div>}
      <button className="scroll-top" aria-label="العودة لأعلى" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Play size={14} fill="currentColor" /></button>
      {vrRequested && vrFailed && <div className="xr-info" role="dialog" aria-modal="true"><div className="xr-icon"><span>VR</span></div><span className="xr-kicker">استكشاف غامر</span><h2>الواقع الافتراضي غير متاح هنا بعد.</h2><p>يعمل WebXR عبر متصفح متوافق ونظارة واقع افتراضي واتصال آمن. يمكنك استكشاف المجسم الآن بالسحب والتقريب على شاشتك.</p><div className="xr-status"><i /> التجربة التفاعلية ثلاثية الأبعاد متاحة الآن</div><button onClick={() => { setVrRequested(false); setVrFailed(false); setMode('عرض هولوجرامي مباشر'); }}><span>متابعة في العرض ثلاثي الأبعاد</span><ArrowLeft size={17} /></button><button className="xr-dismiss" aria-label="إغلاق" onClick={() => { setVrRequested(false); setVrFailed(false); }}><X size={16} /></button></div>}
      <div className="sr-only" aria-live="polite">{mode}</div>

    </div>
  );
}
