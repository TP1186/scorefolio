/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { drainDocumentJobs } from "../lib/document-processing";
import { createDocumentInspector } from "../lib/document-inspection";
import { createMalwareScanner } from "../lib/malware-scanning";
import { createNativePdfExtractor } from "../lib/pdf-text-extraction";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AUDIT_FILES: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (url.pathname === "/api/uploads" && request.method === "POST" && response.status === 201) {
      const scan = createMalwareScanner({ objectStore: env.AUDIT_FILES });
      ctx.waitUntil(drainDocumentJobs(env.DB, {
        scan,
        inspect: createDocumentInspector({ objectStore: env.AUDIT_FILES }),
        extract: createNativePdfExtractor({ db: env.DB, objectStore: env.AUDIT_FILES }),
      }).catch((error: unknown) => console.error("Document queue processing failed", error)));
    }
    return response;
  },
};

export default worker;
