import { createSign } from "crypto";
import {
  IPushNotificationService,
  PushNotificationPayload,
} from "@/domain/services/IPushNotificationService";
import { IUserDeviceRepository } from "@/domain/repositories/IUserDeviceRepository";
import { logger } from "@/infrastructure/logging/logger";

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Real Firebase Cloud Messaging (HTTP v1 API) integration, built on the
 * platform's built-in `fetch` and `crypto` -- the same "no SDK needed for
 * one REST call" call made in GoogleGeocodingService. `firebase-admin`
 * couldn't be added here regardless (no npm registry access in this
 * sandbox -- see docs/phase-5.md), so this hand-rolls exactly the piece
 * of it actually needed: the service-account JWT-bearer OAuth2 exchange,
 * then a POST to the FCM send endpoint.
 *
 * container.ts only binds this implementation when FIREBASE_PROJECT_ID
 * etc. are actually configured; otherwise it falls back to
 * ConsolePushNotificationService, so this integration is never exercised
 * against a real network call in this sandbox (there is no real Firebase
 * project to test against here) -- see docs/phase-5.md's Provider Setup
 * section for what an operator needs to supply to activate it.
 */
export class FcmPushNotificationService implements IPushNotificationService {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: FcmConfig,
    private readonly userDeviceRepo: IUserDeviceRepository,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({
        iss: this.config.clientEmail,
        scope: FCM_SCOPE,
        aud: TOKEN_URL,
        iat: nowSeconds,
        exp: nowSeconds + 3600,
      }),
    );
    const unsigned = `${header}.${payload}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(this.config.privateKey);
    const assertion = `${unsigned}.${base64url(signature)}`;

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: GRANT_TYPE, assertion }).toString(),
    });

    if (!response.ok) {
      throw new Error(`FCM OAuth2 token exchange failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  async send(payload: PushNotificationPayload): Promise<void> {
    const tokens = await this.userDeviceRepo.listPushTokensForUsers([payload.userId]);
    if (tokens.length === 0) return;

    const accessToken = await this.getAccessToken();

    await Promise.all(
      tokens.map(async ({ pushToken }) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: pushToken,
                notification: { title: payload.title, body: payload.body },
                data: stringifyData(payload.data),
              },
            }),
          },
        );

        if (!response.ok) {
          const body = await response.text();
          logger.warn({ status: response.status, body }, "FCM send failed for a device token");
        }
      }),
    );
  }

  async sendBulk(payloads: PushNotificationPayload[]): Promise<void> {
    for (const payload of payloads) {
      await this.send(payload);
    }
  }
}

/** FCM's `data` payload must be a flat Record<string, string>. */
function stringifyData(data?: Record<string, unknown>): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}
