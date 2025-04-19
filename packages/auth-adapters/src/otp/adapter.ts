// Note: do not import Parse dependency. see https://github.com/parse-community/parse-server/issues/6467
/* global Parse */
import crypto from "node:crypto";
import { type AuthData, type OtpAdapterOptions } from "./types";
import { OTP_TABLE_NAME, getExpirationTime } from "./lib";

export class OtpAdapter {
  constructor() {}

  async validateAuthData(
    authData: AuthData,
    { options }: OtpAdapterOptions,
    request: Parse.Cloud.TriggerRequest
  ): Promise<boolean> {
    const { email, otp } = authData;

    if (!email || !otp) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Email and OTP are required.");
    }

    const isMaster = !!request.master;

    if (isMaster) {
      console.log("OTP-AUTH-ADAPTER: Master key used, skipping OTP validation.");
      return true;
    }

    const query = new Parse.Query(OTP_TABLE_NAME);
    query.equalTo("email", email);
    query.descending("createdAt");

    const otpObject = await query.first({ useMasterKey: true });

    if (!otpObject) {
      console.warn(
        `OTP-AUTH-ADAPTER: OTP validation failed - No OTP found for email: ${email}`
      );
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "OTP not found or expired.");
    }

    if (new Date() > otpObject.get("expiresAt")) {
      console.warn(
        `OTP-AUTH-ADAPTER: OTP validation failed - OTP expired for email: ${email}`
      );
      await otpObject.destroy({ useMasterKey: true });
      throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "OTP expired.");
    }

    if (otpObject.get("otp") !== otp) {
      const attempts = (otpObject.get("attempts") || 0) + 1;
      otpObject.set("attempts", attempts);
      console.warn(
        `OTP-AUTH-ADAPTER: OTP validation failed - Invalid OTP for email: ${email}. Attempt ${attempts}/${options.maxAttempts}`
      );

      if (attempts >= options.maxAttempts) {
        await otpObject.destroy({ useMasterKey: true });
        throw new Parse.Error(
          Parse.Error.OBJECT_NOT_FOUND,
          "Max attempts reached. OTP invalidated."
        );
      } else {
        await otpObject.save(null, { useMasterKey: true });
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Invalid OTP.");
      }
    }

    console.log(
      `OTP-AUTH-ADAPTER: OTP validation successful for email: ${email}. Destroying OTP.`
    );
    await otpObject.destroy({ useMasterKey: true });

    return true;
  }

  async challenge(
    challengeData: { email: string },
    _authData: unknown,
    { options }: OtpAdapterOptions
  ): Promise<{ ok: boolean }> {
    const { email } = challengeData;

    if (!email) {
      throw new Parse.Error(
        Parse.Error.OBJECT_NOT_FOUND,
        "Email is required for challenge."
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = getExpirationTime(options.otpValidityInMs);

    const query = new Parse.Query(OTP_TABLE_NAME);
    query.equalTo("email", email);
    let otpObject = await query.first({ useMasterKey: true });

    if (otpObject) {
      console.log(`OTP-AUTH-ADAPTER: Updating existing OTP for email: ${email}`);
      otpObject.set("otp", otp);
      otpObject.set("expiresAt", expiresAt);
      otpObject.set("attempts", 0);
    } else {
      console.log(`OTP-AUTH-ADAPTER: Creating new OTP for email: ${email}`);
      otpObject = new Parse.Object(OTP_TABLE_NAME);
      otpObject.set("email", email);
      otpObject.set("otp", otp);
      otpObject.set("expiresAt", expiresAt);
      otpObject.set("attempts", 0);
    }

    await otpObject.save(null, { useMasterKey: true });
    console.log(
      `OTP-AUTH-ADAPTER: OTP saved for email: ${email}, expires at ${expiresAt.toISOString()}`
    );

    try {
      await options.sendEmail(email, otp);
      console.log(`OTP-AUTH-ADAPTER: OTP sent successfully to email: ${email}`);
    } catch (error) {
      console.error(`OTP-AUTH-ADAPTER: Failed to send OTP email to: ${email}`, error);
    }

    return { ok: true };
  }

  validateAppId(): Promise<void> {
    return Promise.resolve();
  }

  validateOptions({ options: otpOptions, module }: OtpAdapterOptions): void {
    if (!otpOptions) {
      throw new Error("OTP Adapter: Options object (OtpOptions) is required.");
    }
    if (
      typeof otpOptions.otpValidityInMs !== "number" ||
      otpOptions.otpValidityInMs <= 0
    ) {
      throw new Error("OTP Adapter: Invalid or missing 'otpValidityInMs' in options.");
    }
    if (typeof otpOptions.maxAttempts !== "number" || otpOptions.maxAttempts <= 0) {
      throw new Error("OTP Adapter: Invalid or missing 'maxAttempts' in options.");
    }
    if (typeof otpOptions.sendEmail !== "function") {
      throw new Error("OTP Adapter: Invalid or missing 'sendEmail' function in options.");
    }
    if (!(module instanceof OtpAdapter)) {
      throw new Error("OTP Adapter: Module must be an instance of OtpAdapter.");
    }
    console.log("OTP-AUTH-ADAPTER: Options validated successfully.");
  }
}
