import { devicesCatalogUrl } from "~/config/repoEnv";

export interface DeviceOption {
    id: string;
    name: string;
    vendor?: string;
}

type DevicesPayload = Record<string, Record<string, { id: string; name: string }>>;

const cache = new Map<string, DeviceOption[]>();
const inflight = new Map<string, Promise<DeviceOption[]>>();

function parseDeviceOptions(payload: DevicesPayload): DeviceOption[] {
    const map = new Map<string, DeviceOption>();
    Object.entries(payload).forEach(([vendor, devices]) => {
        Object.values(devices).forEach((device) => {
            if (!map.has(device.id)) {
                map.set(device.id, {
                    id: device.id,
                    name: device.name || device.id,
                    vendor,
                });
            }
        });
    });

    return Array.from(map.values());
}

export async function loadDeviceOptions() {
    const url = devicesCatalogUrl();
    const cached = cache.get(url);
    if (cached) return cached;

    const pending = inflight.get(url);
    if (pending) return pending;

    const promise = (async () => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }
        const payload = (await response.json()) as DevicesPayload;
        const options = parseDeviceOptions(payload);
        if (options.length === 0) {
            throw new Error("设备列表为空");
        }
        cache.set(url, options);
        return options;
    })();

    inflight.set(url, promise);
    try {
        return await promise;
    } finally {
        inflight.delete(url);
    }
}

export async function loadDeviceNameMap() {
    const options = await loadDeviceOptions();
    return new Map(options.map((option) => [option.id, option.name]));
}

export function resolveDeviceName(
    deviceNameMap: Map<string, string>,
    rawName: string,
    rawId?: string,
) {
    if (rawId && deviceNameMap.has(rawId)) {
        return deviceNameMap.get(rawId)!;
    }
    return deviceNameMap.get(rawName) || rawName;
}
