// Note: do not import Parse dependency. see https://github.com/parse-community/parse-server/issues/6467
/* global Parse */
import { fetchUserData, XAuthError } from "./lib";
import { type XAuthData, type XParseServerAuthOptions } from "./types";

export class XAuthAdapter {
  constructor() {}

  async validateAuthData(
    authData: XAuthData,
    _adapterOptions: XParseServerAuthOptions,
    _request: Parse.Cloud.TriggerRequest
  ): Promise<XAuthData & { email?: string; username?: string; name?: string }> {
    const { id: userId, access_token: accessToken } = authData;

    if (!userId || !accessToken) {
      throw new Parse.Error(
        Parse.Error.OBJECT_NOT_FOUND,
        'X authData must include "id" and "access_token".'
      );
    }

    try {
      const xUserData = await fetchUserData(accessToken);

      if (xUserData.id !== userId) {
        throw new Parse.Error(
          Parse.Error.OBJECT_NOT_FOUND,
          "X token is valid but does not match the provided user ID."
        );
      }

      return {
        ...authData,
        ...(xUserData.verified_email && { email: xUserData.verified_email }),
        ...(xUserData.username && { username: xUserData.username }),
        ...(xUserData.name && { name: xUserData.name }),
      };
    } catch (error: any) {
      if (error instanceof Parse.Error) {
        throw error;
      }

      if (error instanceof XAuthError) {
        const parseErrorCode =
          error.type === "AUTH"
            ? Parse.Error.OBJECT_NOT_FOUND
            : Parse.Error.INTERNAL_SERVER_ERROR;
        throw new Parse.Error(parseErrorCode, error.message);
      }

      throw new Parse.Error(
        Parse.Error.INTERNAL_SERVER_ERROR,
        error.message || "Unknown validation error"
      );
    }
  }

  validateAppId(): Promise<void> {
    return Promise.resolve();
  }

  validateOptions({ module }: XParseServerAuthOptions): void {
    if (!(module instanceof XAuthAdapter)) {
      throw new Error("X Adapter: Module must be an instance of XAuthAdapter.");
    }
  }
}
