# Parse AuthKit

Parse AuthKit is a comprehensive authentication solution for Next.js applications using Parse Server. It provides a suite of packages that simplify the implementation of various authentication methods, including credentials-based login, OAuth, and custom authentication adapters.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Parse Server Setup](#parse-server-setup)
- [Next.js Integration](#nextjs-integration)
- [Basic Usage](#basic-usage)
  - [Credentials Login](#credentials-login)
  - [Middleware](#middleware)
  - [Session Management](#session-management)
- [Authentication Adapters](#authentication-adapters)
  - [OTP (One-Time Password)](#otp-one-time-password)
  - [SIWE (Sign-In with Ethereum)](#siwe-sign-in-with-ethereum)
  - [X (Twitter)](#x-twitter)
- [OAuth Integration](#oauth-integration)
  - [Standard OAuth (GitHub Example)](#standard-oauth-github-example)
  - [OAuth with PKCE (X/Twitter Example)](#oauth-with-pkce-xtwitter-example)

## Installation

### Parse Server Package

```bash
npm install @parseauthkit/parse
```

### Next.js Package

```bash
npm install @parseauthkit/next
```

### Environment Variables

Required environment variables for Next.js:

```env
PARSE_SERVER_URL=your_parse_server_url
PARSE_APPLICATION_ID=your_application_id
SESSION_COOKIE_NAME=your_cookie_name
SESSION_SECRET=your_session_secret
SESSION_TTL=31536000  # Optional: Session duration in seconds (default: 1 year)
```

## Configuration

### Parse Server Configuration

Configure Parse Server with the necessary cloud functions:

```typescript
import { parseAuthLogout, LOGOUT_FUNCTION_NAME } from "@parseauthkit/parse";

Parse.Cloud.define(LOGOUT_FUNCTION_NAME, parseAuthLogout, {
  requireUser: true,
});
```

### Next.js Configuration

Create an API route for authentication at `app/api/auth/[...parseauthkit]/route.ts`:

```typescript
import { createAuth } from "@parseauthkit/next";

const auth = createAuth();
export const GET = auth.handlers.GET;
export const POST = auth.handlers.POST;
```

## Parse Server Setup

The Parse Server setup involves configuring authentication adapters and cloud functions. Each adapter requires specific configuration as detailed in their respective sections below.

## Next.js Integration

### Session Provider Setup

Wrap your application with the SessionProvider:

```typescript
// app/layout.tsx
import { SessionProvider } from "@parseauthkit/next/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

## Basic Usage

### Credentials Login

```typescript
import { useAuth } from "@parseauthkit/next/client";

function LoginComponent() {
  const { login } = useAuth();

  const handleLogin = async () => {
    const response = await login("credentials", {
      email: "user@example.com",
      password: "password",
    });

    if (response.success) {
      // Handle successful login
    }
  };
}
```

### Middleware

Protect routes using the auth middleware:

```typescript
// middleware.ts
import { authMiddleware } from "@parseauthkit/next/middleware";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|signup|terms-of-service|privacy|api/auth|$).*)",
  ],
};

export { authMiddleware as middleware };
```

### Session Management

#### Server-side Session

```typescript
import { auth } from "@parseauthkit/next";

export default async function ProtectedPage() {
  const session = await auth();
  if (!session.userId) {
    return unauthorized();
  }
  return <div>Protected Content</div>;
}
```

#### Client-side Session

```typescript
import { useSession } from "@parseauthkit/next/client";

function ProfileComponent() {
  const { data, status } = useSession();

  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <div>Please sign in</div>;

  return <div>Welcome {data?.userId}</div>;
}
```

## Authentication Adapters

For detailed documentation on each adapter, please refer to their respective documentation files:

- [OTP Documentation](./packages/auth-adapters/src/otp/doc.md)
- [SIWE Documentation](./packages/auth-adapters/src/siwe/doc.md)
- [X (Twitter) Documentation](./packages/auth-adapters/src/x/doc.md)

### OTP (One-Time Password)

#### Parse Server Setup

```typescript
import { initializeOtpAdapter } from "@parseauthkit/auth-adapters";

const otpOptions = {
  otpValidityInMs: 300000, // 5 minutes
  maxAttempts: 3,
  sendEmail: async (email, otp) => {
    // Implement your email sending logic
  },
};

const otpAdapter = initializeOtpAdapter(otpOptions);

const api = new ParseServer({
  auth: {
    otp: otpAdapter,
  },
});
```

#### Next.js Usage

```typescript
const { challenge, login } = useAuth();

// Request OTP
const result = await challenge({ otp: { email: "user@example.com" } });

// Login with OTP
const result = await login("third-party", {
  providerName: "otp",
  authData: {
    email: "user@example.com",
    otp: "123456",
    id: "user@example.com",
  },
});
```

### SIWE (Sign-In with Ethereum)

#### Parse Server Setup

```typescript
import { initializeSiweAdapter } from "@parseauthkit/auth-adapters";

const siweOptions = {
  domain: "example.com",
  statement: "Sign in with Ethereum to the app.",
  version: "1",
  preventReplay: true,
  messageValidityInMs: 60000,
};

const siweAdapter = initializeSiweAdapter(siweOptions);

const api = new ParseServer({
  auth: {
    siwe: siweAdapter,
  },
});
```

#### Next.js Usage

```typescript
const { challenge, login } = useAuth();

// Get SIWE message
const result = await challenge({
  siwe: {
    address: "0x...",
    uri: window.location.origin,
    chainId: 1,
  },
});

// Sign message and login
const signedMessage = await signMessageAsync({
  message: result.challengeData.siwe.message,
});

await login("third-party", {
  providerName: "siwe",
  authData: {
    id: address,
    message: result.challengeData.siwe.message,
    signature: signedMessage,
    nonce: result.challengeData.siwe.nonce,
    address,
  },
});
```

### X (Twitter)

#### Parse Server Setup

```typescript
import { initializeXAdapter } from "@parseauthkit/auth-adapters";

const xAdapter = initializeXAdapter();

const api = new ParseServer({
  auth: {
    x: xAdapter,
  },
});
```

#### Next.js Usage

```typescript
const { getOAuthUrl } = useAuth();

// Redirect to X OAuth
window.location.href = getOAuthUrl("x");
```

## OAuth Integration

For detailed documentation on OAuth integration, please refer to the [Next.js Documentation](./packages/next/doc.md).

### Standard OAuth (GitHub Example)

Configure OAuth providers in your Next.js application:

```typescript
const oAuthProviders = {
  github: {
    authorizeUrl: `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=${process.env.GITHUB_SCOPE}`,
    callBackFunction: async (providerName, data) => {
      return {
        providerName,
        authData: {
          code: data.code,
        },
      };
    },
  },
};

const auth = createAuth({
  oAuthProviders,
});
```

### OAuth with PKCE (X/Twitter Example)

X/Twitter uses OAuth 2.0 with PKCE for enhanced security:

```typescript
cimport { createAuth, ThirdPartyAuth } from "@parseauthkit/next-auth";
import { Buffer } from "buffer";

// Helper Function: Exchange Code for Token
async function exchangeXCodeForToken(
  code: string,
  pkceVerifier: string,
  clientId: string,
  clientSecret: string | undefined,
  redirectUri: string
): Promise<any> {
  const tokenUrl = "https://api.x.com/2/oauth2/token";
  const tokenParams = new URLSearchParams();
  tokenParams.append("code", code);
  tokenParams.append("grant_type", "authorization_code");
  tokenParams.append("client_id", clientId);
  tokenParams.append("redirect_uri", redirectUri);
  tokenParams.append("code_verifier", pkceVerifier);

  const tokenHeaders: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    tokenHeaders["Authorization"] = `Basic ${basicAuth}`;
  }

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(
        `Failed to exchange X code for token. Status: ${tokenResponse.status}. Body: ${errorBody.substring(0, 200)}`
      );
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error("Access token missing in X API response.");
    }
    return tokenData;
  } catch (error: any) {
    throw new Error(`X token exchange failed: ${error.message}`);
  }
}

// OAuth Provider Configuration
const oAuthProviders = {
  x: {
    authorizeUrl: `https://x.com/i/oauth2/authorize?response_type=code&client_id=${process.env.X_CLIENT_ID}&redirect_uri=${process.env.X_REDIRECT_URI}&scope=${encodeURIComponent(process.env.X_SCOPE || "")}`,
    callBackFunction: async (
      providerName: string,
      data: { code: string; codeVerifier?: string }
    ): Promise<ThirdPartyAuth> => {
      const { code, codeVerifier } = data;

      if (!codeVerifier) {
        throw new Error("PKCE Verifier is missing in X callback function.");
      }
      if (!code) {
        throw new Error("Authorization code is missing in X callback function.");
      }

      try {
        // Step 1: Exchange code for token
        const tokenData = await exchangeXCodeForToken(
          code,
          codeVerifier,
          process.env.X_CLIENT_ID!,
          process.env.X_CLIENT_SECRET,
          process.env.X_REDIRECT_URI!
        );

        // Step 2: Get user info using the adapter's fetchUserData function
        const xUserData = await fetchUserData(tokenData.access_token);

        // Step 3: Build final result
        const result: ThirdPartyAuth = {
          providerName,
          authData: {
            // Required for Parse Adapter
            id: xUserData.id,
            access_token: tokenData.access_token,

            // Optional useful data
            refresh_token: tokenData.refresh_token,
            scope: tokenData.scope,
            expires_in: tokenData.expires_in,
            username: xUserData.username,
            name: xUserData.name,
            email: xUserData.confirmed_email,
            profile_image_url: xUserData.profile_image_url,
            verified: xUserData.verified,
          },
        };
        return result;
      } catch (error: any) {
        throw error;
      }
    },
    pkce: true,
  },
};

const auth = createAuth({
  oAuthProviders,
});
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues to discuss new features or improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
