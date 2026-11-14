import { BrowserProvider, JsonRpcProvider, Contract, isAddress, ZeroAddress } from 'ethers';
import abi from './abi.json';
import { makePayload, payloadHash, refId, ZERO_HASH, today, validatePayload, issuedTimestamp } from './certificate.js';
import { DEMO_ACCOUNTS, requestWalletAccounts, selectWalletAccount, demoRoles } from './wallet.js';
export { DEMO_ACCOUNTS };
const STORAGE='skilltrust-demo-v1';
const BUNDLES='skilltrust-private-bundles-v1';
export const DEMO_WALLET='0x1111111111111111111111111111111111111111';
export let config;
export let account='';
let connecting = false;
const readBundles=()=>JSON.parse(localStorage.getItem(BUNDLES)||'{}');
export const getBundle=id=>readBundles()[id] || null;
export function saveBundle(bundle) { validatePayload(bundle.payload); const all=readBundles(); all[refId(bundle.payload.reference)]=bundle; localStorage.setItem(BUNDLES,JSON.stringify(all)); }
export const context=()=>({chainId:config.mode==='demo'?0:config.chainId,contractAddress:config.mode==='demo'?'demo':config.contractAddress.toLowerCase()});
export function contextMatches(bundle) {const current=context(); return bundle.registry?.chainId===current.chainId && bundle.registry?.contractAddress?.toLowerCase()===current.contractAddress.toLowerCase();}
export async function init() {
  const defaults=await fetch('./config.json').then(r=>{if(!r.ok)throw Error('โหลด config ไม่สำเร็จ');return r.json();});
  try {config={...defaults,...JSON.parse(localStorage.getItem('skilltrust-config')||'{}')};}catch {config=defaults;}
  if (!['demo','sepolia'].includes(config.mode) || Number(config.chainId)!==11155111) throw Error('รองรับโหมด demo และ Sepolia (11155111) เท่านั้น');
  if(config.mode==='demo') seed();
}
export function setConfig(value) {localStorage.setItem('skilltrust-config',JSON.stringify(value));}
export const isDemo=()=>config.mode==='demo';
function seed() {
  if(localStorage.getItem(STORAGE))return;
  const courses=[['AI-101','AI & Machine Learning Essentials','พื้นฐาน AI และการประยุกต์ใช้ Machine Learning'],['SEC-201','Cybersecurity Fundamentals','ความปลอดภัยไซเบอร์และการป้องกันภัยคุกคาม'],['CLD-301','Cloud Computing with AWS','ออกแบบและจัดการระบบคลาวด์บน AWS'],['DATA-101','Data Analytics & Visualization','วิเคราะห์และนำเสนอข้อมูลเพื่อการตัดสินใจ']].map(([code,title,description])=>({id:refId(code),code,title,description,active:true,exists:true}));
  const certificates=[];
  const names=['พิมพ์ชนก ใจดี','ธนกร วัฒนกุล','ณัฐธิดา ศรีสุข','กิตติพงษ์ แสงทอง','อริสา พูนทรัพย์','วรเมธ สุขใจ'];
  names.forEach((name,i)=>{
    const course=courses[i%courses.length];const date=new Date();date.setUTCDate(date.getUTCDate()-(i+1)*3);
    const payload=makePayload({reference:`ST-${new Date().getUTCFullYear()}-${String(i+1).padStart(4,'0')}`,courseCode:course.code,courseTitle:course.title,recipientName:name,recipientWallet:i<3?DEMO_WALLET:'0x2222222222222222222222222222222222222222',issuedOn:date.toISOString().slice(0,10)});
    const id=refId(payload.reference); const issuedOn=issuedTimestamp(payload.issuedOn);
    certificates.push({id,courseId:course.id,recipient:payload.recipientWallet,issuer:DEMO_WALLET,payloadHash:payloadHash(payload),documentHash:ZERO_HASH,issuedOn,recordedAt:issuedOn+3600,revokedAt:i===4?issuedOn+86400:0,exists:true,reference:payload.reference});
    saveBundle({format:'skilltrust-certificate-v1',registry:{chainId:0,contractAddress:'demo'},payload});
  });
  writeDemo({courses,certificates,issuers:[],admins:[DEMO_WALLET]});
}
const readDemo=()=>JSON.parse(localStorage.getItem(STORAGE));
const writeDemo=value=>localStorage.setItem(STORAGE,JSON.stringify(value));
export async function walletAccounts(requestSelection = false) {
  return requestWalletAccounts(window.ethereum, { requestSelection });
}
export async function connect(selectedAccount) {
  if(isDemo()){
    const selected=DEMO_ACCOUNTS.find(a=>a.address.toLowerCase()===selectedAccount?.toLowerCase());
    if(!selected)throw Error('กรุณาเลือกบัญชีทดลอง');
    account=selected.address;return account;
  }
  account='';
  connecting=true;
  try {account=await selectWalletAccount(window.ethereum,selectedAccount,config.chainId);return account;}
  finally {connecting=false;}
}
export function disconnect(){account='';}
export function onWalletChange(callback) {
  if(!window.ethereum?.on)return;
  const changed=()=>{if(isDemo()||connecting)return;disconnect();callback();};
  window.ethereum.on('accountsChanged',changed);
  window.ethereum.on('chainChanged',changed);
}
async function registry(write=false){
  if(!isAddress(config.contractAddress)||config.contractAddress===ZeroAddress)throw Error('ตั้งค่า Contract Address ของ Sepolia ก่อนใช้งาน');
  if(write){
    if(!account)throw Error('กรุณาเชื่อมต่อ Wallet ก่อน');
    const provider=new BrowserProvider(window.ethereum);const network=await provider.getNetwork();
    if(Number(network.chainId)!==config.chainId)throw Error('กรุณาเปลี่ยนเครือข่ายเป็น Sepolia');
    const signer=await provider.getSigner(account);
    if((await signer.getAddress()).toLowerCase()!==account.toLowerCase())throw Error('บัญชี Wallet เปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่');
    return new Contract(config.contractAddress,abi,signer);
  }
  const provider=new JsonRpcProvider(config.rpcUrl,config.chainId,{staticNetwork:true});
  const networkId=await provider.send('eth_chainId',[]);
  if(Number(networkId)!==config.chainId)throw Error('RPC URL ไม่ใช่เครือข่าย Sepolia');
  if(await provider.getCode(config.contractAddress)==='0x')throw Error('ไม่พบ Smart Contract ที่ Address นี้บน Sepolia');
  return new Contract(config.contractAddress,abi,provider);
}
export async function roles(){
  if(!account)return {owner:false,admin:false,issuer:false};
  if(isDemo())return demoRoles(account,readDemo());
  const c=await registry();const [owner,admin,issuer]=await Promise.all([c.owner(),c.admins(account),c.issuers(account)]);
  return {owner:owner.toLowerCase()===account.toLowerCase(),admin,issuer:admin||issuer};
}
function cleanCert(id,c){return {id,courseId:c.courseId,recipient:c.recipient,issuer:c.issuer,payloadHash:c.payloadHash,documentHash:c.documentHash,issuedOn:Number(c.issuedOn),recordedAt:Number(c.recordedAt),revokedAt:Number(c.revokedAt),exists:c.exists};}
function cleanCourse(id,c){return {id,code:c.code,title:c.title,description:c.description,active:c.active,exists:c.exists};}
export async function snapshot() {
  if(isDemo()){const d=readDemo();return {...d,totalCertificates:d.certificates.length,totalCourses:d.courses.length,revokedCount:d.certificates.filter(c=>c.revokedAt).length};}
  const c=await registry();const [courseCount,certificateCount,revokedCount]=await Promise.all([c.courseCount(),c.certificateCount(),c.revokedCount()]);
  const courseIds=[];for(let offset=0;offset<Number(courseCount);offset+=100)courseIds.push(...await c.getCourseIds(offset,100));
  const ids=await c.getCertificateIds(Math.max(0,Number(certificateCount)-50),50);
  const courses=await Promise.all(courseIds.map(async id=>cleanCourse(id,await c.getCourse(id))));
  const certificates=await Promise.all([...ids].reverse().map(async id=>cleanCert(id,await c.getCertificate(id))));
  return {courses,certificates,totalCourses:Number(courseCount),totalCertificates:Number(certificateCount),revokedCount:Number(revokedCount)};
}
export async function findCertificate(reference){
  const id=/^0x[0-9a-fA-F]{64}$/.test(reference)?reference:refId(reference);
  if(isDemo())return readDemo().certificates.find(c=>c.id===id)||null;
  const c=await registry(); const data=cleanCert(id,await c.getCertificate(id));return data.exists?data:null;
}
export async function myCertificates(){
  if(!account)return [];
  if(isDemo())return readDemo().certificates.filter(c=>c.recipient.toLowerCase()===account.toLowerCase());
  const c=await registry();const count=Number(await c.recipientCertificateCount(account)); const all=[];
  for(let offset=0;offset<count;offset+=100){const ids=await c.getRecipientCertificateIds(account,offset,100);all.push(...await Promise.all(ids.map(async id=>cleanCert(id,await c.getCertificate(id)))));}
  return all;
}
export async function createCourse(values){
  if(!(await roles()).admin)throw Error('เฉพาะผู้ดูแลระบบเท่านั้น');
  if(isDemo()){const d=readDemo();if(d.courses.some(c=>c.code===values.code))throw Error('รหัสหลักสูตรนี้มีแล้ว');d.courses.push({...values,id:refId(values.code),active:true,exists:true});writeDemo(d);return;}
  const c=await registry(true);return (await c.createCourse(values.code,values.title,values.description)).wait();
}
export async function issue(payload){
  validatePayload(payload);
  if(!(await roles()).issuer)throw Error('บัญชีนี้ไม่มีสิทธิ์ออกใบรับรอง');
  if(issuedTimestamp(payload.issuedOn)>Date.now()/1000)throw Error('วันที่ออกใบรับรองต้องไม่อยู่ในอนาคต');
  const id=refId(payload.reference),hash=payloadHash(payload),issuedOn=issuedTimestamp(payload.issuedOn);
  if(isDemo()){
    const d=readDemo();if(d.certificates.some(c=>c.id===id))throw Error('รหัสใบรับรองนี้ถูกใช้แล้ว');
    const course=d.courses.find(c=>c.id===refId(payload.courseCode));if(!course?.active)throw Error('หลักสูตรนี้ไม่เปิดใช้งาน');
    d.certificates.unshift({id,reference:payload.reference,courseId:course.id,recipient:payload.recipientWallet,issuer:account,payloadHash:hash,documentHash:payload.documentHash,issuedOn,recordedAt:Math.floor(Date.now()/1000),revokedAt:0,exists:true});writeDemo(d);
  }else{const c=await registry(true);await (await c.issueCertificate(id,refId(payload.courseCode),payload.recipientWallet,hash,payload.documentHash,issuedOn)).wait();}
  const bundle={format:'skilltrust-certificate-v1',registry:context(),payload};
  // A storage failure must not hide the downloadable bundle after an on-chain transaction succeeds.
  try {saveBundle(bundle);}catch{ /* caller still receives the portable bundle */ }
  return bundle;
}
export async function revoke(id){
  if(!(await roles()).admin)throw Error('เฉพาะผู้ดูแลระบบสามารถเพิกถอนได้');
  if(isDemo()){const d=readDemo();const cert=d.certificates.find(c=>c.id===id);if(!cert)throw Error('ไม่พบใบรับรอง');if(cert.revokedAt)throw Error('ใบรับรองนี้ถูกเพิกถอนแล้ว');cert.revokedAt=Math.floor(Date.now()/1000);writeDemo(d);return;}
  const c=await registry(true);return (await c.revokeCertificate(id)).wait();
}
export async function setRole(address,role,enabled){
  if(!isAddress(address)||address===ZeroAddress)throw Error('Wallet Address ไม่ถูกต้อง');
  if(isDemo()&&role==='admin'&&address.toLowerCase()===DEMO_WALLET.toLowerCase())throw Error('เปลี่ยนสิทธิ์ Admin ของ Owner เริ่มต้นไม่ได้');
  const permissions=await roles();if(role==='admin'?!permissions.owner:!permissions.admin)throw Error('บัญชีนี้ไม่มีสิทธิ์จัดการบทบาท');
  if(isDemo()){const d=readDemo(),key=role==='admin'?'admins':'issuers';d[key]=d[key].filter(a=>a.toLowerCase()!==address.toLowerCase());if(enabled)d[key].push(address);writeDemo(d);return;}
  const c=await registry(true);return (await c[role==='admin'?'setAdmin':'setIssuer'](address,enabled)).wait();
}
export async function setCourseActive(id,active){
  if(!(await roles()).admin)throw Error('เฉพาะผู้ดูแลระบบเท่านั้น');
  if(isDemo()){const d=readDemo();const course=d.courses.find(c=>c.id===id);if(!course)throw Error('ไม่พบหลักสูตร');course.active=active;writeDemo(d);return;}
  const c=await registry(true);return (await c.setCourseActive(id,active)).wait();
}
export function errorMessage(error){
  if(error.code==='ACTION_REJECTED'||error.code===4001)return 'คุณยกเลิกการยืนยันใน Wallet';
  const errors={Unauthorized:'บัญชีนี้ไม่มีสิทธิ์ดำเนินการ',AlreadyExists:'รหัสนี้ถูกใช้แล้วและไม่สามารถใช้ซ้ำได้',NotFound:'ไม่พบข้อมูลที่อ้างอิง',InactiveCourse:'หลักสูตรนี้ปิดใช้งานแล้ว',AlreadyRevoked:'ใบรับรองนี้ถูกเพิกถอนแล้ว',InvalidInput:'ข้อมูลไม่ถูกต้อง',PageTooLarge:'จำนวนรายการมากเกินไป'};
  let errorName=error.revert?.name;
  if(!errorName&&typeof error.data==='string'){try{errorName=new Contract(ZeroAddress,abi).interface.parseError(error.data)?.name;}catch{}}
  return errors[errorName]||error.shortMessage||error.message||'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
