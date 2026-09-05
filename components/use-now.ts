'use client';

import { useEffect, useState } from 'react';

/**
 * A clock that re-renders relative timestamps ("23m ago") without a full refetch.
 * Initialised lazily so nothing time-dependent is rendered before mount.
 */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
