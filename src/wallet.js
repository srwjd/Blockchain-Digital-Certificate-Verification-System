import { getAddress, isAddress } from 'ethers';

export const DEMO_ACCOUNTS = [
  { address: '0x1111111111111111111111111111111111111111', label: 'ผู้ดูแลระบบทดลอง', detail: 'Owner เริ่มต้น · สร้างหลักสูตรและจัดการใบรับรอง' },
  { address: '0x2222222222222222222222222222222222222222', label: 'ผู้เรียนทดลอง', detail: 'ดูใบรับรองของ Wallet ผู้เรียนอีกบัญชี' },
  { address: '0x3333333333333333333333333333333333333333', label: 'บัญชีทดลองเพิ่มเติม', detail: 'เริ่มต้นไม่มีสิทธิ์ · ทดลองมอบ Issuer หรือ Admin ได้' },
];

function validAccounts(accounts) {
  if (!Array.isArray(accounts) || !accounts.length || accounts.some(a => !isAddress(a))) {
    throw new Error('Wallet ยังไม่ได้อนุญาตบัญชี กรุณาเลือกบัญชีใน MetaMask');
  }
  return [...new Set(accounts.map(getAddress))];
}

export async function requestWalletAccounts(provider, { requestSelection = false } = {}) {
  if (!provider?.request) throw new Error('กรุณาติดตั้ง MetaMask หรือเปิดเว็บด้วย Wallet browser');
  let selectionSupported = true;
  if (requestSelection) {
    try {
      await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
    } catch (error) {
      // Unsupported wallet APIs may fall back to the permitted-account list.
      // Cancellation and all other failures must never reconnect the old account.
      if (error.code !== -32601 && error.code !== 4200) throw error;
      selectionSupported = false;
    }
  }
  const accounts = validAccounts(await provider.request({ method: 'eth_requestAccounts' }));
  return { accounts, selectionSupported };
}

export async function selectWalletAccount(provider, selectedAccount, chainId) {
  if (!isAddress(selectedAccount)) throw new Error('กรุณาเลือกบัญชี Wallet ที่ต้องการ');
  const selected = getAddress(selectedAccount);
  const allowed = () => provider.request({ method: 'eth_accounts' }).then(validAccounts);
  if (!(await allowed()).includes(selected)) throw new Error('บัญชีนี้ยังไม่ได้รับอนุญาต กดเลือกบัญชีเพิ่มเติมใน MetaMask');
  if (Number(await provider.request({ method: 'eth_chainId' })) !== chainId) {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] });
  }
  const [accounts, currentChain] = await Promise.all([allowed(), provider.request({ method: 'eth_chainId' })]);
  if (!accounts.includes(selected)) throw new Error('บัญชี Wallet เปลี่ยนระหว่างเชื่อมต่อ กรุณาเลือกใหม่');
  if (Number(currentChain) !== chainId) throw new Error('กรุณาเปลี่ยนเครือข่ายเป็น Sepolia');
  return selected;
}

export function demoRoles(address, registry) {
  const matches = candidate => candidate.toLowerCase() === address.toLowerCase();
  const owner = matches(DEMO_ACCOUNTS[0].address);
  const admin = owner || registry.admins.some(matches);
  return { owner, admin, issuer: admin || registry.issuers.some(matches) };
}
