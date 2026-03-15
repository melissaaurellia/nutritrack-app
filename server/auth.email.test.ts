import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ── Mocks ──────────────────────────────────────────────────────

// Mock getUserByEmail and createEmailUser
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getUserByEmail: vi.fn(),
    createEmailUser: vi.fn(),
  };
});

// Mock sdk.createSessionToken
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  },
}));

import { getUserByEmail, createEmailUser } from "./db";
import bcrypt from "bcryptjs";

const mockedGetUserByEmail = vi.mocked(getUserByEmail);
const mockedCreateEmailUser = vi.mocked(createEmailUser);

// ── Helpers ────────────────────────────────────────────────────

type CookieSetCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): {
  ctx: TrpcContext;
  setCookies: CookieSetCall[];
} {
  const setCookies: CookieSetCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

// ── Tests ──────────────────────────────────────────────────────

describe("auth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user and sets session cookie", async () => {
    mockedGetUserByEmail.mockResolvedValue(undefined);
    mockedCreateEmailUser.mockResolvedValue({
      id: 42,
      openId: "email_abc123",
      name: "Test User",
      email: "test@example.com",
      passwordHash: "hashed",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.register({
      name: "Test User",
      email: "test@example.com",
      password: "securepass123",
    });

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 42,
      name: "Test User",
      email: "test@example.com",
    });

    // Verify cookie was set
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBe("mock-session-token");
    expect(setCookies[0]?.options).toMatchObject({
      maxAge: ONE_YEAR_MS,
      secure: true,
      httpOnly: true,
      path: "/",
    });
  });

  it("rejects registration when email already exists", async () => {
    mockedGetUserByEmail.mockResolvedValue({
      id: 1,
      openId: "existing",
      name: "Existing",
      email: "test@example.com",
      passwordHash: "hash",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Test User",
        email: "test@example.com",
        password: "securepass123",
      })
    ).rejects.toThrow("An account with this email already exists");
  });

  it("normalizes email to lowercase", async () => {
    mockedGetUserByEmail.mockResolvedValue(undefined);
    mockedCreateEmailUser.mockResolvedValue({
      id: 43,
      openId: "email_xyz",
      name: "Test",
      email: "test@example.com",
      passwordHash: "hashed",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.auth.register({
      name: "Test",
      email: "TEST@EXAMPLE.COM",
      password: "securepass123",
    });

    expect(mockedGetUserByEmail).toHaveBeenCalledWith("test@example.com");
    expect(mockedCreateEmailUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" })
    );
  });

  it("rejects password shorter than 6 characters", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Test",
        email: "test@example.com",
        password: "short",
      })
    ).rejects.toThrow(); // zod validation error
  });
});

describe("auth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in with correct credentials and sets cookie", async () => {
    const hashedPassword = await bcrypt.hash("correctpassword", 12);
    mockedGetUserByEmail.mockResolvedValue({
      id: 10,
      openId: "email_user10",
      name: "Login User",
      email: "login@example.com",
      passwordHash: hashedPassword,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      email: "login@example.com",
      password: "correctpassword",
    });

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 10,
      name: "Login User",
      email: "login@example.com",
    });

    // Verify cookie was set
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBe("mock-session-token");
  });

  it("rejects login with wrong password", async () => {
    const hashedPassword = await bcrypt.hash("correctpassword", 12);
    mockedGetUserByEmail.mockResolvedValue({
      id: 10,
      openId: "email_user10",
      name: "Login User",
      email: "login@example.com",
      passwordHash: hashedPassword,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "login@example.com",
        password: "wrongpassword",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects login for non-existent user", async () => {
    mockedGetUserByEmail.mockResolvedValue(undefined);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "nonexistent@example.com",
        password: "anypassword",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects login for user without password (OAuth-only user)", async () => {
    mockedGetUserByEmail.mockResolvedValue({
      id: 5,
      openId: "oauth_user",
      name: "OAuth User",
      email: "oauth@example.com",
      passwordHash: null,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "oauth@example.com",
        password: "anypassword",
      })
    ).rejects.toThrow("Invalid email or password");
  });
});
