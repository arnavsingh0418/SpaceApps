import * as THREE from "three";

const EYE = 1.62;

/** First-person walk for the return ship. Drag looks around if pointer lock is declined. */
export function createShipWalk(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  occupied: (x: number, z: number) => boolean,
  onLock: (locked: boolean) => void,
) {
  let yaw = 0;
  let pitch = 0;
  let active = false;
  let dragging = false;
  const keys = new Set<string>();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");

  const applyLook = () => {
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!active) return;
    const locked = document.pointerLockElement === canvas;
    if (!locked && !dragging) return;
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.0022;
    applyLook();
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!active || event.button !== 0) return;
    dragging = true;
    canvas.setPointerCapture?.(event.pointerId);
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  };
  const onPointerUp = () => {
    dragging = false;
  };
  const onLockChange = () => {
    if (!active) return;
    onLock(document.pointerLockElement === canvas);
  };
  const onKey = (event: KeyboardEvent, down: boolean) => {
    if (!active) return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      if (down) keys.add(event.code);
      else keys.delete(event.code);
      event.preventDefault();
    }
  };
  const onBlur = () => keys.clear();

  window.addEventListener("keydown", (event) => onKey(event, true));
  window.addEventListener("keyup", (event) => onKey(event, false));
  window.addEventListener("blur", onBlur);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onLockChange);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  return {
    setActive(next: boolean) {
      active = next;
      if (!next) {
        keys.clear();
        dragging = false;
      }
    },
    look(nextYaw: number, nextPitch: number) {
      yaw = nextYaw;
      pitch = nextPitch;
      applyLook();
    },
    unlock() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    update(dt: number) {
      if (!active) return;
      camera.position.y = EYE;
      let forward = 0;
      let strafe = 0;
      if (keys.has("KeyW")) forward += 1;
      if (keys.has("KeyS")) forward -= 1;
      if (keys.has("KeyD")) strafe += 1;
      if (keys.has("KeyA")) strafe -= 1;
      if (forward === 0 && strafe === 0) return;
      const length = Math.hypot(forward, strafe);
      forward /= length;
      strafe /= length;
      const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.6 : 3.15;
      const step = speed * dt;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const mx = (fx * forward + rx * strafe) * step;
      const mz = (fz * forward + rz * strafe) * step;
      const x = camera.position.x;
      const z = camera.position.z;
      if (!occupied(x + mx, z)) camera.position.x += mx;
      if (!occupied(camera.position.x, z + mz)) camera.position.z += mz;
    },
  };
}
