import { sha256, toUtf8Bytes, keccak256, isAddress, randomBytes, hexlify, ZeroHash } from 'ethers';
export const ZERO_HASH = ZeroHash;
export const normalizeRef = value => String(value).trim().toUpperCase();
export const validRef = value => /^[A-Z0-9][A-Z0-9-]{2,63}$/.test(value);
export const refId = value => keccak256(toUtf8Bytes(normalizeRef(value)));
export function canonicalize(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const payloadHash = payload => sha256(toUtf8Bytes(canonicalize(payload)));
export const fileHash = async file => sha256(new Uint8Array(await file.arrayBuffer()));
export function makePayload(values) {
  const payload = {version:1, reference:normalizeRef(values.reference), courseCode:normalizeRef(values.courseCode), courseTitle:values.courseTitle.trim(), recipientName:values.recipientName.trim(), recipientWallet:values.recipientWallet.toLowerCase(), issuedOn:values.issuedOn, organization:'SkillTrust Academy', documentHash:values.documentHash || ZERO_HASH, nonce:hexlify(randomBytes(32))};
  validatePayload(payload);
  return payload;
}
export function validatePayload(p) {
  if (!p || p.version !== 1 || !validRef(p.reference) || p.reference !== normalizeRef(p.reference) || !isAddress(p.recipientWallet)) throw new Error('รูปแบบข้อมูลใบรับรองไม่ถูกต้อง');
  for (const field of ['courseCode','courseTitle','recipientName','organization']) if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > 300) throw new Error('ข้อมูลใบรับรองไม่ครบถ้วน');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.issuedOn) || !Number.isFinite(Date.parse(p.issuedOn)) || new Date(p.issuedOn).toISOString().slice(0,10) !== p.issuedOn) throw new Error('วันที่ในใบรับรองไม่ถูกต้อง');
  if (!/^0x[0-9a-fA-F]{64}$/.test(p.documentHash) || !/^0x[0-9a-fA-F]{64}$/.test(p.nonce)) throw new Error('Hash หรือ nonce ไม่ถูกต้อง');
  return p;
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function downloadJson(bundle) {
  const blob = new Blob([JSON.stringify(bundle,null,2)], {type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=bundle.payload.reference+'.skilltrust.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'});

export const issuedTimestamp = value => Date.parse(value+'T00:00:00+07:00')/1000;
