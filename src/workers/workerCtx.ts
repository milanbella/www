import { WorkerCtx } from '../types';
import { Principal } from '../types';

export let workerCtx: WorkerCtx = {
	workerId: null,
	workerName: 'unknown',
	offline: true,
	device: {
		manufacturer: '',
		model: '',
		operatingSystem: '',
		osVersion: '',
		platform: '',
		uuid: '',
	},
	settings: {},
	appVersion: null,
	principal: null,
};

export let settings: any = {
	settings: {},
};

let settingsChangeFns = [];

export function setSettings(_settings) {
	workerCtx.settings = _settings;
	settings.settings = _settings;
	settingsChangeFns.forEach((fn) => {
		fn(settings);
	});
}

export function onSettingsChange(fn) {
	let i = settingsChangeFns.length;
	settingsChangeFns.push(fn);
	return function () {
		settingsChangeFns.splice(i, 1);
	};
}

export let isRunningInWorker = {
	isRunningInWorker: false,
};

export let savedPrincipal = {
	savedPrincipal: null as Principal,
};
