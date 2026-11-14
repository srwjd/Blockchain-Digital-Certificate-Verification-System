import test from 'node:test';
import assert from 'node:assert/strict';
import { makePayload, payloadHash, refId, canonicalize, validatePayload, fileHash, ZERO_HASH, escapeHtml, issuedTimestamp, payloadMatchesRecord } from '../src/certificate.js';
const fixture=()=>makePayload({reference:'st-2026-0001',courseCode:'AI-101',courseTitle:'AI Essentials',recipientName:'ผู้เรียน ตัวอย่าง',recipientWallet:'0x1111111111111111111111111111111111111111',issuedOn:'2026-11-01'});
test('canonical hash is stable across JSON key ordering and export/import',()=>{const payload=fixture();const reversed=Object.fromEntries(Object.entries(payload).reverse());assert.equal(payloadHash(payload),payloadHash(reversed));assert.equal(payloadHash(payload),payloadHash(JSON.parse(JSON.stringify(payload))));assert.equal(canonicalize({b:2,a:1}),'{"a":1,"b":2}');});
test('editing a recipient, course, date, wallet, document hash or nonce changes the hash',()=>{const p=fixture();for(const [key,value] of Object.entries({recipientName:'ปลอมชื่อ',courseTitle:'Other course',issuedOn:'2026-11-02',recipientWallet:'0x2222222222222222222222222222222222222222',documentHash:'0x'+'ab'.repeat(32),nonce:'0x'+'cd'.repeat(32)}))assert.notEqual(payloadHash(p),payloadHash({...p,[key]:value}),key);});
test('nonce prevents identical private payload hashes and reference IDs normalize',()=>{assert.notEqual(payloadHash(fixture()),payloadHash(fixture()));assert.equal(refId(' st-2026-0001 '),refId('ST-2026-0001'));});
test('invalid references, wallet, date, nonce and empty personal data are rejected',()=>{const p=fixture();for(const [key,value] of Object.entries({reference:'<script>',recipientWallet:'invalid',issuedOn:'2026-02-30',nonce:ZERO_HASH.slice(0,-1),recipientName:''}))assert.throws(()=>validatePayload({...p,[key]:value}));});
test('document fingerprint detects changed PDF bytes',async()=>{const original=new Blob(['%PDF-1.4 original']);const edited=new Blob(['%PDF-1.4 modified']);assert.notEqual(await fileHash(original),await fileHash(edited));assert.equal(await fileHash(original),await fileHash(new Blob(['%PDF-1.4 original'])));});
test('untrusted personal names are escaped for HTML',()=>{assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');});

test('issue date resolves to midnight in Bangkok without becoming future before 07:00',()=>{assert.equal(new Date(issuedTimestamp('2026-11-14')*1000).toISOString(),'2026-11-13T17:00:00.000Z');});

test('verified private data must match on-chain ID, course, wallet, file hash and date',()=>{
 const payload=fixture();
 const record={id:refId(payload.reference),courseId:refId(payload.courseCode),recipient:payload.recipientWallet,payloadHash:payloadHash(payload),documentHash:payload.documentHash,issuedOn:issuedTimestamp(payload.issuedOn)};
 assert.equal(payloadMatchesRecord(payload,record),true);
 for(const [key,value] of Object.entries({id:refId('OTHER-ID'),courseId:refId('OTHER-COURSE'),recipient:'0x2222222222222222222222222222222222222222',documentHash:'0x'+'ab'.repeat(32),issuedOn:1}))assert.equal(payloadMatchesRecord(payload,{...record,[key]:value}),false,key);
});
