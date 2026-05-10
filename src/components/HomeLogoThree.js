"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Compact Three.js logo: textured plane with subtle idle motion.
 * Uses `/owedue-logo-3.svg` by default; swap that file for your third brand mark.
 *
 * @param {{ logoSrc?: string; fallbackSrc?: string; className?: string; size?: number }} props — `size` is frame width/height in px
 */
export default function HomeLogoThree({
  logoSrc = "/owedue-logo-3.svg",
  fallbackSrc = "/owedue-logo.svg",
  className = "",
  size = 128,
}) {
  const wrapRef = useRef(null);
  const [activeSrc, setActiveSrc] = useState(logoSrc);

  useEffect(() => {
    const container = wrapRef.current;
    if (!container) return undefined;

    let raf = 0;
    let disposed = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0.02, 3.55);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(3.5, 4.5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xfff4e6, 0.45);
    fillLight.position.set(-4, 1, 4);
    scene.add(fillLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    let mesh = null;
    let tex = null;

    function loadTexture(url, onFail) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          tex = texture;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;

          const img = texture.image;
          const aspect = img && img.width && img.height ? img.width / img.height : 1;
          const planeH = 1.55;
          const planeW = planeH * aspect;
          const geo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
          const mat = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            roughness: 0.42,
            metalness: 0.12,
            side: THREE.DoubleSide,
            depthWrite: true,
          });
          if (mesh) {
            group.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
          }
          mesh = new THREE.Mesh(geo, mat);
          group.add(mesh);
        },
        undefined,
        () => {
          if (typeof onFail === "function") onFail();
        }
      );
    }

    loadTexture(activeSrc, () => {
      if (!disposed && activeSrc !== fallbackSrc) {
        setActiveSrc(fallbackSrc);
      }
    });

    const clock = new THREE.Clock();

    function resize() {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight || size);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container);

    function animate() {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      group.rotation.y = Math.sin(t * 0.5) * 0.22;
      group.rotation.x = Math.sin(t * 0.35) * 0.06;
      group.position.y = Math.sin(t * 0.85) * 0.035;
      group.position.x = Math.sin(t * 0.28) * 0.02;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      if (tex) tex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [activeSrc, fallbackSrc, size]);

  return (
    <div
      ref={wrapRef}
      className={`relative shrink-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-[radial-gradient(ellipse_at_50%_32%,rgba(245,158,11,0.1),transparent_58%),radial-gradient(ellipse_at_72%_78%,rgba(16,185,129,0.08),transparent_52%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-zinc-700/70 ${className}`.trim()}
      style={{ width: size, height: size, maxWidth: "min(100%, 11rem)" }}
      aria-hidden
    />
  );
}
