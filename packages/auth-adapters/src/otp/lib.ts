// Note: do not import Parse dependency. see https://github.com/parse-community/parse-server/issues/6467
/* global Parse */
import type { OtpOptions, OtpAdapterOptions } from "./types";
import { OtpAdapter } from "./adapter";

export const OTP_TABLE_NAME = "OTP";
export const OTP_TABLE_SCHEMA = {
  className: OTP_TABLE_NAME,
  fields: {
    objectId: { type: "String" },
    createdAt: { type: "Date" },
    updatedAt: { type: "Date" },
    ACL: { type: "ACL" },
    email: { type: "String" },
    otp: { type: "String" },
    expiresAt: { type: "Date" },
    attempts: { type: "Number" },
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
  indexes: { _id_: { _id: 1 } },
};

export function getExpirationTime(otpValidityInMs: number): Date {
  const currentTime = new Date();
  const expirationTime = new Date(currentTime.getTime() + otpValidityInMs);
  return expirationTime;
}

export async function setupOtpTable(): Promise<void> {
  try {
    const schema = new Parse.Schema(OTP_TABLE_NAME);

    try {
      await schema.get();
      console.log(`OTP-AUTH-ADAPTER: Schema for class ${OTP_TABLE_NAME} already exists.`);
    } catch (getSchemaError: any) {
      console.log(
        `OTP-AUTH-ADAPTER: Schema for class ${OTP_TABLE_NAME} not found. Creating...`
      );

      schema.addString("email");
      schema.addString("otp");
      schema.addDate("expiresAt");
      schema.addNumber("attempts");
      schema.addIndex("email_idx", { email: 1 });
      schema.setCLP({});

      await schema.save();
      console.log(
        `OTP-AUTH-ADAPTER: Schema for class ${OTP_TABLE_NAME} created successfully.`
      );
    }
  } catch (err: any) {
    console.error(
      "OTP-AUTH-ADAPTER: Error during schema setup for",
      OTP_TABLE_NAME,
      ":",
      err.message || err
    );
  }
}

export async function updateOtpAuthDataAfterSave(
  request: Parse.Cloud.AfterSaveRequest<Parse.User<Parse.Attributes>>
): Promise<void> {
  const user = request.object;
  const authData = user.toJSON().authData;
  const email = user.getEmail();

  if (email && authData?.otp && authData.otp.id !== email) {
    const oldId = authData.otp.id;
    authData.otp.id = email;
    authData.otp.email = email;
    await user.save({ authData }, { useMasterKey: true });
    console.log(
      `OTP-AUTH-ADAPTER: Updated authData for user ${user.id}. Email changed from ${oldId} to ${email}.`
    );
  }
}

export async function cleanupExpiredOTPs() {
  const query = new Parse.Query(OTP_TABLE_NAME);
  query.lessThan("expiresAt", new Date());

  const expiredOTPs = await query.find({ useMasterKey: true });
  await Parse.Object.destroyAll(expiredOTPs, { useMasterKey: true });

  console.log(`Cleaned up ${expiredOTPs.length} expired OTPs`);
}

export function initializeOtpAdapter(options: OtpOptions): OtpAdapterOptions {
  return {
    module: new OtpAdapter(),
    options,
  };
}
