// Reconnaît les liens YouTube (youtube.com/watch, youtu.be, shorts, embed, live) pour afficher la vignette.
export function youtubeId(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
        if (m) id = m[1];
      }
    }
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const youtubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
