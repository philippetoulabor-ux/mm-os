"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { useDesktop } from "@/context/DesktopContext";

function parseBinarySTL(buffer) {
  const view = new DataView(buffer);
  const n = view.getUint32(80, true);
  const positions = new Float32Array(n * 9);
  const normals = new Float32Array(n * 9);
  let p = 0;
  let no = 0;

  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50;
    const nx = view.getFloat32(base, true);
    const ny = view.getFloat32(base + 4, true);
    const nz = view.getFloat32(base + 8, true);

    for (let v = 0; v < 3; v++) {
      const vb = base + 12 + v * 12;
      positions[p++] = view.getFloat32(vb, true);
      positions[p++] = view.getFloat32(vb + 4, true);
      positions[p++] = view.getFloat32(vb + 8, true);

      normals[no++] = nx;
      normals[no++] = ny;
      normals[no++] = nz;
    }
  }

  return { positions, normals };
}

async function loadCenteredStlGeometry(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`STL fetch failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const { positions, normals } = parseBinarySTL(buffer);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.computeBoundingBox();

  const bb = geo.boundingBox;
  geo.translate(
    -(bb.max.x + bb.min.x) / 2,
    -(bb.max.y + bb.min.y) / 2,
    -(bb.max.z + bb.min.z) / 2
  );

  const maxDim = Math.max(
    bb.max.x - bb.min.x,
    bb.max.y - bb.min.y,
    bb.max.z - bb.min.z
  );
  const scale = maxDim > 0 ? 1.6 / maxDim : 1;
  return { geo, scale };
}

function centerAndScaleObject(root) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? 1.6 / maxDim : 1;
  root.scale.setScalar(scale);
}

function applyDefaultObjMaterials(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.25,
        roughness: 0.45,
      });
      if (Array.isArray(child.material)) {
        child.material = child.material.map(() => mat.clone());
      } else {
        child.material = mat;
      }
    }
  });
}

/**
 * @param {{ modelUrl: string, fileName: string, background: { url: string, kind: 'image'|'video' } | null, windowId?: string }} props
 */
export function Model3DViewer({
  modelUrl,
  fileName,
  background,
  windowId,
  unifiedParentScroll = false,
}) {
  const wrapRef = useRef(null);
  const canvasHostRef = useRef(null);
  const fittedNoBg = useRef(false);
  const { fitWindowToContentSize } = useDesktop();

  const fitFromDimensions = useCallback(
    (w, h) => {
      if (windowId) fitWindowToContentSize(windowId, w, h);
    },
    [windowId, fitWindowToContentSize]
  );

  const onBgImgLoad = useCallback(
    (e) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      fitFromDimensions(naturalWidth, naturalHeight);
    },
    [fitFromDimensions]
  );

  const onBgVideoMeta = useCallback(
    (e) => {
      const v = e.currentTarget;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        fitFromDimensions(v.videoWidth, v.videoHeight);
      }
    },
    [fitFromDimensions]
  );

  useEffect(() => {
    if (background) {
      fittedNoBg.current = false;
      return;
    }
    if (!windowId || fittedNoBg.current) return;
    fittedNoBg.current = true;
    fitFromDimensions(1, 1);
  }, [background, windowId, fitFromDimensions]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let ro = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    const disposeList = [];

    const lower = fileName.toLowerCase();
    const isStl = lower.endsWith(".stl");
    const isObj = lower.endsWith(".obj");
    const isGltf = /\.(glb|gltf)$/i.test(fileName);

    const waitForSize = () =>
      new Promise((resolve) => {
        const check = () => {
          if (disposed) return;
          if (host.offsetWidth > 0 && host.offsetHeight > 0) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });

    (async () => {
      await waitForSize();
      if (disposed) return;

      const w = host.offsetWidth;
      const h = host.offsetHeight;
      const aspect = w / h;

      renderer = new THREE.WebGLRenderer({
        alpha: !background,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (background) {
        renderer.setClearColor(0x000000, 0);
      } else {
        renderer.setClearColor(0x000000, 0);
      }

      const canvas = renderer.domElement;
      Object.assign(canvas.style, {
        display: "block",
        width: "100%",
        height: "100%",
      });
      host.appendChild(canvas);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 500);
      camera.position.set(0, 0.4, 3.2);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.95);
      key.position.set(4, 8, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xe8e8ff, 0.35);
      fill.position.set(-5, 2, -4);
      scene.add(fill);

      controls = new TrackballControls(camera, canvas);
      controls.target.set(0, 0, 0);
      controls.noPan = true;
      controls.rotateSpeed = 2.4;
      controls.zoomSpeed = 1.2;
      controls.staticMoving = false;
      controls.dynamicDampingFactor = 0.12;
      controls.handleResize();

      /**
       * Startansicht zurück: nur per nativen `click` (nicht pointerup + manuelle Distanz).
       * Mit Pointer Capture auf dem Canvas sind pointermove/up für unsere Drag-Erkennung unzuverlässig;
       * der Browser unterdrückt `click` dagegen, wenn zwischen down/up deutlich bewegt wurde — dann kein Reset nach dem Drehen.
       */
      const onCanvasClick = (e) => {
        if (disposed) return;
        if (e.button != null && e.button !== 0) return;
        controls.reset();
      };
      canvas.addEventListener("click", onCanvasClick);
      disposeList.push(() =>
        canvas.removeEventListener("click", onCanvasClick)
      );

      try {
        if (isStl) {
          const { geo, scale } = await loadCenteredStlGeometry(modelUrl);
          if (disposed) return;
          const mesh = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
              color: 0x2a2a2a,
              metalness: 0.35,
              roughness: 0.4,
            })
          );
          mesh.scale.setScalar(scale);
          scene.add(mesh);
        } else if (isGltf) {
          const gltf = await new Promise((resolve, reject) => {
            new GLTFLoader().load(modelUrl, resolve, undefined, reject);
          });
          if (disposed) return;
          const root = gltf.scene;
          centerAndScaleObject(root);
          scene.add(root);
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = false;
              child.receiveShadow = false;
            }
          });
        } else if (isObj) {
          const obj = await new Promise((resolve, reject) => {
            new OBJLoader().load(modelUrl, resolve, undefined, reject);
          });
          if (disposed) return;
          applyDefaultObjMaterials(obj);
          centerAndScaleObject(obj);
          scene.add(obj);
        } else {
          throw new Error("Unsupported 3D format");
        }
      } catch {
        if (disposed) return;
        const err = document.createElement("div");
        err.className =
          "pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-4 text-center text-sm text-white";
        err.textContent = "Modell konnte nicht geladen werden.";
        wrapRef.current?.appendChild(err);
        disposeList.push(() => err.remove());
        return;
      }

      if (disposed) return;

      ro = new ResizeObserver(() => {
        if (!renderer || !camera || !host) return;
        const rw = host.offsetWidth;
        const rh = host.offsetHeight;
        if (rw < 1 || rh < 1) return;
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
        renderer.setSize(rw, rh);
        controls?.handleResize();
      });
      ro.observe(host);

      const tick = () => {
        if (disposed) return;
        controls?.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      disposeList.forEach((fn) => fn());
      controls?.dispose();
      if (renderer) {
        renderer.dispose();
        const el = renderer.domElement;
        if (el?.parentNode) el.parentNode.removeChild(el);
      }
      scene?.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mat) => mat.dispose?.());
          else m?.dispose?.();
        }
      });
    };
  }, [modelUrl, fileName, background]);

  const hasBg = Boolean(background);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${
        unifiedParentScroll
          ? "h-[50vh] min-h-[50vh] flex-none"
          : "h-full min-h-0 flex-1"
      } ${hasBg ? "bg-black" : "bg-transparent"}`}
    >
      {background?.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.url}
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover"
          onLoad={onBgImgLoad}
        />
      )}
      {background?.kind === "video" && (
        <video
          src={background.url}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          onLoadedMetadata={onBgVideoMeta}
        />
      )}
      <div
        ref={canvasHostRef}
        className="relative z-10 h-full min-h-[400px] w-full min-w-0"
      />
    </div>
  );
}
