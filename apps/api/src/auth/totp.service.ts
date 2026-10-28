import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }

    value &= (1 << bits) - 1;
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/u, "").replace(/\s+/gu, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid base32 input");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }

    value &= (1 << bits) - 1;
  }

  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

@Injectable()
export class TotpService {
  private readonly encryptionKey: Buffer;
  private readonly issuer: string;

  constructor(config: ConfigService) {
    this.encryptionKey = Buffer.from(config.get<string>("MFA_ENCRYPTION_KEY") ?? "", "base64");
    this.issuer = "PawnPilot";
  }

  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  otpauthUrl(accountLabel: string, secret: string): string {
    const label = encodeURIComponent(`${this.issuer}:${accountLabel}`);
    const issuer = encodeURIComponent(this.issuer);

    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }

  verify(secret: string, code: string, window = 1): boolean {
    const normalizedCode = code.trim();

    if (!/^\d{6}$/u.test(normalizedCode)) {
      return false;
    }

    let secretBytes: Buffer;

    try {
      secretBytes = base32Decode(secret);
    } catch {
      return false;
    }

    const currentCounter = Math.floor(Date.now() / 30_000);

    for (let offset = -window; offset <= window; offset += 1) {
      const expected = hotp(secretBytes, currentCounter + offset);
      const left = Buffer.from(expected);
      const right = Buffer.from(normalizedCode);

      if (left.length === right.length && timingSafeEqual(left, right)) {
        return true;
      }
    }

    return false;
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      "v1",
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join(":");
  }

  decryptSecret(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const parts = value.split(":");

    if (parts.length !== 4 || parts[0] !== "v1") {
      return null;
    }

    try {
      const iv = Buffer.from(parts[1] as string, "base64url");
      const tag = Buffer.from(parts[2] as string, "base64url");
      const encrypted = Buffer.from(parts[3] as string, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);

      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
}
