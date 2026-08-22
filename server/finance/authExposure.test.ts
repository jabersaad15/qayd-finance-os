import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("auth.me exposure boundary", () => {
  it("projects the authenticated user through a safe public projection", () => {
    expect(source).toContain("const publicUser");
    expect(source).toContain("me: publicProcedure.query(opts => publicUser(opts.ctx.user))");
    expect(source).not.toContain("me: publicProcedure.query(opts => opts.ctx.user)");
  });

  it("does not include credential or MFA secret fields in the public projection", () => {
    const projection = source.slice(source.indexOf("const publicUser"), source.indexOf("export const appRouter"));
    expect(projection).not.toContain("passwordHash");
    expect(projection).not.toContain("mfaSecretEncrypted");
  });
});
