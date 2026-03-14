import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

// Mock the LLM module to control AI responses
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock storage to avoid real S3 uploads
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://fake-s3.com/test.jpg", key: "test.jpg" }),
}));

import { invokeLLM } from "./_core/llm";
const mockInvokeLLM = vi.mocked(invokeLLM);

describe("photo.analyze - single entry enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single meal entry when AI responds correctly", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              name: "Sliced beef steak with sauce and salad",
              calories: 520,
              protein: 45,
              quantity: 1,
              servingType: "serving",
              description: "A plate of sliced medium-rare beef steak with demi-glace sauce and radicchio salad.",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(800);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
      userDescription: "beef steak with sauce and salad",
    });

    // Must be a single object, not an array
    expect(result).toBeDefined();
    expect(typeof result.name).toBe("string");
    expect(typeof result.calories).toBe("number");
    expect(typeof result.protein).toBe("number");
    expect(result.name).toBe("Sliced beef steak with sauce and salad");
    expect(result.calories).toBe(520);
    expect(result.protein).toBe(45);
    expect(result.quantity).toBe(1);
    expect(result.servingType).toBe("serving");
  });

  it("merges multiple items if AI returns an array (safeguard)", async () => {
    // Simulate AI ignoring instructions and returning an array
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify([
              { name: "Beef Steak", calories: 300, protein: 35, quantity: 1, servingType: "serving", description: "Sliced steak" },
              { name: "Demi-glace Sauce", calories: 70, protein: 2, quantity: 1, servingType: "serving", description: "Rich sauce" },
              { name: "Radicchio Salad", calories: 40, protein: 2, quantity: 1, servingType: "serving", description: "Side salad" },
            ]),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(801);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
    });

    // Should be merged into a single entry
    expect(result).toBeDefined();
    expect(typeof result.name).toBe("string");
    expect(result.calories).toBe(410); // 300 + 70 + 40
    expect(result.protein).toBe(39); // 35 + 2 + 2
    expect(result.quantity).toBe(1);
    expect(result.servingType).toBe("serving");
    // Name should contain all items joined
    expect(result.name).toContain("Beef Steak");
    expect(result.name).toContain("Demi-glace Sauce");
    expect(result.name).toContain("Radicchio Salad");
  });

  it("merges items if AI wraps them in an 'items' array (safeguard)", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              items: [
                { name: "Birria Tacos", calories: 450, protein: 30 },
                { name: "Consomme", calories: 80, protein: 5 },
                { name: "Lime Wedges", calories: 5, protein: 0 },
              ],
              description: "Birria tacos with consomme and lime",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(802);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
      userDescription: "birria tacos",
    });

    // Should be merged into a single entry
    expect(result).toBeDefined();
    expect(result.calories).toBe(535); // 450 + 80 + 5
    expect(result.protein).toBe(35); // 30 + 5 + 0
    expect(result.quantity).toBe(1);
    expect(result.servingType).toBe("serving");
    expect(result.name).toContain("Birria Tacos");
  });

  it("always returns quantity=1 and servingType='serving'", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              name: "Chicken rice bowl",
              calories: 650,
              protein: 42,
              quantity: 2,
              servingType: "bowls",
              description: "A large chicken rice bowl",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(803);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
    });

    // Quantity and servingType should be forced to 1 and "serving"
    expect(result.quantity).toBe(1);
    expect(result.servingType).toBe("serving");
  });

  it("throws error when AI returns no content", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(804);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.photo.analyze({ imageUrl: "https://fake-s3.com/test.jpg" })
    ).rejects.toThrow();
  });

  it("passes user description to the AI prompt", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              name: "Croissant sandwich with egg and ham",
              calories: 420,
              protein: 22,
              quantity: 1,
              servingType: "serving",
              description: "A croissant sandwich filled with egg and ham",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(805);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
      userDescription: "croissant sandwich with egg and ham",
    });

    expect(result.name).toBe("Croissant sandwich with egg and ham");

    // Verify the LLM was called with the user description in the prompt
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    const callArgs = mockInvokeLLM.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content as string;
    expect(systemMsg).toContain("croissant sandwich with egg and ham");
    const userMsg = callArgs.messages[1].content;
    expect(Array.isArray(userMsg)).toBe(true);
    if (Array.isArray(userMsg)) {
      const textPart = userMsg.find((p: any) => p.type === "text") as any;
      expect(textPart.text).toContain("croissant sandwich with egg and ham");
    }
  });

  it("handles numeric string values in AI response gracefully", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              name: "Pasta carbonara",
              calories: "650",
              protein: "28",
              quantity: 1,
              servingType: "serving",
              description: "Creamy pasta carbonara",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(806);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
    });

    // Should convert string numbers to actual numbers
    expect(typeof result.calories).toBe("number");
    expect(typeof result.protein).toBe("number");
    expect(result.calories).toBe(650);
    expect(result.protein).toBe(28);
  });

  it("returns exactly one result object (not an array) to the frontend", async () => {
    mockInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              name: "Salmon sashimi platter",
              calories: 380,
              protein: 40,
              quantity: 1,
              servingType: "serving",
              description: "Fresh salmon sashimi with wasabi and soy sauce",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const { ctx } = createAuthContext(807);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photo.analyze({
      imageUrl: "https://fake-s3.com/test.jpg",
    });

    // Result must NOT be an array
    expect(Array.isArray(result)).toBe(false);
    // Result must have exactly these keys
    expect(Object.keys(result).sort()).toEqual(
      ["calories", "description", "name", "protein", "quantity", "servingType"].sort()
    );
  });
});
