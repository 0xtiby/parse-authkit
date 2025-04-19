/* global Parse */
import { SiweErrorType, SiweMessage, generateNonce } from "siwe";
import { isAddress } from "viem";
import { type AuthData, type SiweAdapterOptions, type SiweChallengeData } from "./types";
import { NONCE_TABLE_NAME, getExpirationTime } from "./lib";

export class SiweAdapter {
  constructor() {}

  async validateAuthData(
    authData: AuthData,
    { options }: SiweAdapterOptions
  ): Promise<void> {
    const { message, signature, nonce, address } = authData;
    const { domain, statement, version, preventReplay } = options;

    if (!message || !signature || !nonce || !address) {
      throw new Parse.Error(
        Parse.Error.OBJECT_NOT_FOUND,
        "Missing required fields in authData (message, signature, nonce, address)."
      );
    }

    let SIWEObject: SiweMessage;
    try {
      SIWEObject = new SiweMessage(message);
    } catch (parseError) {
      console.error("SIWE-AUTH-ADAPTER: Error parsing SIWE message:", parseError);
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Invalid SIWE message format.");
    }

    if (SIWEObject.domain !== domain) {
      console.warn(
        `SIWE-AUTH-ADAPTER: Domain mismatch. Expected: ${domain}, Got: ${SIWEObject.domain}`
      );
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Invalid domain.");
    }
    if (SIWEObject.statement !== statement) {
      console.warn(
        `SIWE-AUTH-ADAPTER: Statement mismatch. Expected: ${statement}, Got: ${SIWEObject.statement}`
      );
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Invalid statement.");
    }
    if (SIWEObject.version !== version) {
      console.warn(
        `SIWE-AUTH-ADAPTER: Version mismatch. Expected: ${version}, Got: ${SIWEObject.version}`
      );
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Invalid version.");
    }

    if (SIWEObject.address.toLowerCase() !== address.toLowerCase()) {
      console.warn(
        `SIWE-AUTH-ADAPTER: Address mismatch in message vs authData. Message: ${SIWEObject.address}, AuthData: ${address}`
      );
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Address mismatch.");
    }

    try {
      console.log(
        `SIWE-AUTH-ADAPTER: Verifying signature for nonce: ${nonce}, address: ${address}`
      );
      await SIWEObject.verify({
        signature,
        nonce,
      });
      console.log(
        `SIWE-AUTH-ADAPTER: Signature verified successfully for nonce: ${nonce}`
      );

      if (preventReplay) {
        console.log(
          `SIWE-AUTH-ADAPTER: Replay prevention enabled. Checking nonce ${nonce} in DB.`
        );
        const query = new Parse.Query(NONCE_TABLE_NAME);
        query.equalTo("nonce", nonce);
        query.greaterThan("expirationTime", new Date());
        const nonceObject = await query.first({ useMasterKey: true });

        if (!nonceObject) {
          console.warn(
            `SIWE-AUTH-ADAPTER: Nonce validation failed. Nonce not found or expired in DB: ${nonce}`
          );
          const deleteQuery = new Parse.Query(NONCE_TABLE_NAME);
          deleteQuery.equalTo("nonce", nonce);
          const toDelete = await deleteQuery.first({ useMasterKey: true });
          if (toDelete) await toDelete.destroy({ useMasterKey: true });

          throw SiweErrorType.EXPIRED_MESSAGE;
        }

        console.log(
          `SIWE-AUTH-ADAPTER: Nonce ${nonce} found and valid. Destroying nonce.`
        );
        await nonceObject.destroy({ useMasterKey: true });
      }

      console.log(
        `SIWE-AUTH-ADAPTER: Validation successful for address: ${address}, nonce: ${nonce}`
      );
    } catch (error: any) {
      console.warn(
        `SIWE-AUTH-ADAPTER: Validation failed for address: ${address}, nonce: ${nonce}. Error:`,
        error
      );
      if (
        preventReplay &&
        error !== SiweErrorType.EXPIRED_MESSAGE &&
        error !== SiweErrorType.NONCE_MISMATCH
      ) {
        const query = new Parse.Query(NONCE_TABLE_NAME);
        query.equalTo("nonce", nonce);
        const nonceObject = await query.first({ useMasterKey: true });
        if (nonceObject) {
          console.log(
            `SIWE-AUTH-ADAPTER: Destroying nonce ${nonce} due to validation error.`
          );
          await nonceObject.destroy({ useMasterKey: true });
        }
      }

      switch (error) {
        case SiweErrorType.EXPIRED_MESSAGE:
        case SiweErrorType.NONCE_MISMATCH:
          throw new Parse.Error(
            Parse.Error.OBJECT_NOT_FOUND,
            "Message expired or nonce invalid."
          );
        case SiweErrorType.INVALID_SIGNATURE:
          throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Invalid signature.");
        default:
          console.error("SIWE-AUTH-ADAPTER: Unknown verification error", error);
          throw new Parse.Error(
            Parse.Error.INTERNAL_SERVER_ERROR,
            `Authentication failed: ${error.message || "Unknown reason"}`
          );
      }
    }
  }

  async challenge(
    challengeData: SiweChallengeData,
    _authData: unknown,
    { options }: SiweAdapterOptions
  ): Promise<{ nonce: string; expirationTime?: string; message?: string }> {
    const { domain, statement, version, preventReplay, messageValidityInMs } = options;
    const nonce = generateNonce();
    const expirationTime = getExpirationTime(messageValidityInMs);
    const expirationTimeISO = expirationTime.toISOString();

    console.log(
      `SIWE-AUTH-ADAPTER: Generating challenge type '${challengeData.responseType}'. Nonce: ${nonce}, Expires: ${expirationTimeISO}`
    );

    if (challengeData.responseType === "message") {
      const { chainId, address, uri } = challengeData;
      if (!Number.isInteger(chainId) || chainId <= 0) {
        throw new Parse.Error(
          Parse.Error.INVALID_JSON,
          "Invalid chainId provided for challenge."
        );
      }
      if (!isAddress(address)) {
        throw new Parse.Error(
          Parse.Error.INVALID_JSON,
          "Invalid Ethereum address provided for challenge."
        );
      }
      if (!uri || typeof uri !== "string") {
        throw new Parse.Error(
          Parse.Error.INVALID_JSON,
          "Valid URI is required for challenge."
        );
      }
    }

    if (preventReplay) {
      console.log(
        `SIWE-AUTH-ADAPTER: Saving nonce ${nonce} to DB for replay prevention.`
      );
      const nonceObject = new Parse.Object(NONCE_TABLE_NAME);
      nonceObject.set("nonce", nonce);
      nonceObject.set("expirationTime", expirationTime);
      try {
        await nonceObject.save({}, { useMasterKey: true });
        console.log(`SIWE-AUTH-ADAPTER: Nonce ${nonce} saved successfully.`);
      } catch (dbError) {
        console.error(`SIWE-AUTH-ADAPTER: Failed to save nonce ${nonce} to DB.`, dbError);
        throw new Parse.Error(
          Parse.Error.INTERNAL_SERVER_ERROR,
          "Failed to save nonce for challenge."
        );
      }
    }

    if (challengeData.responseType === "nonce-expiration") {
      return {
        nonce,
        expirationTime: expirationTimeISO,
      };
    } else {
      const { address, uri, chainId } = challengeData;
      const message = new SiweMessage({
        domain,
        statement,
        version,
        address,
        nonce,
        uri,
        chainId,
        expirationTime: expirationTimeISO,
      });
      const preparedMessage = message.prepareMessage();
      console.log(`SIWE-AUTH-ADAPTER: Generated SIWE message for address ${address}:
${preparedMessage}`);
      return { message: preparedMessage, nonce };
    }
  }

  validateOptions({ options: siweOptions, module }: SiweAdapterOptions): void {
    if (!siweOptions) {
      throw new Error("SIWE Adapter: Options object (SiweOptions) is required.");
    }
    if (!siweOptions.domain || typeof siweOptions.domain !== "string") {
      throw new Error("SIWE Adapter: Invalid or missing 'domain' in options.");
    }
    if (!siweOptions.statement || typeof siweOptions.statement !== "string") {
      throw new Error("SIWE Adapter: Invalid or missing 'statement' in options.");
    }
    if (!siweOptions.version || typeof siweOptions.version !== "string") {
      throw new Error("SIWE Adapter: Invalid or missing 'version' in options.");
    }
    if (typeof siweOptions.preventReplay !== "boolean") {
      throw new Error(
        "SIWE Adapter: Invalid or missing 'preventReplay' flag (boolean) in options."
      );
    }
    if (
      typeof siweOptions.messageValidityInMs !== "number" ||
      siweOptions.messageValidityInMs <= 0
    ) {
      throw new Error(
        "SIWE Adapter: Invalid or missing 'messageValidityInMs' (positive number) in options."
      );
    }
    if (!(module instanceof SiweAdapter)) {
      throw new Error("SIWE Adapter: Module must be an instance of SiweAdapter.");
    }
    console.log("SIWE-AUTH-ADAPTER: Options validated successfully.");
  }

  validateAppId(): Promise<void> {
    return Promise.resolve();
  }
}
