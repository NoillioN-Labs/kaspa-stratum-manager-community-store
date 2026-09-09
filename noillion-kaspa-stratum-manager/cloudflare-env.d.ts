// Types for the retained optional cloud preview; Umbrel does not use D1.
declare module "cloudflare:workers" {
  export const env: {
    DB?: Parameters<typeof import("drizzle-orm/d1").drizzle>[0];
  };
}

