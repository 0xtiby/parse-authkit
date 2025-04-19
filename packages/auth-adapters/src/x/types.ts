import type { XAuthAdapter } from "./adapter";

export interface XParseServerAuthOptions {
  module: XAuthAdapter; // Keep reference to the class type
  options?: unknown; // Generally unused for X, defined for interface consistency
}

export interface XAuthData {
  id: string; // User's X ID
  access_token: string;
}

export interface XUserData {
  id: string;
  verified_email?: string;
  username: string;
  name: string;
}
