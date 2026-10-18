import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Each collection is one JSON document: small volumes (a few hundred rows),
// one read per page view, optimistic concurrency on write via the ETag.
// Vercel Blob (private) in production, a local .data/ folder in development.

export type Collection<T> = { items: T[]; seq: number };
type Loaded<T> = { doc: Collection<T>; etag: string | null };

// BLOB_STORE_ID: newer Vercel Blob stores authenticate with the deployment OIDC token.
const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(process.cwd(), ".data");
const key = (name: string) => `data/${name}.json`;
const normEtag = (t: string) => t.replace(/^W\//, "").replace(/"/g, "");
const errName = (e: unknown) => (e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "");

async function load<T>(name: string): Promise<Loaded<T>> {
  if (useBlob) {
    const { get, head } = await import("@vercel/blob");
    // Read the ETag from the API (head) too: put's ifMatch is checked against that one.
    // Retry while the CDN copy is older than what head reports, so a stale read never
    // gets written back over newer data.
    for (let attempt = 0; ; attempt++) {
      let etag: string, url: string;
      try {
        ({ etag, url } = await head(key(name)));
      } catch (e: unknown) {
        if (errName(e) === "BlobNotFoundError") return { doc: { items: [], seq: 0 }, etag: null };
        throw e;
      }
      // Keying the URL on the ETag keeps any cache from serving an older copy.
      const res = await get(`${url}?v=${encodeURIComponent(normEtag(etag))}`, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) throw new Error(`Lecture de ${name} impossible (${res?.statusCode ?? 404})`);
      const text = await new Response(res.stream as ReadableStream).text();
      if (normEtag(res.blob.etag) === normEtag(etag)) return { doc: JSON.parse(text), etag };
      if (attempt >= 4) throw new Error(`Version incohérente de ${name} (api ${etag}, cdn ${res.blob.etag})`);
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  try {
    const text = await fs.readFile(path.join(LOCAL_DIR, `${name}.json`), "utf8");
    return { doc: JSON.parse(text), etag: null };
  } catch {
    return { doc: { items: [], seq: 0 }, etag: null };
  }
}

async function save<T>(name: string, doc: Collection<T>, etag: string | null) {
  const body = JSON.stringify(doc);
  if (useBlob) {
    const { put } = await import("@vercel/blob");
    await put(key(name), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : {}),
    });
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${name}.json`), body);
}

export async function readAll<T>(name: string): Promise<T[]> {
  return (await load<T>(name)).doc.items;
}

/** Read-modify-write with retry when another user wrote in between. */
export async function mutate<T, R>(name: string, fn: (doc: Collection<T>) => R): Promise<R> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { doc, etag } = await load<T>(name);
    const result = fn(doc);
    try {
      await save(name, doc, etag);
      return result;
    } catch (e: unknown) {
      if (errName(e) === "BlobPreconditionFailedError" && attempt < 3) {
        await new Promise((r) => setTimeout(r, 150 + Math.random() * 300));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Écriture impossible, réessayez.");
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
