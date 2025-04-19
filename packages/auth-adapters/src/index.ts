// OTP Adapter Exports
export {
  OtpAdapter,
  OTP_TABLE_NAME,
  OTP_TABLE_SCHEMA,
  getExpirationTime as getOtpExpirationTime,
  setupOtpTable,
  initializeOtpAdapter,
  updateOtpAuthDataAfterSave,
} from "./otp";
export type { AuthData as OtpAuthData, OtpOptions, OtpAdapterOptions } from "./otp";

// SIWE Adapter Exports
export {
  SiweAdapter,
  NONCE_TABLE_NAME,
  NONCE_TABLE_SCHEMA,
  getExpirationTime as getSiweExpirationTime,
  setupNonceTable,
  initializeSiweAdapter,
  cleanupNonceTable,
} from "./siwe";
export type {
  AuthData as SiweAuthData,
  SiweOptions,
  SiweAdapterOptions,
  SiweChallengeData,
} from "./siwe";

// X Adapter Exports
export { XAuthAdapter, initializeXAdapter } from "./x";
export type { XAuthData, XParseServerAuthOptions, XUserData } from "./x";
