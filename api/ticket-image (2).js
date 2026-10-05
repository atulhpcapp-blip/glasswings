// GET /api/ticket-image?code=GW123
// Draws a colourful Glasswings ticket card (PNG) for WhatsApp messages.
// Same design as the in-app ticket. Needs the "@vercel/og" package (see package.json step).
import { ImageResponse } from "@vercel/og";
import { rpc } from "./razorpay/_booking-lib.js";

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });
const div = (style, children) => h("div", { display: "flex", ...style }, Array.isArray(children) ? children.filter(Boolean) : children);
const txt = s => String(s == null ? "" : s).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();
const cut = (s, n) => { s = txt(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

async function qrDataUri(code) {
  const r = await fetch("https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&format=png&color=0C1A16&bgcolor=FFFFFF&data=" + encodeURIComponent(code));
  if (!r.ok) throw new Error("qr");
  return "data:image/png;base64," + Buffer.from(await r.arrayBuffer()).toString("base64");
}

async function imageDataUri(url) {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(tm);
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !/^image\/(png|jpe?g|webp|gif)/.test(type)) return null;
    return `data:${type.split(";")[0]};base64,` + Buffer.from(await r.arrayBuffer()).toString("base64");
  } catch { return null; }
}

export function ticketCard(t, qr, sponsorLogo) {
  const place = [t.venue, t.city].filter(Boolean).join(", ");
  const chip = (label, bg, fg) => div({ background: bg, color: fg, fontSize: 20, padding: "6px 16px", borderRadius: 999, marginRight: 10 }, label);
  return div({ width: "100%", height: "100%", background: "#0C1A16", position: "relative", fontFamily: "sans-serif", overflow: "hidden" }, [
    // colour glows
    div({ position: "absolute", top: -160, right: 120, width: 420, height: 420, borderRadius: 420, background: "radial-gradient(circle, rgba(216,27,122,.55), rgba(216,27,122,0) 70%)" }, ""),
    div({ position: "absolute", bottom: -200, left: -80, width: 520, height: 520, borderRadius: 520, background: "radial-gradient(circle, rgba(47,212,168,.40), rgba(47,212,168,0) 70%)" }, ""),
    // left accent bar
    div({ position: "absolute", left: 0, top: 0, width: 14, height: "100%", background: "linear-gradient(180deg,#2FD4A8,#53BDEB 50%,#D81B7A)" }, ""),
    // left side: details
    div({ flexDirection: "column", padding: "44px 0 40px 56px", width: 640, height: "100%" }, [
      div({ fontSize: 22, letterSpacing: 8, color: "#2FD4A8" }, "GLASSWINGS EVENTS"),
      div({ fontSize: 54, color: "#FFFFFF", marginTop: 18, lineHeight: 1.08, maxHeight: 128, overflow: "hidden" }, cut(t.title || "Event", 46)),
      div({ fontSize: 26, color: "rgba(255,255,255,.9)", marginTop: 16 }, cut(t.event_date || "", 40)),
      div({ fontSize: 24, color: "rgba(255,255,255,.75)", marginTop: 6 }, cut(place, 44)),
      div({ marginTop: 22 }, [
        t.category ? chip(cut(t.category, 18), "rgba(83,189,235,.22)", "#9EDCF7") : null,
        t.entry_badge ? chip(cut(t.entry_badge, 14), "rgba(216,27,122,.28)", "#FF9CCB") : null,
      ].filter(Boolean)),
      div({ flexGrow: 1 }, ""),
      div({ fontSize: 18, color: "rgba(255,255,255,.55)", letterSpacing: 3 }, "ADMIT"),
      div({ fontSize: 32, color: "#FFFFFF", marginTop: 4 }, cut(t.name || "Member", 28)),
      div({ fontSize: 24, color: "#2FD4A8", marginTop: 6 }, cut(t.ticket_type || `Entry x ${t.qty || 1}`, 42)),
    ]),
    // perforation
    div({ position: "absolute", left: 676, top: 30, height: 500, borderLeft: "3px dashed rgba(255,255,255,.22)" }, ""),
    div({ position: "absolute", left: 660, top: -18, width: 36, height: 36, borderRadius: 36, background: "#F0F2F5" }, ""),
    div({ position: "absolute", left: 660, bottom: -18, width: 36, height: 36, borderRadius: 36, background: "#F0F2F5" }, ""),
    // "Presented by" title sponsor strip (bottom right)
    t.sponsor_name ? div({ position: "absolute", right: 34, bottom: 26, width: 268, background: "#FFFFFF", borderRadius: 16, padding: "10px 12px", alignItems: "center", overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,.35)" }, [
      div({ flexDirection: "column", flexGrow: 1, minWidth: 0 }, [
        div({ fontSize: 13, letterSpacing: 3, color: "#B8860B" }, "PRESENTED BY"),
        div({ fontSize: 19, color: "#0C1A16", marginTop: 2 }, cut(t.sponsor_name, sponsorLogo ? 15 : 22)),
      ]),
      sponsorLogo ? h("img", { objectFit: "contain", marginLeft: 8, flexShrink: 0 }, null, { src: sponsorLogo, width: 72, height: 42 }) : null,
    ].filter(Boolean)) : null,
    // right side: QR + code
    div({ position: "absolute", right: 40, top: t.sponsor_name ? 34 : 70, width: 270, flexDirection: "column", alignItems: "center" }, [
      div({ background: "#FFFFFF", padding: 16, borderRadius: 22 }, [h("img", {}, null, { src: qr, width: 238, height: 238 })]),
      div({ marginTop: 22, background: "linear-gradient(90deg,#2FD4A8,#53BDEB)", color: "#08130F", fontSize: 30, padding: "8px 22px", borderRadius: 12, letterSpacing: 2 }, cut(t.code, 16)),
      t.sponsor_name ? null : div({ marginTop: 14, fontSize: 18, color: "rgba(255,255,255,.7)" }, "Show at the entry gate"),
    ]),
  ]);
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const code = String(url.searchParams.get("code") || "").trim().slice(0, 40);
    if (!code) return res.status(400).send("missing code");
    const t = await rpc("gw_member_ticket_public", { p_code: code });
    if (!t) return res.status(404).send("ticket not found");
    const qr = await qrDataUri(t.code || code);
    const logo = t.sponsor_logo ? await imageDataUri(t.sponsor_logo) : null;
    const img = new ImageResponse(ticketCard(t, qr, logo), { width: 1000, height: 560 });
    const buf = Buffer.from(await img.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).send("could not draw ticket");
  }
}
