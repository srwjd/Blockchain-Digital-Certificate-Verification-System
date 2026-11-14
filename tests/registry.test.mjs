import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, ZeroAddress, ZeroHash, keccak256, toUtf8Bytes } from 'ethers';
import '../scripts/compile.mjs';
const artifact=JSON.parse(fs.readFileSync('artifacts/SkillTrustRegistry.json'));
const id=value=>keccak256(toUtf8Bytes(value));
const courseId=id('AI-101');
async function setup(){
 const transport=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'},wallet:{totalAccounts:4}});
 const provider=new BrowserProvider(transport);provider.pollingInterval=10;
 const [owner,issuer,student,stranger]=await Promise.all([0,1,2,3].map(i=>provider.getSigner(i)));
 const c=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,owner).deploy();await c.waitForDeployment();
 await (await c.createCourse('AI-101','AI Essentials','Public course description')).wait();
 const timestamp=Number((await provider.getBlock('latest')).timestamp)-100;
 const args=ref=>[id(ref),courseId,student.address,id('private payload '+ref),ZeroHash,timestamp];
 return {transport,provider,c,owner,issuer,student,stranger,args};
}
async function rejectsCustom(promise,contract,name){await assert.rejects(promise,error=>{let parsed;try{parsed=contract.interface.parseError(error.data);}catch{}return parsed?.name===name||error.revert?.name===name;});}
test('Registry business rules and authorization',async t=>{
 const f=await setup();const {transport,c,owner,issuer,student,stranger,args}=f;
 try{
  await t.test('deployer is immutable owner and initial administrator',async()=>{assert.equal(await c.owner(),owner.address);assert.equal(await c.admins(owner.address),true);await rejectsCustom(c.setAdmin.staticCall(owner.address,false),c,'InvalidInput');});
  await t.test('unauthorized accounts cannot create courses, issue, revoke or grant roles',async()=>{const attacker=c.connect(stranger);await rejectsCustom(attacker.createCourse.staticCall('SEC-201','Security',''),c,'Unauthorized');await rejectsCustom(attacker.issueCertificate.staticCall(...args('ST-TEST-001')),c,'Unauthorized');await rejectsCustom(attacker.revokeCertificate.staticCall(id('ST-TEST-001')),c,'Unauthorized');await rejectsCustom(attacker.setIssuer.staticCall(stranger.address,true),c,'Unauthorized');await rejectsCustom(attacker.setAdmin.staticCall(stranger.address,true),c,'Unauthorized');});
  await t.test('course codes are unique and normalized at contract boundary',async()=>{await rejectsCustom(c.createCourse.staticCall('AI-101','Other',''),c,'AlreadyExists');await rejectsCustom(c.createCourse.staticCall('ai-101','Other',''),c,'InvalidInput');assert.equal(await c.courseCount(),1n);});
  await t.test('authorized issuer records hashes, date and recipient wallet',async()=>{await (await c.setIssuer(issuer.address,true)).wait();await (await c.connect(issuer).issueCertificate(...args('ST-TEST-001'))).wait();const record=await c.getCertificate(id('ST-TEST-001'));assert.equal(record.recipient,student.address);assert.equal(record.issuer,issuer.address);assert.equal(record.payloadHash,args('ST-TEST-001')[3]);assert.equal(record.issuedOn,BigInt(args('ST-TEST-001')[5]));assert.equal(record.revokedAt,0n);assert.equal(await c.certificateCount(),1n);});
  await t.test('issuer cannot revoke or escalate privileges',async()=>{const writer=c.connect(issuer);await rejectsCustom(writer.revokeCertificate.staticCall(id('ST-TEST-001')),c,'Unauthorized');await rejectsCustom(writer.setAdmin.staticCall(issuer.address,true),c,'Unauthorized');await rejectsCustom(writer.setIssuer.staticCall(stranger.address,true),c,'Unauthorized');});
  await t.test('duplicate certificate IDs are rejected and original record preserved',async()=>{await rejectsCustom(c.issueCertificate.staticCall(...args('ST-TEST-001')),c,'AlreadyExists');assert.equal((await c.getCertificate(id('ST-TEST-001'))).issuer,issuer.address);});
  await t.test('paused courses block issuance while existing records stay readable',async()=>{await (await c.setCourseActive(courseId,false)).wait();await rejectsCustom(c.issueCertificate.staticCall(...args('ST-TEST-002')),c,'InactiveCourse');assert.equal((await c.getCertificate(id('ST-TEST-001'))).exists,true);await (await c.setCourseActive(courseId,true)).wait();});
  await t.test('invalid wallet, empty hashes, missing courses and future dates are rejected',async()=>{const a=args('ST-TEST-002');const invalid=[{index:2,value:ZeroAddress},{index:3,value:ZeroHash},{index:0,value:ZeroHash},{index:5,value:0},{index:5,value:9999999999}];for(const {index,value} of invalid){const b=[...a];b[index]=value;await rejectsCustom(c.issueCertificate.staticCall(...b),c,'InvalidInput');}const b=[...a];b[1]=id('MISSING');await rejectsCustom(c.issueCertificate.staticCall(...b),c,'NotFound');});
  await t.test('administrator revokes without deleting history or enabling ID reuse',async()=>{await (await c.setAdmin(stranger.address,true)).wait();await (await c.connect(stranger).revokeCertificate(id('ST-TEST-001'))).wait();const cert=await c.getCertificate(id('ST-TEST-001'));assert.ok(cert.revokedAt>0n);assert.equal(cert.payloadHash,args('ST-TEST-001')[3]);assert.equal(await c.revokedCount(),1n);assert.equal(await c.certificateCount(),1n);await rejectsCustom(c.issueCertificate.staticCall(...args('ST-TEST-001')),c,'AlreadyExists');await rejectsCustom(c.revokeCertificate.staticCall(id('ST-TEST-001')),c,'AlreadyRevoked');});
  await t.test('wallet history and bounded pagination include revoked records',async()=>{await (await c.issueCertificate(...args('ST-TEST-002'))).wait();assert.equal(await c.recipientCertificateCount(student.address),2n);assert.deepEqual([...(await c.getRecipientCertificateIds(student.address,0,1))],[id('ST-TEST-001')]);assert.deepEqual([...(await c.getRecipientCertificateIds(student.address,1,1))],[id('ST-TEST-002')]);assert.equal((await c.getRecipientCertificateIds(owner.address,0,100)).length,0);assert.equal((await c.getCertificateIds(999,100)).length,0);await rejectsCustom(c.getCertificateIds(0,101),c,'PageTooLarge');});
  await t.test('removing an issuer immediately blocks further issuance',async()=>{await (await c.setIssuer(issuer.address,false)).wait();await rejectsCustom(c.connect(issuer).issueCertificate.staticCall(...args('ST-TEST-003')),c,'Unauthorized');});
  await t.test('registry ABI has no recipient name or private document fields',()=>{const fields=artifact.abi.find(a=>a.name==='getCertificate').outputs[0].components.map(x=>x.name);assert.ok(!fields.includes('recipientName'));assert.ok(fields.includes('payloadHash'));assert.ok(fields.includes('documentHash'));assert.equal((artifact.evm.bytecode.object.length/2)<24576,true);});
 }finally{await transport.disconnect();}
});
