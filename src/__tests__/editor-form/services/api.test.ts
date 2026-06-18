// SOURCE: apps/visual-editor/src/editor-form/services/api.ts
//
// EditorAPI is the HTTP boundary. We exercise the SUT for real — real `ky`
// instances (so the beforeRequest auth-header hook and afterResponse 401
// no-op actually run) and the real envelope-unwrapping / error / fallback
// logic. The ONLY thing stubbed is the network edge: globalThis.fetch (ky
// calls it under the hood; the direct OpenAI/Anthropic methods call it
// directly). import.meta.env reads are driven with vi.stubEnv, and the
// dev-only previewOrigin override is exercised through jsdom's location.
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { EditorAPI, api } from "../../../editor-form/services/api";
import { useAuthStore } from "../../../stores/authStore";

// JSON Response factory — ky's .json() and the direct fetch callers both
// just call response.json(), so a real Response with a JSON body is enough.
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Clean auth state between tests (token drives the beforeRequest hook;
  // previewOrigin drives storefrontKy()).
  useAuthStore.getState().clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// The Request object ky handed to fetch on its Nth call — lets us assert URL,
// method, and (hook-injected) headers.
function lastRequest(): Request {
  return fetchMock.mock.calls.at(-1)![0] as Request;
}

describe("EditorAPI.getThemeStructure", () => {
  it("unwraps data.theme from the envelope", async () => {
    const theme = {
      id: "t1",
      name: "Theme One",
      templateStructure: [{ name: "Pages", templates: [{ id: "home" }] }],
    };
    fetchMock.mockResolvedValue(jsonResponse({ data: { theme } }));

    const result = await EditorAPI.getThemeStructure("t1");

    expect(result).toEqual(theme);
    // URL built off the default editorBe prefix + the theme path.
    expect(lastRequest().url).toContain("/api/v1/themes/t1");
  });

  it("throws when data.theme is missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: {} }));
    await expect(EditorAPI.getThemeStructure("t1")).rejects.toThrow(
      /missing data\.theme/,
    );
  });

  it("attaches a Bearer token from authStore via the beforeRequest hook", async () => {
    useAuthStore
      .getState()
      .setSession({
        token: "secret-token",
        merchant: { id: "m", themeId: "t1", previewOrigin: "https://x.test" },
      });
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { theme: { id: "t1", name: "n", templateStructure: [] } } }),
    );

    await EditorAPI.getThemeStructure("t1");

    expect(lastRequest().headers.get("Authorization")).toBe(
      "Bearer secret-token",
    );
  });

  it("sends no Authorization header when there is no token", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { theme: { id: "t1", name: "n", templateStructure: [] } } }),
    );
    await EditorAPI.getThemeStructure("t1");
    expect(lastRequest().headers.get("Authorization")).toBeNull();
  });
});

describe("EditorAPI.getTemplate", () => {
  it("returns data.template.pageConfig", async () => {
    const pageConfig = { sections: [{ id: "s1" }] };
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { template: { pageConfig } } }),
    );

    const result = await EditorAPI.getTemplate("t1", "home");

    expect(result).toEqual(pageConfig);
    expect(lastRequest().url).toContain("/api/v1/themes/t1/templates/home");
  });

  it("throws when pageConfig is absent", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { template: {} } }));
    await expect(EditorAPI.getTemplate("t1", "home")).rejects.toThrow(
      /missing data\.template\.pageConfig/,
    );
  });
});

describe("EditorAPI.getTranslation", () => {
  it("returns data.translations when present", async () => {
    const translations = { hero_title: "Hi" };
    fetchMock.mockResolvedValue(jsonResponse({ data: { translations } }));

    const result = await EditorAPI.getTranslation("t1", "home", "en");

    expect(result).toEqual(translations);
    expect(lastRequest().url).toContain(
      "/api/v1/themes/t1/translations/home/en",
    );
  });

  it("defaults to {} when the envelope omits translations", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: {} }));
    await expect(EditorAPI.getTranslation("t1", "home", "en")).resolves.toEqual(
      {},
    );
  });

  it("swallows fetch errors and resolves to {} (best-effort)", async () => {
    // Non-2xx → ky throws HTTPError; getTranslation catches and returns {}.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse({ message: "nope" }, 500));

    await expect(
      EditorAPI.getTranslation("t1", "missing", "fr"),
    ).resolves.toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("EditorAPI.saveTemplate", () => {
  const templateData = {
    metadata: {
      id: "home",
      name: "Home",
      brand: "t1",
      type: "page",
      version: "1.0.0",
    },
    sections: [],
    dataSources: {},
  };

  it("PUTs the template body and returns the result with message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { templateId: "home", version: "2", savedAt: "2026-01-01" },
        message: "saved!",
      }),
    );

    const result = await EditorAPI.saveTemplate("t1", "home", templateData);

    expect(result).toEqual({
      templateId: "home",
      version: "2",
      savedAt: "2026-01-01",
      message: "saved!",
    });
    const req = lastRequest();
    expect(req.method).toBe("PUT");
    expect(req.url).toContain("/api/v1/themes/t1/templates/home");
  });

  it("throws when the save response has no data", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "oops" }));
    await expect(
      EditorAPI.saveTemplate("t1", "home", templateData),
    ).rejects.toThrow(/missing data/);
  });
});

describe("EditorAPI.saveTranslation", () => {
  it("returns the server result when present", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { language: "en", templateId: "home", savedAt: "2026-01-02" },
      }),
    );

    const result = await EditorAPI.saveTranslation("t1", "home", "en", {
      a: 1,
    });

    expect(result).toEqual({
      language: "en",
      templateId: "home",
      savedAt: "2026-01-02",
    });
    expect(lastRequest().url).toContain(
      "/api/v1/themes/t1/translations/home/en",
    );
  });

  it("falls back to a synthesized result when data is absent", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const result = await EditorAPI.saveTranslation("t1", "home", "fr", {});
    expect(result.language).toBe("fr");
    expect(result.templateId).toBe("home");
    expect(typeof result.savedAt).toBe("string");
  });
});

describe("EditorAPI.authenticate", () => {
  function merchantResponse(url: string) {
    return jsonResponse({
      data: { merchantId: "m1", merchantName: "momsco", url },
    });
  }

  it("maps the merchant response and sends the explicit Bearer header", async () => {
    fetchMock.mockResolvedValue(merchantResponse("https://shop.example.com"));

    const result = await EditorAPI.authenticate({ mid: "m1", token: "tok" });

    expect(result.token).toBe("tok");
    expect(result.merchant).toEqual({
      id: "m1",
      themeId: "momsco",
      previewOrigin: "https://shop.example.com",
    });
    const req = lastRequest();
    expect(req.url).toContain("/api/v1/merchants/m1");
    expect(req.headers.get("Authorization")).toBe("Bearer tok");
  });

  it("throws when required merchant fields are missing", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { merchantId: "m1", merchantName: "momsco" } }),
    );
    await expect(
      EditorAPI.authenticate({ mid: "m1", token: "tok" }),
    ).rejects.toThrow(/missing required fields/);
  });

  it("normalizes a trailing slash off the deployed previewOrigin", async () => {
    fetchMock.mockResolvedValue(merchantResponse("https://shop.example.com/"));
    const result = await EditorAPI.authenticate({ mid: "m1", token: "tok" });
    expect(result.merchant.previewOrigin).toBe("https://shop.example.com");
  });

  it("honors a localhost ?previewOrigin override when the dev gate is on", async () => {
    vi.stubEnv("VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE", "true");
    window.history.replaceState(
      null,
      "",
      "/?previewOrigin=http://localhost:5173/",
    );
    fetchMock.mockResolvedValue(merchantResponse("https://shop.example.com"));

    const result = await EditorAPI.authenticate({ mid: "m1", token: "tok" });

    // Override wins, normalized to a bare origin.
    expect(result.merchant.previewOrigin).toBe("http://localhost:5173");
  });

  it("ignores the override when the dev gate is off", async () => {
    vi.stubEnv("VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE", "");
    window.history.replaceState(
      null,
      "",
      "/?previewOrigin=http://localhost:5173",
    );
    fetchMock.mockResolvedValue(merchantResponse("https://shop.example.com"));

    const result = await EditorAPI.authenticate({ mid: "m1", token: "tok" });
    expect(result.merchant.previewOrigin).toBe("https://shop.example.com");
  });

  it("ignores a non-localhost override even with the gate on", async () => {
    vi.stubEnv("VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE", "true");
    window.history.replaceState(null, "", "/?previewOrigin=https://evil.test");
    fetchMock.mockResolvedValue(merchantResponse("https://shop.example.com"));

    const result = await EditorAPI.authenticate({ mid: "m1", token: "tok" });
    expect(result.merchant.previewOrigin).toBe("https://shop.example.com");
  });
});

describe("EditorAPI.getDataSourceOptions", () => {
  it("POSTs to the storefront origin and returns data", async () => {
    useAuthStore.getState().setSession({
      token: "tok",
      merchant: {
        id: "m",
        themeId: "t1",
        previewOrigin: "https://store.test",
      },
    });
    const options = [{ value: "c1", label: "Collection 1" }];
    fetchMock.mockResolvedValue(jsonResponse({ data: options }));

    const result = await EditorAPI.getDataSourceOptions("collections");

    expect(result).toEqual(options);
    const req = lastRequest();
    expect(req.method).toBe("POST");
    expect(req.url).toContain("store.test/editor/api/data-source-options");
  });

  it("returns [] when the merchant is not authenticated (no previewOrigin)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    // storefrontKy() throws before any fetch; getDataSourceOptions catches it.
    await expect(EditorAPI.getDataSourceOptions("products")).resolves.toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("returns [] on a network/HTTP error", async () => {
    useAuthStore.getState().setSession({
      token: "tok",
      merchant: { id: "m", themeId: "t1", previewOrigin: "https://store.test" },
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse({ message: "bad" }, 500));

    await expect(EditorAPI.getDataSourceOptions("products")).resolves.toEqual(
      [],
    );
    err.mockRestore();
  });
});

describe("EditorAPI.transcribeAudio", () => {
  const blob = new Blob(["audio"], { type: "audio/webm" });

  it("throws when VITE_OPENAI_API_KEY is not configured", async () => {
    vi.stubEnv("VITE_OPENAI_API_KEY", "");
    await expect(EditorAPI.transcribeAudio(blob)).rejects.toThrow(
      /VITE_OPENAI_API_KEY is not configured/,
    );
  });

  it("posts to OpenAI Whisper and returns the transcript text", async () => {
    vi.stubEnv("VITE_OPENAI_API_KEY", "sk-test");
    fetchMock.mockResolvedValue(jsonResponse({ text: "hello world" }));

    const text = await EditorAPI.transcribeAudio(blob);

    expect(text).toBe("hello world");
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      "Bearer sk-test",
    );
  });

  it("returns '' when the response has no text field", async () => {
    vi.stubEnv("VITE_OPENAI_API_KEY", "sk-test");
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(EditorAPI.transcribeAudio(blob)).resolves.toBe("");
  });

  it("throws with status when OpenAI responds non-ok", async () => {
    vi.stubEnv("VITE_OPENAI_API_KEY", "sk-test");
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(EditorAPI.transcribeAudio(blob)).rejects.toThrow(
      /OpenAI Whisper error 429/,
    );
  });
});

describe("EditorAPI.anthropicMessages", () => {
  const body = { model: "claude", messages: [] };

  it("throws when VITE_ANTHROPIC_API_KEY is not configured", async () => {
    vi.stubEnv("VITE_ANTHROPIC_API_KEY", "");
    await expect(EditorAPI.anthropicMessages(body)).rejects.toThrow(
      /VITE_ANTHROPIC_API_KEY is not configured/,
    );
  });

  it("posts to Anthropic with the required headers and returns the JSON", async () => {
    vi.stubEnv("VITE_ANTHROPIC_API_KEY", "ak-test");
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ text: "{}" }] }));

    const result = await EditorAPI.anthropicMessages(body);

    expect(result).toEqual({ content: [{ text: "{}" }] });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-api-key"]).toBe("ak-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    // Body is JSON-stringified verbatim.
    expect((init as RequestInit).body).toBe(JSON.stringify(body));
  });

  it("throws with status when Anthropic responds non-ok", async () => {
    vi.stubEnv("VITE_ANTHROPIC_API_KEY", "ak-test");
    fetchMock.mockResolvedValue(new Response("overloaded", { status: 529 }));
    await expect(EditorAPI.anthropicMessages(body)).rejects.toThrow(
      /Anthropic API error 529/,
    );
  });
});

describe("api facade", () => {
  it("re-exports EditorAPI under api.editor", () => {
    expect(api.editor).toBe(EditorAPI);
  });
});
