import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, uintCV, stringAsciiCV, buffCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PROOF_HASH = 101;
const ERR_INVALID_CREDENTIAL_TYPE = 102;
const ERR_INVALID_TIMESTAMP = 103;
const ERR_PROOF_ALREADY_EXISTS = 104;
const ERR_PROOF_NOT_FOUND = 105;
const ERR_PROOF_ALREADY_VERIFIED = 106;
const ERR_PROOF_REJECTED = 107;
const ERR_INVALID_INSTITUTION = 108;
const ERR_INSTITUTION_NOT_REGISTERED = 109;
const ERR_USER_NOT_REGISTERED = 110;
const ERR_INVALID_VERIFICATION_LEVEL = 111;
const ERR_INVALID_EXPIRY = 112;
const ERR_PROOF_EXPIRED = 113;
const ERR_INVALID_SIGNATURE = 114;
const ERR_MAX_PROOFS_EXCEEDED = 115;
const ERR_INVALID_METADATA = 116;
const ERR_REVOCATION_NOT_ALLOWED = 117;
const ERR_INVALID_REVOCATION_REASON = 118;
const ERR_AUTHORITY_NOT_SET = 119;
const ERR_INVALID_FEE = 120;

interface Proof {
  user: string;
  proofHash: Uint8Array;
  credentialType: string;
  metadata: string;
  timestamp: number;
  expiry: number;
  verificationLevel: number;
  verified: boolean;
  rejected: boolean;
  institution: string | null;
  signature: Uint8Array | null;
  revoked: boolean;
  revocationReason: string | null;
  revocationTimestamp: number | null;
}

interface Institution {
  name: string;
  registeredAt: number;
  active: boolean;
}

interface User {
  registeredAt: number;
  proofCount: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VerificationContractMock {
  state: {
    nextProofId: number;
    maxProofsPerUser: number;
    verificationFee: number;
    authorityContract: string | null;
    proofs: Map<number, Proof>;
    proofsByHash: Map<string, number>;
    institutions: Map<string, Institution>;
    users: Map<string, User>;
  } = {
    nextProofId: 0,
    maxProofsPerUser: 50,
    verificationFee: 500,
    authorityContract: null,
    proofs: new Map(),
    proofsByHash: new Map(),
    institutions: new Map(),
    users: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProofId: 0,
      maxProofsPerUser: 50,
      verificationFee: 500,
      authorityContract: null,
      proofs: new Map(),
      proofsByHash: new Map(),
      institutions: new Map(),
      users: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxProofsPerUser(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_FEE };
    this.state.maxProofsPerUser = newMax;
    return { ok: true, value: true };
  }

  setVerificationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    this.state.verificationFee = newFee;
    return { ok: true, value: true };
  }

  registerInstitution(name: string): Result<boolean> {
    if (this.state.institutions.has(this.caller)) return { ok: false, value: ERR_INSTITUTION_NOT_REGISTERED };
    if (name.length === 0) return { ok: false, value: ERR_INVALID_CREDENTIAL_TYPE };
    this.state.institutions.set(this.caller, { name, registeredAt: this.blockHeight, active: true });
    return { ok: true, value: true };
  }

  registerUser(): Result<boolean> {
    if (this.state.users.has(this.caller)) return { ok: false, value: ERR_USER_NOT_REGISTERED };
    this.state.users.set(this.caller, { registeredAt: this.blockHeight, proofCount: 0 });
    return { ok: true, value: true };
  }

  submitProof(
    proofHash: Uint8Array,
    credentialType: string,
    metadata: string,
    expiry: number,
    verificationLevel: number
  ): Result<number> {
    if (proofHash.length !== 32) return { ok: false, value: ERR_INVALID_PROOF_HASH };
    if (credentialType.length === 0 || credentialType.length > 100) return { ok: false, value: ERR_INVALID_CREDENTIAL_TYPE };
    if (metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (verificationLevel < 1 || verificationLevel > 5) return { ok: false, value: ERR_INVALID_VERIFICATION_LEVEL };
    const hashKey = proofHash.toString();
    if (this.state.proofsByHash.has(hashKey)) return { ok: false, value: ERR_PROOF_ALREADY_EXISTS };
    const user = this.state.users.get(this.caller);
    if (!user) return { ok: false, value: ERR_USER_NOT_REGISTERED };
    if (user.proofCount >= this.state.maxProofsPerUser) return { ok: false, value: ERR_MAX_PROOFS_EXCEEDED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };

    this.stxTransfers.push({ amount: this.state.verificationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextProofId;
    const proof: Proof = {
      user: this.caller,
      proofHash,
      credentialType,
      metadata,
      timestamp: this.blockHeight,
      expiry,
      verificationLevel,
      verified: false,
      rejected: false,
      institution: null,
      signature: null,
      revoked: false,
      revocationReason: null,
      revocationTimestamp: null,
    };
    this.state.proofs.set(id, proof);
    this.state.proofsByHash.set(hashKey, id);
    this.state.users.set(this.caller, { ...user, proofCount: user.proofCount + 1 });
    this.state.nextProofId++;
    return { ok: true, value: id };
  }

  verifyProof(id: number, signature: Uint8Array): Result<boolean> {
    const proof = this.state.proofs.get(id);
    if (!proof) return { ok: false, value: ERR_PROOF_NOT_FOUND };
    const inst = this.state.institutions.get(this.caller);
    if (!inst || !inst.active) return { ok: false, value: ERR_INSTITUTION_NOT_REGISTERED };
    if (signature.length !== 65) return { ok: false, value: ERR_INVALID_SIGNATURE };
    if (proof.verified) return { ok: false, value: ERR_PROOF_ALREADY_VERIFIED };
    if (proof.rejected) return { ok: false, value: ERR_PROOF_REJECTED };
    if (this.blockHeight >= proof.expiry) return { ok: false, value: ERR_PROOF_EXPIRED };
    this.state.proofs.set(id, { ...proof, verified: true, institution: this.caller, signature });
    return { ok: true, value: true };
  }

  rejectProof(id: number): Result<boolean> {
    const proof = this.state.proofs.get(id);
    if (!proof) return { ok: false, value: ERR_PROOF_NOT_FOUND };
    const inst = this.state.institutions.get(this.caller);
    if (!inst || !inst.active) return { ok: false, value: ERR_INSTITUTION_NOT_REGISTERED };
    if (proof.verified) return { ok: false, value: ERR_PROOF_ALREADY_VERIFIED };
    if (proof.rejected) return { ok: false, value: ERR_PROOF_REJECTED };
    this.state.proofs.set(id, { ...proof, rejected: true });
    return { ok: true, value: true };
  }

  revokeProof(id: number, reason: string): Result<boolean> {
    const proof = this.state.proofs.get(id);
    if (!proof) return { ok: false, value: ERR_PROOF_NOT_FOUND };
    if (proof.user !== this.caller) return { ok: false, value: ERR_REVOCATION_NOT_ALLOWED };
    if (reason.length > 100) return { ok: false, value: ERR_INVALID_REVOCATION_REASON };
    if (!proof.verified) return { ok: false, value: ERR_PROOF_NOT_FOUND };
    if (proof.revoked) return { ok: false, value: ERR_PROOF_REJECTED };
    this.state.proofs.set(id, { ...proof, revoked: true, revocationReason: reason, revocationTimestamp: this.blockHeight });
    return { ok: true, value: true };
  }

  getProof(id: number): Proof | null {
    return this.state.proofs.get(id) || null;
  }

  isProofVerified(id: number): boolean {
    const proof = this.state.proofs.get(id);
    if (!proof) return false;
    return proof.verified && !proof.rejected && !proof.revoked && proof.expiry >= this.blockHeight;
  }
}

describe("VerificationContract", () => {
  let contract: VerificationContractMock;

  beforeEach(() => {
    contract = new VerificationContractMock();
    contract.reset();
  });

  it("registers a user successfully", () => {
    const result = contract.registerUser();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const user = contract.state.users.get("ST1TEST");
    expect(user?.registeredAt).toBe(0);
    expect(user?.proofCount).toBe(0);
  });

  it("registers an institution successfully", () => {
    const result = contract.registerInstitution("UniversityX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const inst = contract.state.institutions.get("ST1TEST");
    expect(inst?.name).toBe("UniversityX");
    expect(inst?.active).toBe(true);
  });

  it("submits a proof successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    const proofHash = new Uint8Array(32).fill(1);
    const result = contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const proof = contract.getProof(0);
    expect(proof?.credentialType).toBe("BSc");
    expect(proof?.verified).toBe(false);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2AUTH" }]);
  });

  it("verifies a proof successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    contract.caller = "ST3INST";
    contract.registerInstitution("UniversityX");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    contract.caller = "ST3INST";
    const signature = new Uint8Array(65).fill(2);
    const result = contract.verifyProof(0, signature);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proof = contract.getProof(0);
    expect(proof?.verified).toBe(true);
    expect(proof?.institution).toBe("ST3INST");
  });

  it("rejects a proof successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    contract.caller = "ST3INST";
    contract.registerInstitution("UniversityX");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    contract.caller = "ST3INST";
    const result = contract.rejectProof(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proof = contract.getProof(0);
    expect(proof?.rejected).toBe(true);
  });

  it("revokes a proof successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    contract.caller = "ST3INST";
    contract.registerInstitution("UniversityX");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    contract.caller = "ST3INST";
    const signature = new Uint8Array(65).fill(2);
    contract.verifyProof(0, signature);
    contract.caller = "ST1TEST";
    const result = contract.revokeProof(0, "Invalid data");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proof = contract.getProof(0);
    expect(proof?.revoked).toBe(true);
    expect(proof?.revocationReason).toBe("Invalid data");
  });

  it("checks if proof is verified correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    contract.caller = "ST3INST";
    contract.registerInstitution("UniversityX");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    contract.caller = "ST3INST";
    const signature = new Uint8Array(65).fill(2);
    contract.verifyProof(0, signature);
    expect(contract.isProofVerified(0)).toBe(true);
    contract.blockHeight = 101;
    expect(contract.isProofVerified(0)).toBe(false);
  });

  it("rejects submission with invalid hash", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    const proofHash = new Uint8Array(31).fill(1);
    const result = contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROOF_HASH);
  });

  it("rejects verification with invalid signature", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    contract.caller = "ST3INST";
    contract.registerInstitution("UniversityX");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    contract.caller = "ST3INST";
    const signature = new Uint8Array(64).fill(2);
    const result = contract.verifyProof(0, signature);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SIGNATURE);
  });

  it("rejects revocation by non-owner", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.registerUser();
    contract.caller = "ST3INST";
    contract.registerInstitution("UniversityX");
    contract.caller = "ST1TEST";
    const proofHash = new Uint8Array(32).fill(1);
    contract.submitProof(proofHash, "BSc", "Degree in CS", 100, 3);
    contract.caller = "ST3INST";
    const signature = new Uint8Array(65).fill(2);
    contract.verifyProof(0, signature);
    contract.caller = "ST4OTHER";
    const result = contract.revokeProof(0, "Invalid data");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REVOCATION_NOT_ALLOWED);
  });

  it("sets verification fee successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setVerificationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.verificationFee).toBe(1000);
  });
});