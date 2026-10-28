import { randomInt } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

// A valid Argon2id hash used only to keep unknown-account login timing closer to known accounts.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ej0GznS9+6yz/UHqjJSRag$zzZdWi3p89qlZwG2lYjOfpmnGfy2WTBbcnOeOb3bblk";

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    if (!hash) {
      return false;
    }

    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyDummy(password: string): Promise<void> {
    await this.verify(DUMMY_HASH, password);
  }

  validate(password: string): void {
    if (password.length < 12 || password.length > 128) {
      throw new BadRequestException({
        code: "WEAK_PASSWORD",
        message: "Password must be between 12 and 128 characters.",
      });
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException({
        code: "WEAK_PASSWORD",
        message: "Password must include at least one letter and one number.",
      });
    }
  }

  generateTemporaryPassword(): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%&*";
    const all = upper + lower + digits + symbols;
    const required = [
      upper[randomInt(upper.length)],
      lower[randomInt(lower.length)],
      digits[randomInt(digits.length)],
      symbols[randomInt(symbols.length)],
    ];

    while (required.length < 18) {
      required.push(all[randomInt(all.length)] as string);
    }

    for (let index = required.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      const current = required[index] as string;
      required[index] = required[swapIndex] as string;
      required[swapIndex] = current;
    }

    return required.join("");
  }
}
