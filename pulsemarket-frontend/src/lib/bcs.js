import { AccAddress } from "@initia/initia.js";

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function uleb128(value) {
  const out = [];
  let n = value >>> 0;
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
  out.push(n);
  return Uint8Array.from(out);
}

export function bcsU64(value) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const n = BigInt(value);
  view.setBigUint64(0, n, true);
  return toBase64(new Uint8Array(buf));
}

export function bcsBool(value) {
  return toBase64(Uint8Array.from([value ? 1 : 0]));
}

export function bcsString(value) {
  const utf8 = new TextEncoder().encode(value);
  const len = uleb128(utf8.length);
  const out = new Uint8Array(len.length + utf8.length);
  out.set(len, 0);
  out.set(utf8, len.length);
  return toBase64(out);
}

export function bcsAddress(address) {
  const hex = AccAddress.toHex(address).replace("0x", "").padStart(64, "0");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return toBase64(out);
}
