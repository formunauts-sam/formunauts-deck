/* ============================================================
   qr.js — brand QR from the vendored paulmillr/qr encoder.
   CHROME. Shared by the Join panel (engage/join.js) and the
   Hub (hub/hub.js) so both draw an IDENTICAL on-brand code.
   ------------------------------------------------------------
   The vendored library exports encodeQR(text, output, opts).
   We take the RAW module matrix (output "raw", which already
   includes the quiet-zone border) and draw the SVG ourselves,
   so the code is FORMUNAUTS blue on white with full control
   over colour and sizing — no recolouring a black SVG, no
   network, no extra dependency. Returns an SVG STRING.
   ============================================================ */
import { encodeQR } from "../vendor/qr.mjs";

const MODULE_COLOR = "#0074C8"; // brand primary
const QUIET = "#ffffff"; // white surface behind the code

/**
 * qrSvg — encode `text` into an on-brand QR as an SVG string.
 * @param {string} text  the payload (a join URL)
 * @param {{ecc?: 'low'|'medium'|'quartile'|'high', border?: number}} [opts]
 * @returns {string} an <svg> string (viewBox = module grid, scales crisply)
 */
export function qrSvg(text, opts = {}) {
  const ecc = opts.ecc || "medium";
  const border = Number.isInteger(opts.border) ? opts.border : 3;
  const matrix = encodeQR(String(text == null ? "" : text), "raw", { ecc, border });
  const n = matrix.length; // square, includes the quiet zone

  // One path segment per dark module (merged into a single <path> so the DOM
  // stays light even at higher versions). crispEdges keeps modules square.
  let d = "";
  for (let y = 0; y < n; y++) {
    const row = matrix[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }

  return (
    `<svg viewBox="0 0 ${n} ${n}" width="100%" height="100%" ` +
    `xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" ` +
    `role="img" aria-label="Join QR code">` +
    `<rect width="${n}" height="${n}" fill="${QUIET}"/>` +
    `<path d="${d}" fill="${MODULE_COLOR}"/></svg>`
  );
}

export default qrSvg;
