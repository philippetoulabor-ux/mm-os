"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";

const geometryCache = new Map();

/** Entspricht Tailwind `max-md` / DesktopContext — keine Mausfolge am Logo auf schmalen Viewports */
const MOBILE_MAX_WIDTH_PX = 767;

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

async function loadCenteredGeometry(url) {
  if (geometryCache.has(url)) return geometryCache.get(url);

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

  const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
  const scale = 1.6 / maxDim;

  const result = { geo, scale };
  geometryCache.set(url, result);
  return result;
}

function applyLights(scene, rimColor, rimIntensity) {
  const col = new THREE.Color(rimColor);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const sideL = new THREE.DirectionalLight(col, rimIntensity);
  sideL.position.set(-5, 0, -4);
  scene.add(sideL);

  const sideR = new THREE.DirectionalLight(col, rimIntensity);
  sideR.position.set(5, 0, -4);
  scene.add(sideR);

  const topL = new THREE.DirectionalLight(col, rimIntensity * 1.4);
  topL.position.set(0, 8, 1);
  scene.add(topL);
}

function buildEnvMap(renderer, scene) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(128);
  cubeRT.texture.type = THREE.HalfFloatType;
  const sides = [0xffffff, 0xffffff, 0x444444, 0x222222, 0x050505, 0x050505];
  const envBox = new THREE.Mesh(
    new THREE.BoxGeometry(8, 8, 8),
    sides.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }))
  );

  scene.add(envBox);
  const cubeCamera = new THREE.CubeCamera(0.1, 10, cubeRT);
  scene.add(cubeCamera);
  cubeCamera.update(renderer, scene);
  scene.remove(envBox);
  scene.remove(cubeCamera);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(cubeRT.texture).texture;
  pmrem.dispose();
  cubeRT.dispose();

  scene.environment = env;
}

export default function LogoViewer({
  config = {},
  /** Kein `router.push` am Logo — z. B. wenn die Klickaktion von einem äußeren `<button>` kommt */
  skipRouterClick = false,
  /** `false` = kein `id` (zweites Logo im UI ohne Duplikat von `#logo-container`) */
  domId,
  className,
}) {
  const router = useRouter();
  const containerRef = useRef(null);
  const mobileLayoutRef = useRef(false);

  const opts = useMemo(() => {
    const {
      stlUrl = "",
      href = "/",
      rimColor = "#FFF4E0",
      rimIntensity = 0.28,
      paddingTop = 0,
      paddingBottom = 0,
      followMouse = true,
    } = config ?? {};
    return { stlUrl, href, rimColor, rimIntensity, paddingTop, paddingBottom, followMouse };
  }, [config]);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
    const sync = () => {
      mobileLayoutRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let raf = 0;
    let ro = null;

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      display: "inline-block",
      paddingTop: `${opts.paddingTop}px`,
      paddingBottom: `${opts.paddingBottom}px`,
      lineHeight: "0",
      cursor: "pointer",
      transform: "scale(1)",
      transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      transformOrigin: "center center",
    });

    const onEnter = () => (wrapper.style.transform = "scale(1.06)");
    const onLeave = () => (wrapper.style.transform = "scale(1)");
    const onClick = skipRouterClick ? null : () => router.push(opts.href);
    wrapper.addEventListener("mouseenter", onEnter);
    wrapper.addEventListener("mouseleave", onLeave);
    if (onClick) wrapper.addEventListener("click", onClick);
    container.appendChild(wrapper);

    let renderer = null;
    let scene = null;
    let camera = null;
    let mesh = null;
    let edgeMesh = null;
    let onMove = null;

    const waitForSize = () =>
      new Promise((resolve) => {
        const check = () => {
          if (disposed) return;
          if (container.offsetWidth > 0) resolve();
          else raf = requestAnimationFrame(check);
        };
        check();
      });

    (async () => {
      await waitForSize();
      if (disposed) return;
      if (!opts.stlUrl) return;

      const size = container.offsetWidth;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);

      const canvas = renderer.domElement;
      Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });
      wrapper.appendChild(canvas);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
      camera.position.set(0, 0, 3.5);

      applyLights(scene, opts.rimColor, opts.rimIntensity);
      buildEnvMap(renderer, scene);

      ro = new ResizeObserver(() => {
        if (!renderer) return;
        const w = container.offsetWidth;
        if (!w) return;
        renderer.setSize(w, w);
      });
      ro.observe(container);

      let mouseX = 0;
      let mouseY = 0;
      if (opts.followMouse) {
        onMove = (e) => {
          if (mobileLayoutRef.current) return;
          mouseX = (e.clientX / window.innerWidth) * 2 - 1;
          mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
        };
        window.addEventListener("mousemove", onMove);
      }

      let loaded;
      try {
        loaded = await loadCenteredGeometry(opts.stlUrl);
      } catch {
        return;
      }
      if (disposed) return;

      mesh = new THREE.Mesh(
        loaded.geo,
        new THREE.MeshPhysicalMaterial({
          color: 0x000000,
          roughness: 0.35,
          metalness: 0.8,
          reflectivity: 0.7,
          clearcoat: 0.4,
          clearcoatRoughness: 0.25,
        })
      );
      mesh.scale.setScalar(loaded.scale);
      scene.add(mesh);

      edgeMesh = new THREE.Mesh(
        loaded.geo.clone(),
        new THREE.MeshPhysicalMaterial({
          color: 0x888888,
          roughness: 0.3,
          transparent: true,
          opacity: 0.18,
          side: THREE.BackSide,
        })
      );
      edgeMesh.scale.setScalar(loaded.scale * 1.018);
      scene.add(edgeMesh);

      let curRotY = 0;
      let curRotX = 0;
      const tick = () => {
        if (disposed) return;
        if (opts.followMouse) {
          if (!mobileLayoutRef.current) {
            curRotY += (mouseX * 0.6 - curRotY) * 0.06;
            curRotX += (-mouseY * 0.3 - curRotX) * 0.06;
          } else {
            curRotY += (0 - curRotY) * 0.12;
            curRotX += (0 - curRotX) * 0.12;
          }
          mesh.rotation.y = curRotY;
          mesh.rotation.x = curRotX;
          edgeMesh.rotation.y = curRotY;
          edgeMesh.rotation.x = curRotX;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (onMove) window.removeEventListener("mousemove", onMove);
      wrapper.removeEventListener("mouseenter", onEnter);
      wrapper.removeEventListener("mouseleave", onLeave);
      if (onClick) wrapper.removeEventListener("click", onClick);

      if (mesh?.material) mesh.material.dispose();
      if (edgeMesh?.material) edgeMesh.material.dispose();
      if (edgeMesh?.geometry) edgeMesh.geometry.dispose();

      if (renderer) {
        renderer.dispose();
        const el = renderer.domElement;
        if (el?.parentNode) el.parentNode.removeChild(el);
      }

      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };
  }, [opts, router, skipRouterClick]);

  const rootId = domId === false ? undefined : domId ?? "logo-container";
  return <div id={rootId} ref={containerRef} className={className} />;
}
