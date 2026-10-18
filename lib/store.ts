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

async function load<T>(name: string): Promise<Loaded<T>> {
  if (useBlob) {
    const { get } = await import("@vercel/blob");
    let res;
    try {
      res = await get(key(name), { access: "private", useCache: false });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "BlobNotFoundError") res = null;
      else throw e;
    }
    if (!res || res.statusCode !== 200 || !res.stream) return { doc: { items: [], seq: 0 }, etag: null };
    const text = await new Response(res.stream).text();
    return { doc: JSON.parse(text), etag: res.blob.etag };
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
      const n = e && typeof e === "object" && "name" in e ? (e as { name: string }).name : "";
      if (n === "BlobPreconditionFailedError" && attempt < 3) {
        await new Promise((r) => setTimeout(r, 150 + Math.random() * 300));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Écriture impossible, réessayez.");
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
