/**
 * Device identity + metadata. The deviceId is a stable UUID generated once and
 * persisted in SecureStore (Expo has no reliable cross-install hardware id).
 */
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { deviceStorage } from '@/services/device-storage';

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await deviceStorage.getDeviceId();
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await deviceStorage.setDeviceId(id);
  return id;
}

export interface DeviceMeta {
  name?: string;
  model?: string;
  os?: string;
  appVersion?: string;
}

export function getDeviceMeta(): DeviceMeta {
  const os = [Device.osName, Device.osVersion].filter(Boolean).join(' ');
  return {
    name: (Device.deviceName ?? Device.modelName ?? 'Dispositivo').slice(0, 120),
    model: Device.modelName?.slice(0, 120) ?? undefined,
    os: os ? os.slice(0, 200) : undefined,
    appVersion: Application.nativeApplicationVersion ?? undefined,
  };
}

export function getAppVersion(): string | undefined {
  return Application.nativeApplicationVersion ?? undefined;
}
