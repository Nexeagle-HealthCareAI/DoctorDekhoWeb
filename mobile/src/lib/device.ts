import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDevice, type DeviceInfo } from "./api/patient";

const INSTALLATION_KEY = "dd_installation_id";

/** A random id created once per install; identifies this phone in PatientAppDevices. */
export async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY).catch(() => null);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_KEY, id).catch(() => {});
  return id;
}

function easProjectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Expo push token, or null. Only asks the OS for permission when `ask` is true (the patient just switched reminders on),
 * so the app never opens with a permission prompt. Needs a real device and an EAS project id.
 */
export async function getPushToken(ask: boolean): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const projectId = easProjectId();
    if (!projectId) return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Appointments",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Tells EasyHMS about this install (and its push token when allowed). Safe to call on every sign-in. */
export async function syncDevice(askForPush = false): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  const info: DeviceInfo = {
    installationId: await getInstallationId(),
    platform: Platform.OS,
    appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
    osVersion: `${Platform.OS} ${Device.osVersion ?? ""}`.trim(),
    deviceModel: Device.modelName ?? null,
    pushToken: await getPushToken(askForPush),
  };
  await registerDevice(info);
}
