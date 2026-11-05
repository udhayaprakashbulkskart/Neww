import { env } from '../env';

/**
 * Identity, address and bank verification adapter.
 *
 * Real verification must go through an authorised provider under a signed contract, using
 * consent-based flows (for example DigiLocker / Aadhaar offline e-KYC through an AUA/KUA partner,
 * and a penny-drop or name-match API from a licensed bank-verification provider). HelpTrust never
 * receives or stores raw Aadhaar numbers; the provider returns a verification result and reference.
 *
 * The "mock" adapter is available only in development and tests. Production refuses to start with it.
 */

export type KycResult =
  | { status: 'VERIFIED'; providerRef: string }
  | { status: 'REJECTED'; providerRef: string; reason: string }
  | { status: 'ADDITIONAL_INFO_REQUIRED'; providerRef: string; reason: string };

export interface KycProvider {
  readonly name: string;
  verifyIdentity(input: { userRef: string; fullName: string; consentId: string }): Promise<KycResult>;
  verifyAddress(input: { userRef: string; fullName: string; addressLine: string; pincode: string }): Promise<KycResult>;
  verifyBankAccount(input: {
    userRef: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
  }): Promise<KycResult>;
}

const mock: KycProvider = {
  name: 'mock-sandbox',
  async verifyIdentity({ userRef, fullName, consentId }) {
    if (!consentId) return { status: 'REJECTED', providerRef: 'mock', reason: 'Consent is required.' };
    return { status: 'VERIFIED', providerRef: `mock_id_${userRef.slice(-6)}_${fullName.length}` };
  },
  async verifyAddress({ userRef, addressLine, pincode }) {
    if (addressLine.length < 5 || !/^\d{6}$/.test(pincode)) {
      return { status: 'ADDITIONAL_INFO_REQUIRED', providerRef: 'mock', reason: 'Address could not be matched.' };
    }
    return { status: 'VERIFIED', providerRef: `mock_addr_${userRef.slice(-6)}` };
  },
  async verifyBankAccount({ userRef, accountNumber }) {
    // Sandbox convention: account numbers ending in 0000 simulate a failed penny-drop.
    if (accountNumber.endsWith('0000')) {
      return { status: 'REJECTED', providerRef: 'mock', reason: 'Account could not be validated.' };
    }
    return { status: 'VERIFIED', providerRef: `mock_bank_${userRef.slice(-6)}` };
  },
};

export function getKycProvider(): KycProvider {
  const name = env().KYC_PROVIDER;
  if (name === 'mock') return mock;
  throw new Error(`Unsupported KYC provider: ${name}`);
}
