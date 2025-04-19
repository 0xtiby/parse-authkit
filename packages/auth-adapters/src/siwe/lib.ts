// Note: do not import Parse dependency. see https://github.com/parse-community/parse-server/issues/6467
/* global Parse */
import type { SiweOptions, SiweAdapterOptions } from "./types";
import { SiweAdapter } from "./adapter";

export const NONCE_TABLE_NAME = "Nonce";

export const NONCE_TABLE_SCHEMA = {
  className: NONCE_TABLE_NAME,
  fields: {
    objectId: { type: "String" },
    createdAt: { type: "Date" },
    updatedAt: { type: "Date" },
    ACL: { type: "ACL" },
    nonce: { type: "String" },
    expirationTime: { type: "Date" },
  },
  classLevelPermissions: {
    find: {},
    count: {},
    get: {},
    create: {},
    update: {},
    delete: {},
    addField: {},
    protectedFields: {},
  },
  indexes: { _id_: { _id: 1 }, nonce: { nonce: 1 } },
};

export function getExpirationTime(messageValidityInMs: number): Date {
  const currentTime = new Date();
  const expirationTime = new Date(currentTime.getTime() + messageValidityInMs);
  return expirationTime;
}

export async function setupNonceTable(): Promise<void> {
  try {
    const schema = new Parse.Schema(NONCE_TABLE_NAME);

    try {
      await schema.get();
      console.log(
        `SIWE-AUTH-ADAPTER: Schema for class ${NONCE_TABLE_NAME} already exists.`
      );
    } catch (getSchemaError: any) {
      console.log(
        `SIWE-AUTH-ADAPTER: Schema for class ${NONCE_TABLE_NAME} not found. Creating...`
      );

      schema.addString("nonce");
      schema.addDate("expirationTime");
      schema.addIndex("nonce_idx", { nonce: 1 });
      schema.setCLP({});

      await schema.save();
      console.log(
        `SIWE-AUTH-ADAPTER: Schema for class ${NONCE_TABLE_NAME} created successfully.`
      );
    }
  } catch (err: any) {
    console.error(
      "SIWE-AUTH-ADAPTER: Error during schema setup for",
      NONCE_TABLE_NAME,
      ":",
      err.message || err
    );
  }
}

export function initializeSiweAdapter(options: SiweOptions): SiweAdapterOptions {
  return {
    module: new SiweAdapter(),
    options,
  };
}

export async function cleanupNonceTable(): Promise<string> {
  console.log("SIWE-AUTH-ADAPTER: Starting cleanup of expired nonces...");
  const query = new Parse.Query(NONCE_TABLE_NAME);
  query.lessThan("expirationTime", new Date());

  try {
    const expiredNonces = await query.find({ useMasterKey: true });

    if (!expiredNonces || expiredNonces.length === 0) {
      console.log("SIWE-AUTH-ADAPTER: No expired nonces found to clean.");
      return "No expired nonces found to clean.";
    }

    console.log(
      `SIWE-AUTH-ADAPTER: Found ${expiredNonces.length} expired nonces to destroy.`
    );
    await Parse.Object.destroyAll(expiredNonces, { useMasterKey: true });
    console.log(
      `SIWE-AUTH-ADAPTER: Successfully destroyed ${expiredNonces.length} expired nonces.`
    );
    return `Expired nonces cleaned: ${expiredNonces.length}`;
  } catch (error) {
    console.error("SIWE-AUTH-ADAPTER: Error during nonce cleanup:", error);
    return "Error during nonce cleanup.";
  }
}
