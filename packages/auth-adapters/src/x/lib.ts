/* global Parse */
import type { XParseServerAuthOptions, XUserData } from "./types";
import { XAuthAdapter } from "./adapter";

export class XAuthError extends Error {
  constructor(
    message: string,
    public readonly type: "AUTH" | "API" | "NETWORK",
    public readonly status?: number
  ) {
    super(message);
    this.name = "XAuthError";
  }
}

export function initializeXAdapter(): XParseServerAuthOptions {
  return { module: new XAuthAdapter(), options: {} };
}

export async function fetchUserData(accessToken: string): Promise<XUserData> {
  const X_API_ENDPOINT =
    "https://api.x.com/2/users/me?user.fields=confirmed_email,username,name";

  try {
    const response = await fetch(X_API_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const responseData = await response.json();

    if (!response.ok) {
      const isAuthError = response.status === 401 || response.status === 403;
      const errorType = isAuthError ? "AUTH" : "API";
      const errorMessage = isAuthError
        ? "Invalid or expired X access token (X API)."
        : `X API responded with status ${response.status}. Body: ${JSON.stringify(responseData)}`;

      console.error("X-API-FETCH: Fetch failed - API error.", {
        status: response.status,
        body: responseData,
      });

      throw new XAuthError(errorMessage, errorType, response.status);
    }

    const xUserData = responseData.data;
    if (!xUserData) {
      console.error(
        "X-API-FETCH: Fetch failed - API did not return user data.",
        responseData
      );
      throw new XAuthError("X API did not return expected user data.", "API");
    }

    return xUserData;
  } catch (error: any) {
    if (error instanceof XAuthError) {
      throw error;
    }
    console.error("X-API-FETCH: Network or parsing error:", error);
    throw new XAuthError(
      `Failed to fetch X user data: ${error.message || "Unknown error"}`,
      "NETWORK"
    );
  }
}
