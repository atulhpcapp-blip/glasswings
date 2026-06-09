import React, { useEffect, useRef, useState } from "react";

// Reads from Vercel env (must be VITE_-prefixed so the client can see them):
//   VITE_SNAP_CAMERA_KIT_TOKEN  -> API token from the Camera Kit portal
//   VITE_SNAP_LENS_GROUP_ID     -> Lens Group ID published from Lens Studio
// TEMP OVERRIDE for branch testing only — paste your STAGING values here to bypass
// Vercel env vars. Leave "" to use the Vercel env vars. Remove these before production.
const MANUAL_TOKEN = "";
const MANUAL_LENS_GROUP_ID = "";
const TOKEN = MANUAL_TOKEN || (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SNAP_CAMERA_KIT_TOKEN : "");
const LENS_GROUP_ID = MANUAL_LENS_GROUP_ID || (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SNAP_LENS_GROUP_ID : "");
const TEAL = "#008069";

/**
 * Snapchat-style AR camera using Snap Camera Kit Web.
 * Props:
 *   onCapture(dataUrl)  - called with a JPEG data URL when the user taps the shutter
 *   onClose()           - called to dismiss
 *
 * NOTE: This is a first integration scaffold. It cannot be verified without a
 * valid token + lens group, and frame capture / lens-list shape may need a small
 * tweak once we see it on the Vercel preview.
 */
export default function SnapLensCamera({ onCapture, onClose }) {
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errMsg, setErrMsg] = useState("");
  const [lenses, setLenses] = useState([]);
  const [activeLens, setActiveLens] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lensErr, setLensErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!TOKEN || !LENS_GROUP_ID) {
        setStatus("error");
        setErrMsg("AR lenses aren't configured yet (missing Camera Kit token or lens group).");
        return;
      }
      try {
        const { bootstrapCameraKit, createMediaStreamSource, Transform2D } = await import("@snap/camera-kit");
        const cameraKit = await bootstrapCameraKit({ apiToken: TOKEN });
        if (cancelled) return;

        const session = await cameraKit.createSession({ liveRenderTarget: canvasRef.current });
        sessionRef.current = session;
        session.events.addEventListener("error", (e) => console.error("CameraKit error", e?.detail?.error));

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        streamRef.current = stream;
        const source = createMediaStreamSource(stream, { transform: Transform2D.MirrorX, cameraType: "user" });
        await session.setSource(source);
        await session.play();

        // Load all lenses in the configured group.
        let list = [];
        try {
          const res = await cameraKit.lensRepository.loadLensGroups([LENS_GROUP_ID]);
          list = (res && Array.isArray(res.lenses)) ? res.lenses : [];
          if (!list.length && res && Array.isArray(res.errors) && res.errors.length) {
            const msg = res.errors.map((er) => (er && (er.message || er.name)) || String(er)).join(" | ");
            console.error("lens group errors", res.errors);
            if (!cancelled) setLensErr(msg);
          }
        } catch (e) {
          console.error("lens group load failed", e);
          if (!cancelled) setLensErr(e?.message || String(e));
        }
        if (cancelled) return;
        setLenses(list);
        if (list[0]) {
          await session.applyLens(list[0]);
          setActiveLens(list[0].id);
        }
        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setStatus("error");
          setErrMsg(e?.message || "Couldn't start the AR camera.");
        }
      }
    })();

    return () => {
      cancelled = true;
      try { sessionRef.current?.pause?.(); } catch {}
      try { sessionRef.current?.destroy?.(); } catch {}
      try { (streamRef.current?.getTracks() || []).forEach((t) => t.stop()); } catch {}
    };
  }, []);

  const pickLens = async (lens) => {
    if (!sessionRef.current) return;
    try {
      await sessionRef.current.applyLens(lens);
      setActiveLens(lens.id);
    } catch (e) { console.error("applyLens", e); }
  };

  const clearLens = async () => {
    try { await sessionRef.current?.removeLens?.(); setActiveLens(null); } catch (e) { console.error(e); }
  };

  const capture = async () => {
    const cv = canvasRef.current;
    if (!cv) return;
    setBusy(true);
    try {
      // Camera Kit renders to this canvas; grab a still as a data URL.
      const dataUrl = cv.toDataURL("image/jpeg", 0.92);
      onCapture && onCapture(dataUrl);
    } catch (e) {
      console.error("capture failed", e);
      alert("Couldn't capture the photo. (We'll refine capture once it's live on the preview.)");
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px calc(8px)", color: "#fff", zIndex: 3 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 800, cursor: "pointer" }}>✕</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>AR Lenses</div>
        {activeLens && <button onClick={clearLens} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>No lens</button>}
      </div>

      {/* render surface */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: status === "ready" ? "block" : "none" }} />
        {status === "loading" && (
          <div style={{ color: "#fff", textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>✨</div>
            <div style={{ fontWeight: 700 }}>Starting AR camera…</div>
            <div style={{ fontSize: 12.5, opacity: .7, marginTop: 6 }}>Loading Snap lens engine</div>
          </div>
        )}
        {status === "error" && (
          <div style={{ color: "#fff", textAlign: "center", padding: 24, maxWidth: 320 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>📷</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>AR camera unavailable</div>
            <div style={{ fontSize: 12.5, opacity: .8 }}>{errMsg}</div>
            <button onClick={onClose} style={{ marginTop: 16, background: TEAL, border: "none", color: "#fff", borderRadius: 12, padding: "11px 20px", fontWeight: 800, cursor: "pointer" }}>Close</button>
          </div>
        )}
      </div>

      {/* lens strip + shutter */}
      {status === "ready" && (
        <div style={{ padding: "10px 0 calc(18px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 14px 12px", WebkitOverflowScrolling: "touch" }}>
            {lenses.map((lens) => (
              <div key={lens.id} onClick={() => pickLens(lens)} style={{ flexShrink: 0, width: 60, textAlign: "center", cursor: "pointer" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", border: `3px solid ${activeLens === lens.id ? "#fff" : "rgba(255,255,255,.35)"}`, background: "#222", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {lens.iconUrl ? <img src={lens.iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>✨</span>}
                </div>
                <div style={{ color: "#fff", fontSize: 10, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lens.name || "Lens"}</div>
              </div>
            ))}
            {!lenses.length && <div style={{ color: "#fff", opacity: .8, fontSize: 12, padding: "14px", maxWidth: 320, lineHeight: 1.5 }}>{lensErr ? ("Lens group error: " + lensErr) : "No lenses found in this group. Check the Lens Group ID matches your token's environment (staging vs production)."}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={capture} disabled={busy} aria-label="Capture" style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,.4)", cursor: "pointer", opacity: busy ? .6 : 1 }} />
          </div>
        </div>
      )}
    </div>
  );
}
