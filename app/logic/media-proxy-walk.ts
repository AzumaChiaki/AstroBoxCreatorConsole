import { useEffect, useMemo, useState } from "react";
import { fetchProxiedMediaUrl } from "./media-proxy";

const URL_KEYS = new Set(["url", "img", "avatarUrl"]);

function isAbsolute(value: string) {
  return /^(https?:|data:|blob:)/i.test(value);
}

function normalizeRelative(value: string, baseUrl: string) {
  const trimmed = value.replace(/^\/+/, "");
  return baseUrl + trimmed;
}

function collectMediaUrls(value: unknown, out: Set<string>, baseUrl?: string) {
  if (!value) return;
  if (typeof value === "string") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaUrls(item, out, baseUrl));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (URL_KEYS.has(key) && typeof child === "string" && child.length > 0) {
        if (isAbsolute(child)) {
          out.add(child);
        } else if (baseUrl) {
          out.add(normalizeRelative(child, baseUrl));
        }
      } else {
        collectMediaUrls(child, out, baseUrl);
      }
    }
  }
}

function rewriteUrls<T>(
  value: T,
  mapping: Map<string, string>,
  baseUrl?: string,
): T {
  if (value == null) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => rewriteUrls(item, mapping, baseUrl)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (URL_KEYS.has(key) && typeof child === "string" && child.length > 0) {
        const resolved = isAbsolute(child)
          ? child
          : baseUrl
            ? normalizeRelative(child, baseUrl)
            : child;
        out[key] = mapping.get(resolved) ?? resolved;
      } else {
        out[key] = rewriteUrls(child, mapping, baseUrl);
      }
    }
    return out as unknown as T;
  }
  return value;
}

export interface UseProxiedPayloadOptions {
  /**
   * Base URL prepended to any non-absolute URL value. Should end with a slash.
   */
  baseUrl?: string;
  /**
   * Map from resolved absolute URL (or relative path key) to a File that should
   * be used as a local preview instead of fetching from the network. Useful for
   * showing not-yet-uploaded media in the preview.
   */
  pendingFiles?: Map<string, File>;
}

export function useProxiedPayload<T>(
  payload: T,
  options: UseProxiedPayloadOptions = {},
): T {
  const { baseUrl, pendingFiles } = options;
  const [mapping, setMapping] = useState<Map<string, string>>(new Map());

  const pendingByAbsoluteUrl = useMemo(() => {
    const out = new Map<string, File>();
    if (!pendingFiles || !baseUrl) return out;
    pendingFiles.forEach((file, path) => {
      const absolute = isAbsolute(path) ? path : normalizeRelative(path, baseUrl);
      out.set(absolute, file);
    });
    return out;
  }, [pendingFiles, baseUrl]);

  useEffect(() => {
    if (!payload) {
      setMapping(new Map());
      return;
    }
    const urls = new Set<string>();
    collectMediaUrls(payload, urls, baseUrl);
    if (urls.size === 0) {
      setMapping((current) => (current.size === 0 ? current : new Map()));
      return;
    }
    let cancelled = false;
    const blobUrls: string[] = [];

    Promise.all(
      Array.from(urls).map(async (url) => {
        const pending = pendingByAbsoluteUrl.get(url);
        if (pending) {
          const blobUrl = URL.createObjectURL(pending);
          blobUrls.push(blobUrl);
          return [url, blobUrl] as const;
        }
        try {
          const resolved = await fetchProxiedMediaUrl(url);
          return [url, resolved] as const;
        } catch {
          return [url, url] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        blobUrls.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
        return;
      }
      setMapping(new Map(entries));
    });

    return () => {
      cancelled = true;
      blobUrls.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    };
  }, [payload, baseUrl, pendingByAbsoluteUrl]);

  return useMemo(
    () => rewriteUrls(payload, mapping, baseUrl),
    [payload, mapping, baseUrl],
  );
}
