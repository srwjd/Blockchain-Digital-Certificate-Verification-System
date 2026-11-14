# SkillTrust Academy — Blockchain Digital Certificate Verification System
# สมาชิก
# 66012968	สิราวรรณ จันแดง
# 66048395	อารยา โฆษิตไกร
# 66080904	กันต์ณิษา อินตรา
# 66085170	ศิรินทร์ จันทร์ทนต์

ระบบออกและตรวจสอบใบรับรองดิจิทัลตามโจทย์ที่ 3 มีหน้าบ้าน หน้าจัดการระบบ และส่วนหลังบ้านเป็น Ethereum Smart Contract สำหรับ deploy ผ่าน Remix IDE

**เว็บไซต์:** https://srwjd.github.io/Blockchain-Digital-Certificate-Verification-System/

**คู่มือละเอียดสำหรับเริ่มจากศูนย์:** [เปิดคู่มือบนเว็บไซต์](https://srwjd.github.io/Blockchain-Digital-Certificate-Verification-System/manual.html) · [ไฟล์คู่มือใน repository](public/manual.html)

> เว็บไซต์เริ่มต้นใน **Demo mode** ข้อมูลทดลองอยู่ในเบราว์เซอร์ ยังไม่มี Contract บน Sepolia จนกว่าคุณจะ deploy ด้วย Wallet ตามคู่มือ ไม่ต้องส่ง Private Key หรือ Secret Recovery Phrase ให้ใคร

## สิ่งที่ทำได้

| ข้อกำหนด | การใช้งาน |
|---|---|
| สร้างหลักสูตร | ผู้ดูแลกำหนดรหัส ชื่อ รายละเอียด และเปิด/ปิดการออกใบรับรอง |
| ออกใบรับรอง | Admin หรือ Issuer ออกเลขอ้างอิงไม่ซ้ำ ผูก Wallet ผู้รับ และวันที่ออก |
| เก็บ Hash | SHA-256 ของข้อมูลใบรับรอง และ PDF ต้นฉบับถ้าแนบไว้ |
| ตรวจสอบ | รหัสอ้างอิง / QR จากกล้องหรือภาพ / นำเข้า JSON / เทียบ PDF |
| เพิกถอน | Admin เท่านั้น เพิกถอนแล้วใช้รหัสเดิมซ้ำไม่ได้ ประวัติยังอยู่ |
| Dashboard ของผู้รับ | เชื่อม Wallet ดูใบรับรองของตน ดาวน์โหลด JSON พิมพ์/Save as PDF และ QR |

## โครงสร้าง

```text
GitHub Pages (Vite static frontend + Admin UI)
        │ ethers.js / MetaMask
        ▼
Ethereum Sepolia: SkillTrustRegistry.sol
        ├─ หลักสูตรสาธารณะ
        ├─ Certificate ID (keccak256 ของเลขอ้างอิง)
        ├─ SHA-256 ของ payload และ PDF
        ├─ Wallet ผู้รับ / ผู้ออก และวันที่
        └─ ประวัติและเวลาที่เพิกถอน

ข้อมูลชื่อ + nonce + รายละเอียดเอกสาร → JSON ส่วนตัวนอก Blockchain
```

GitHub Pages รัน Node/Express server ไม่ได้ จึงใช้ Smart Contract เป็น backend ของระบบ ส่วนหน้าจัดการเป็น UI สำหรับเรียก contract ไม่มีรหัสผ่าน Admin แบบจำลองในโหมดจริง สิทธิ์บังคับที่ contract ด้วย Wallet

## เริ่มทดลองทันที

1. เปิดเว็บไซต์ ใช้ Demo mode ได้ทันทีโดยไม่ติดตั้ง Wallet
2. ที่หน้าตรวจสอบ กดตัวอย่างเพื่อดูใบรับรองที่มีผลใช้งาน
3. กด **เลือกบัญชีทดลอง** แล้วเลือกผู้ดูแลระบบทดลอง (Owner), ผู้เรียน หรือบัญชีเพิ่มเติม
4. เข้า **จัดการระบบ → หลักสูตร** สร้างหลักสูตร
5. เข้า **ออกใบรับรอง** ใส่รหัสใหม่ ชื่อ และ Wallet จำลอง
6. ออกสำเร็จแล้วกด **ดาวน์โหลด JSON** และ **พิมพ์ / PDF**
7. นำ JSON กลับไปตรวจ เปลี่ยนชื่อในไฟล์แล้วลองตรวจอีกครั้ง จะพบ Hash ไม่ตรง
8. ไปที่ **ทะเบียนใบรับรอง** กดปุ่มเพิกถอน แล้วยืนยัน ตรวจรหัสเดิมอีกครั้งจะขึ้นสถานะเพิกถอน

ข้อมูล Demo และสำเนา JSON เก็บใน Local Storage ของเบราว์เซอร์ ไม่ได้แชร์กับผู้ใช้คนอื่น ชื่อในข้อมูลตั้งต้นเป็นตัวอย่างสำหรับสาธิต

## Deploy Smart Contract ด้วย Remix

ดู [คู่มือเต็ม](https://srwjd.github.io/Blockchain-Digital-Certificate-Verification-System/manual.html) สำหรับรายละเอียดและการแก้ปัญหา

1. ใช้ MetaMask บนเครือข่าย **Sepolia** และเติม Sepolia ETH จาก faucet
2. เปิด https://remix.ethereum.org แล้วสร้าง `SkillTrustRegistry.sol` จาก [ไฟล์นี้](contracts/SkillTrustRegistry.sol)
3. Compiler: **0.8.30** (หรือ 0.8.24 ขึ้นไป), optimizer **enabled / 200 runs**, EVM version **shanghai**
4. Deploy & Run: เลือก **Injected Provider / Browser Extension / MetaMask** ตรวจสอบว่าเป็น Sepolia และ Chain ID **11155111**
5. Value = **0**; constructor ไม่มี argument; กด Deploy แล้วยืนยัน Wallet
6. คัดลอก Address ของ contract หลังธุรกรรมสำเร็จ
7. เว็บไซต์ → **ตั้งค่าการเชื่อมต่อ** → **Ethereum Sepolia** → วาง Address → บันทึก
8. เชื่อม Wallet เดียวกับที่ deploy เพื่อเป็น Contract Owner และสร้างหลักสูตรจริง

### ตั้งค่าให้ผู้เข้าชมทุกคนตรวจบน Sepolia ได้

การตั้งค่าในหน้าเว็บมีผลเฉพาะเบราว์เซอร์นั้น สำหรับการเผยแพร่จริง ให้แก้ `public/config.json` ใน repository:

```json
{
  "mode": "sepolia",
  "chainId": 11155111,
  "contractAddress": "0x_ADDRESS_จริงที่ได้จาก_Remix",
  "rpcUrl": "https://ethereum-sepolia-rpc.publicnode.com"
}
```

ตัวอย่าง Address ข้างบนเป็น placeholder **ห้ามคัดลอกไปใช้งานตามตัวอักษร** ให้แทนด้วย 42 ตัวอักษรของ contract จริง Commit ไปที่ `main` จะ deploy เว็บใหม่อัตโนมัติ จากนั้นเบราว์เซอร์ที่เคยตั้งค่าเองต้องบันทึกการตั้งค่าให้ตรงกันอีกครั้ง (ค่าใน Local Storage มีลำดับเหนือ config กลาง)

## รันบนเครื่อง

ต้องมี Node.js 22 ขึ้นไป

```bash
npm ci
npm run dev
```

ตรวจสอบและ build:

```bash
npm run check
npm test
npm run build
```

`npm run compile` สร้าง ABI ใน `src/abi.json` และ artifact ใน `artifacts/` จาก Solidity จริง

## Deploy GitHub Pages

- ใช้ workflow `.github/workflows/deploy.yml`
- Repository → Settings → Pages → Source: **GitHub Actions**
- Push ไป `main` จะตรวจ syntax, ทดสอบ Smart Contract/Hash, build และ deploy
- Vite ใช้ `base: './'` รองรับ URL แบบ `/ชื่อ-repository/`
- หน้าเว็บใช้ hash routing จึงเปิดลิงก์ตรวจสอบและ QR โดยไม่เกิด Pages 404

## บทบาทและความเป็นส่วนตัว

- Owner: เป็นบัญชีผู้ deploy เปลี่ยน Owner ไม่ได้ จัดการ Admin และเป็น Admin เริ่มต้น
- Admin: สร้าง/ปิดหลักสูตร มอบ/ถอน Issuer ออกและเพิกถอนใบรับรอง
- Issuer: ออกใบรับรองเท่านั้น ไม่สามารถเพิกถอนหรือเพิ่มสิทธิ์ตนเอง
- บุคคลทั่วไป: อ่าน/ตรวจสอบได้ ผู้รับเชื่อม Wallet เพื่อดูประวัติ
- ไม่มีชื่อบุคคลหรือเอกสารฉบับเต็มใน certificate struct หรือ event บน Blockchain; Wallet เป็นข้อมูลสาธารณะที่เชื่อมโยงได้ ควรแจ้งผู้รับและหลีกเลี่ยง PII ในรายละเอียดหลักสูตร
- JSON มีข้อมูลส่วนตัว ควรส่งให้ผู้รับผ่านช่องทางส่วนตัว สำรองทันที ระบบนี้ยังไม่มี private database หรือบริการส่งเอกสารข้ามอุปกรณ์อัตโนมัติ
- รหัส/QR ยืนยันทะเบียนและสถานะ **ยังไม่ยืนยันชื่อบนกระดาษ** ใช้ JSON เพื่อเทียบชื่อ/รายละเอียด
- PDF ที่แนบตอนออกตรวจด้วย Hash ทุกไบต์ได้ PDF ที่พิมพ์จากเว็บภายหลังใช้ QR ตรวจสถานะและ JSON ยืนยันข้อมูล ไม่ใช่ PDF ต้นฉบับที่ผูก Hash ไว้
- โค้ดเป็นโครงการสาธิตการศึกษา ใช้ Sepolia ยังไม่ได้ผ่านการ audit สำหรับ production

## การทดสอบ

ชุดทดสอบ Node.js + Ganache + Solidity 0.8.30 ตรวจ authorization, duplicate IDs, revocation history, course activation, invalid data, pagination, recipient Wallet history, canonical hashing, tampering และ HTML escaping

## เปลี่ยนบัญชี Wallet

- **Demo:** กดปุ่มบัญชีด้านขวาบน แล้วเลือกผู้ดูแล ผู้เรียน หรือบัญชีทดลองเพิ่มเติม ระบบแยกใบรับรองและสิทธิ์ตาม Address
- **Sepolia:** กดปุ่ม Address เพื่อเลือกจากบัญชีที่ Wallet อนุญาต หากไม่พบบัญชีที่ต้องการ กด **เลือกบัญชีเพิ่มเติมใน MetaMask** แล้วอนุญาตบัญชีนั้น กลับมาเลือก Address ที่ต้องการในเว็บ
- ปุ่มรูปออกจากระบบข้าง Address ใช้ตัดการเชื่อมต่อในเว็บไซต์ การเชื่อมต่อครั้งถัดไปจะขอเลือกบัญชี แทนการใช้บัญชีเดิมอัตโนมัติ
- หาก Wallet ไม่รองรับหน้าขอเลือกบัญชี ให้จัดการบัญชีที่อนุญาตจาก Connected sites / การเชื่อมต่อ ใน MetaMask
- บัญชีผู้เรียนไม่มีสิทธิ์ออกหรือเพิกถอน จนกว่า Owner/Admin จะมอบสิทธิ์ให้
