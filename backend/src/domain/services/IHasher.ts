/**
 * Slow, salted hashing for low-entropy secrets: user passwords AND OTP
 * codes. A 6-digit OTP is only ~20 bits of entropy, so it needs the same
 * "expensive to brute force offline" property a password does -- a fast
 * hash (sha256) would not provide that. One interface, one implementation
 * (bcrypt), reused for both call sites.
 */
export interface IHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, hash: string): Promise<boolean>;
}
