import { useState, useCallback } from 'react';
import { useDeviceStore } from '@/store/device-store';
import { useDeviceSession } from './use-device-session';
import type { DeviceBranch } from '@/services/device-service';

export function useBranchSelector() {
  const [modalVisible, setModalVisible] = useState(false);
  const { activeBranch, availableBranches } = useDeviceSession();
  const switchBranch = useDeviceStore((s) => s.switchBranch);

  const openSelector = useCallback(() => {
    if (availableBranches.length > 1) setModalVisible(true);
  }, [availableBranches.length]);

  const handleSelect = useCallback(
    async (branch: DeviceBranch) => {
      await switchBranch(branch);
      setModalVisible(false);
    },
    [switchBranch],
  );

  return {
    modalVisible,
    activeBranch,
    availableBranches,
    openSelector,
    closeSelector: () => setModalVisible(false),
    handleSelect,
    canSwitch: availableBranches.length > 1,
  };
}
