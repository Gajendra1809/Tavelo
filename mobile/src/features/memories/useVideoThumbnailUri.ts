import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';

const cache = new Map<string, string>();

export function useVideoThumbnailUri(sourceUri: string | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(() => (sourceUri ? (cache.get(sourceUri) ?? null) : null));

  useEffect(() => {
    if (!sourceUri) {
      setUri(null);
      return;
    }
    const cached = cache.get(sourceUri);
    if (cached) {
      setUri(cached);
      return;
    }
    let active = true;
    void VideoThumbnails.getThumbnailAsync(sourceUri, { time: 800, quality: 0.72 })
      .then((result) => {
        cache.set(sourceUri, result.uri);
        if (active) {
          setUri(result.uri);
        }
      })
      .catch(() => {
        if (active) {
          setUri(null);
        }
      });
    return () => {
      active = false;
    };
  }, [sourceUri]);

  return uri;
}
