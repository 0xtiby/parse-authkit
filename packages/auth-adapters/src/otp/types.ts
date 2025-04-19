import type { OtpAdapter } from "./adapter";

export interface AuthData {
  email: string;
  otp: string;
}

export interface OtpOptions {
  otpValidityInMs: number;
  maxAttempts: number;
  sendEmail: (email: string, otp: string) => Promise<void>;
}

export interface OtpAdapterOptions {
  options: OtpOptions;
  module: OtpAdapter;
}
