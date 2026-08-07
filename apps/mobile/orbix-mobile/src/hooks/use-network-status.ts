import { useEffect, useState } from 'react';

import { networkStatus } from '@/services/api';

/** Reactive connectivity, for offline banners and disabled submit buttons. */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(() => networkStatus.isOnline());

  useEffect(() => networkStatus.subscribe(setIsOnline), []);

  return { isOnline };
}
