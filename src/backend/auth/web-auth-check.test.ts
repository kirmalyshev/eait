import { describe, expect, it } from "bun:test";
import { checkWebAuth, checkWebProvider, WEB_AUTH_VARS, type WebAuthConfig } from "./web-auth-check.ts";

const FULL: WebAuthConfig = {
  appleServiceId: "fit.eait.web",
  appleTeamId: "TEAM123456",
  appleKeyId: "KEY1234567",
  applePrivateKey: "-----BEGIN " + "PRIVATE KEY-----\nx\n-----END " + "PRIVATE KEY-----",
  googleWebClientId: "123.apps.googleusercontent.com",
  googleWebClientSecret: "secret",
};
const NONE: WebAuthConfig = {
  appleServiceId: "", appleTeamId: "", appleKeyId: "", applePrivateKey: "",
  googleWebClientId: "", googleWebClientSecret: "",
};

describe("what a web sign-in needs", () => {
  it("says nothing is wrong with a provider nobody configured", () => {
    for (const v of checkWebAuth(NONE, "https://api.eait.fit")) {
      expect(v.state).toBe("off");
      expect(v.missing).toEqual([...WEB_AUTH_VARS[v.provider]]);
    }
  });

  it("names the variables still missing, because half of them renders no button at all", () => {
    const half = { ...FULL, appleKeyId: "", applePrivateKey: "  " };
    const apple = checkWebProvider("apple", half, "https://api.eait.fit");
    expect(apple.state).toBe("incomplete");
    expect(apple.missing).toEqual(["EAIT__BACKEND__APPLE_KEY_ID", "EAIT__BACKEND__APPLE_PRIVATE_KEY"]);
  });

  it("hands back the URL to register, built from the origin the callback is built from", () => {
    const [apple, google] = checkWebAuth(FULL, "https://api.eait.fit/");
    expect(apple!.callbackUrl).toBe("https://api.eait.fit/start/auth/apple/callback");
    expect(google!.callbackUrl).toBe("https://api.eait.fit/start/auth/google/callback");
    expect(apple!.state).toBe("ok");
    expect(google!.state).toBe("ok");
  });

  it("refuses Apple anywhere it cannot resolve, which is every laptop", () => {
    // Apple's Return URL must be https AND a domain it can reach. Both halves, separately.
    for (const origin of ["http://localhost:8787", "http://home-ubuntu:8807", "http://192.168.1.20:8807"]) {
      const apple = checkWebProvider("apple", FULL, origin);
      expect(apple.state).toBe("unusable");
      expect(apple.reason).toContain("https");
    }
    const loopbackHttps = checkWebProvider("apple", FULL, "https://localhost:8787");
    expect(loopbackHttps.state).toBe("unusable");
    expect(loopbackHttps.reason).toContain("resolve");
    // And an https tunnel is exactly what makes it work.
    expect(checkWebProvider("apple", FULL, "https://eait.trycloudflare.com").state).toBe("ok");
  });

  it("takes Google on loopback and nowhere else over http, which is Google's own rule", () => {
    expect(checkWebProvider("google", FULL, "http://localhost:8787").state).toBe("ok");
    expect(checkWebProvider("google", FULL, "http://127.0.0.1:8787").state).toBe("ok");
    // The trap that produced Google's generic error page on a LAN preview.
    const lan = checkWebProvider("google", FULL, "http://home-ubuntu:8807");
    expect(lan.state).toBe("unusable");
    expect(lan.reason).toContain("home-ubuntu");
    expect(lan.reason).toContain("http://localhost:8807");
    expect(checkWebProvider("google", FULL, "https://api.eait.fit").state).toBe("ok");
  });

  it("answers about the variables alone when no origin is known yet", () => {
    // Boot time, where the origin comes from the request rather than from configuration.
    expect(checkWebProvider("apple", FULL).state).toBe("ok");
    expect(checkWebProvider("google", { ...FULL, googleWebClientSecret: "" }).state).toBe("incomplete");
  });

  it("says an origin that is not a URL is unusable rather than throwing", () => {
    expect(checkWebProvider("google", FULL, "api.eait.fit").state).toBe("unusable");
  });
});
