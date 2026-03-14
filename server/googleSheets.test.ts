import { describe, expect, it } from "vitest";
import { getServiceAccountEmail } from "./googleSheets";

describe("Google Sheets - Service Account", () => {
  it("should parse service account email from GOOGLE_SERVICE_ACCOUNT_KEY env", () => {
    const email = getServiceAccountEmail();
    // If the env var is set, it should return a valid email
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      expect(email).toBeTruthy();
      expect(email).toContain("@");
      expect(email).toContain(".iam.gserviceaccount.com");
    } else {
      // If not set, should return null
      expect(email).toBeNull();
    }
  });

  it("should have GOOGLE_SERVICE_ACCOUNT_KEY configured", () => {
    expect(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).toBeTruthy();
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
    expect(parsed).toHaveProperty("client_email");
    expect(parsed).toHaveProperty("private_key");
    expect(parsed).toHaveProperty("project_id");
    expect(parsed.client_email).toContain("@");
  });
});
