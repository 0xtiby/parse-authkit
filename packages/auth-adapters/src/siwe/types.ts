import type { SiweAdapter } from "./adapter";

export interface AuthData {
  message: string;
  signature: string;
  nonce: string;
  address: string;
}

export interface SiweOptions {
  domain: string;
  statement: string;
  version: string;
  preventReplay: boolean;
  messageValidityInMs: number;
}

export interface SiweAdapterOptions {
  options: SiweOptions;
  module: SiweAdapter;
}

export type SiweChallengeData =
  | {
      responseType: "message";
      address: string;
      uri: string;
      chainId: number;
    }
  | {
      responseType: "nonce-expiration";
    };
