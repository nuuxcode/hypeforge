import { z } from "zod";

// Zod 4's JIT optimizer probes the Function constructor when schemas are
// built. The strict production CSP blocks that probe, which is harmless (Zod
// falls back) but logs a console CSP error in Firefox. jitless skips the
// probe. This module must be imported before any schema is defined, so every
// zod consumer imports it first.
z.config({ jitless: true });
