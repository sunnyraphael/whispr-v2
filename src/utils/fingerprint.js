export function getDeviceFingerprint() {
  const nav = window.navigator;
  const screen = window.screen;

  // Canvas fingerprint — unique per GPU/driver/OS combination
  let canvasFp = "";
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("Whispr🔒", 2, 2);
    canvasFp = canvas.toDataURL().slice(-50);
  } catch (_) {}

  // WebGL renderer — very unique per graphics card
  let webglFp = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) webglFp = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    }
  } catch (_) {}

  const raw = [
    nav.userAgent,
    nav.language,
    nav.languages?.join(",") || "",
    nav.platform,
    screen.width, screen.height, screen.colorDepth,
    screen.availWidth, screen.availHeight,
    new Date().getTimezoneOffset(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    nav.hardwareConcurrency || "",
    nav.deviceMemory || "",
    nav.maxTouchPoints || "",
    !!nav.cookieEnabled,
    !!window.indexedDB,
    !!window.localStorage,
    canvasFp,
    webglFp,
  ].join("|");

  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash |= 0;
  }
  return "fp_" + Math.abs(hash).toString(36);
}
