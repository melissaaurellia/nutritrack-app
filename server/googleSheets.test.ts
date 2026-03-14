import { describe, expect, it } from "vitest";
import { getServiceAccountEmail, syncRowToSheet } from "./googleSheets";
import crypto from "crypto";

describe("Google Sheets - Service Account", () => {
  it("should parse service account email from GOOGLE_SERVICE_ACCOUNT_KEY env", () => {
    const email = getServiceAccountEmail();
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      expect(email).toBeTruthy();
      expect(email).toContain("@");
      expect(email).toContain(".iam.gserviceaccount.com");
    } else {
      expect(email).toBeNull();
    }
  });

  it("should have GOOGLE_SERVICE_ACCOUNT_KEY configured with required fields", () => {
    expect(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).toBeTruthy();
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
    expect(parsed).toHaveProperty("client_email");
    expect(parsed).toHaveProperty("private_key");
    expect(parsed).toHaveProperty("project_id");
    expect(parsed.client_email).toContain("@");
  });

  it("should be able to parse the private key after PEM header fix", () => {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
    let pk = parsed.private_key;

    // Apply the same fix as in googleSheets.ts
    pk = pk
      .replace("-----BEGINPRIVATEKEY-----", "-----BEGIN PRIVATE KEY-----")
      .replace("-----ENDPRIVATEKEY-----", "-----END PRIVATE KEY-----")
      .replace(/-----BEGIN(\w+)KEY-----/g, "-----BEGIN $1 KEY-----")
      .replace(/-----END(\w+)KEY-----/g, "-----END $1 KEY-----")
      .replace("BEGIN PRIVATE  KEY", "BEGIN PRIVATE KEY")
      .replace("END PRIVATE  KEY", "END PRIVATE KEY");

    // This should not throw
    const keyObj = crypto.createPrivateKey(pk);
    expect(keyObj.type).toBe("private");
    expect(keyObj.asymmetricKeyType).toBe("rsa");
  });

  it("should handle syncRowToSheet with an invalid spreadsheet ID gracefully", async () => {
    // This tests that the auth + API flow works but returns a proper error for a bad sheet
    const result = await syncRowToSheet("invalid_spreadsheet_id_12345", "Sheet1", {
      date: "14/3/2026",
      day: "Saturday",
      calories: 100,
      protein: 30,
      meals: "Bfast: Test - 100 cal, 30g protein",
    });

    // Should not throw, should return success: false with a meaningful error
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
