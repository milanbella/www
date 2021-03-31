import { DeviceInfo } from './types';

let getDeviceInfoOverride: () => Promise<DeviceInfo> = null;

export async function getDeviceInfo(): Promise<DeviceInfo> {
	if (getDeviceInfoOverride) {
		return getDeviceInfoOverride();
	} else {
		let deviceInfo: DeviceInfo = {
			manufacturer: 'unknown',
			model: 'unknown',
			operatingSystem: 'unknown',
			osVersion: 'unknown',
			platform: 'unknown',
			uuid: 'unknown',
		};
		return deviceInfo;
	}
}

export function setGetDeviceInfoOverride(fn: () => Promise<DeviceInfo>) {
	getDeviceInfoOverride = fn;
}

export async function getDeviceInfoForBrowser(): Promise<DeviceInfo> {
	let deviceInfo: DeviceInfo = {
		manufacturer: 'unknown',
		model: 'unknown',
		operatingSystem: 'unknown',
		osVersion: 'unknown',
		platform: 'browser',
		uuid: 'unknown',
	};
	return deviceInfo;
}
