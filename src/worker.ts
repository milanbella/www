import { PROJECT_NAME } from './consts';
import { IWorkerMessage } from './types';
import { DeviceInfo } from './types';
import { LOGGING_WORKER, NET_WORKER, SQS_WORKER, STOMP_WORKER, POUCH_WORKER, COMMON_WORKER } from './types';
import { EventSource } from './eventSource';
import { Logger } from './types';
import { getLogger } from './logger';
import { settings } from './settings';
import { net } from './net';
import { authPrincipal } from './authprincipal';
import { loggerWorkerMessageHandler, loggerSetWorker } from './logger';
import { netWorkerMessageHandler, netSetWorker } from './net';
import { stompWorkerMessageHandler, stompSetWorker } from './stomp';
import { pouchWorkerMessageHandler, pouchSetWorker } from './pouch1';
import { commonWorkerMessageHandler, commonWorkerSetWorker } from './commonWorker';
import { ngzone } from './ngzone';
import { persist } from './persist';
import { getEnvironment } from './environments/environment';
import { getDeviceInfoForBrowser } from './deviceInfo';

let logger = getLogger(PROJECT_NAME, 'worker.ts');

let workers: any = [];
let workersBooted = false;
let initTasks: any = [];

function forwardEventToWorkers(worker, workerId, workerName) {
	function sendEvent(messageName, messageData) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: messageName,
			messageData: messageData,
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: forwardEventToWorkers(): ' + messageName + ': ' + event.data.err);
				console.dir(event.data.err);
			}
		};
	}

	EventSource.settingsChangeEventSource.source.subscribe((_settings) => {
		sendEvent('settings', {
			settings: _settings,
		});
	});
	sendEvent('settings', {
		settings: settings.settings,
	});

	EventSource.offlineEventSource.source.subscribe((isOffline) => {
		sendEvent('offline', {
			offline: isOffline,
		});
	});
	sendEvent('offline', {
		offline: net.isOffline(),
	});

	EventSource.principalChangeEventSource.source.subscribe((principal) => {
		sendEvent('principal', {
			principal: principal,
		});
	});
	authPrincipal.getPrincipal().then(function (principal) {
		sendEvent('principal', {
			principal: principal,
		});
	});
}

function forwardMessageToWorker(event) {
	function fn() {
		let msg: IWorkerMessage = event.data;
		let dstWorkerId = msg.dstWorkerId;
		let dstWorkerName = msg.dstWorkerName;

		let messageProcessed = false;

		if (dstWorkerId || dstWorkerName) {
			workers.every(function (worker) {
				let send;

				if (dstWorkerId) {
					send = worker.workerId === dstWorkerId;
					if (dstWorkerName) {
						send = worker.workerName === dstWorkerName;
					}
				} else if (dstWorkerName) {
					send = worker.workerName === dstWorkerName;
				} else {
					send = false;
				}

				if (send) {
					let channel = new MessageChannel();
					if (!msg.dstWorkerId) {
						msg.dstWorkerId = worker.workerId;
					}
					if (!msg.dstWorkerName) {
						msg.dstWorkerName = worker.workerName;
					}
					worker.worker.postMessage(msg, [channel.port2]);
					channel.port1.onmessage = function (_event) {
						let err = _event.data.err;
						if (err) {
							console.error('services/worker: forwardMessageToWorker(): ' + err);
							console.dir(err);
						}
						event.ports[0].postMessage(_event.data);
					};
					messageProcessed = true;
				}
			});
		}
		return messageProcessed;
	}
	if (ngzone.ngZone) {
		return ngzone.ngZone.runOutsideAngular(fn);
	} else {
		return fn();
	}
}

function apiCall(event) {
	let msg: IWorkerMessage = event.data;
	let messageProcessed = false;

	if ('refreshPrincipal' === msg.messageName) {
		messageProcessed = true;
		event.ports[0].postMessage({});
		authPrincipal.getPrincipal().then(function (principal) {
			EventSource.principalChangeEventSource.generateEvent(principal);
		});
	}
	return messageProcessed;
}

export function sendAppVersion(appVersion) {
	function send(worker, workerId, workerName) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'appVersion',
			messageData: {
				appVersion: appVersion,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: sendAppVersion(): ' + event.data.err);
				console.dir(event.data.err);
			}
		};
	}

	if (workersBooted) {
		workers.forEach(function (worker) {
			send(worker.worker, worker.workerId, worker.workerName);
		});
	} else {
		initTasks.push(function () {
			workers.forEach(function (worker) {
				send(worker.worker, worker.workerId, worker.workerName);
			});
		});
	}
}

export function sendEnvironment(environment) {
	function send(worker, workerId, workerName) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'environment',
			messageData: {
				environment: environment,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: sendEnvironment(): ' + event.data.err);
				console.dir(event.data.err);
			}
		};
	}

	if (workersBooted) {
		workers.forEach(function (worker) {
			send(worker.worker, worker.workerId, worker.workerName);
		});
	} else {
		initTasks.push(function () {
			workers.forEach(function (worker) {
				send(worker.worker, worker.workerId, worker.workerName);
			});
		});
	}
}

export function sendDeviceInfo(deviceInfo) {
	function send(worker, workerId, workerName) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'device',
			messageData: {
				device: deviceInfo,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: sendDeviceInfo(): ' + event.data.err);
				console.dir(event.data.err);
			}
		};
	}

	if (workersBooted) {
		workers.forEach(function (worker) {
			send(worker.worker, worker.workerId, worker.workerName);
		});
	} else {
		initTasks.push(function () {
			workers.forEach(function (worker) {
				send(worker.worker, worker.workerId, worker.workerName);
			});
		});
	}
}

function bootWorker(fileName, workerName, messageHandlerFn, setWorkerFn): Promise<any> {
	const FUNC = 'bootWorker()';
	let promise = new Promise<any>(function (resolve, reject) {
		let worker = new Worker(fileName);

		let workerId = workers.length;
		workers.push({
			workerId: workerId,
			workerName: workerName,
			worker: worker,
		});
		let err;

		function run() {
			setWorkerFn(worker, workerId, workerName);
			resolve(undefined);

			forwardEventToWorkers(worker, workerId, workerName);

			worker.onmessage = function (event) {
				try {
					if (forwardMessageToWorker(event)) {
						return;
					}
					if (apiCall(event)) {
						return;
					}
					messageHandlerFn(event);
				} catch (err) {
					console.error('' + workerName + ': ' + workerId + ': error: ');
					console.dir(err);
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			};
		}

		console.log(`booting worker: ${workerName}`);

		// set worker id

		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			messageName: 'workerId',
			workerId: workerId,
			workerName: workerName,
			messageData: {
				workerId: workerId,
				environment: getEnvironment(),
				settings: settings.settings,
			},
		};

		worker.postMessage(msg, [channel.port2]);
		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				reject(event.data.err);
				console.error(`booting worker: ${workerName}: setting worker id:  + ${event.data.err}`);
				reject(event.data.err);
				return;
			}
			if (event.data.workerId !== workerId) {
				err = new Error(`booting worker: ${workerName}: worker id does not match`);
				console.error(`booting worker: ${workerName}: worker id does not match`);
				reject(err);
				return;
			}

			console.log(`booting worker: ${workerName}:  worker id: ${workerId}`);
		};

		// call worker init function

		channel = new MessageChannel();
		msg = {
			messageName: 'workerInit',
			workerId: workerId,
			workerName: workerName,
			messageData: {},
		};

		worker.postMessage(msg, [channel.port2]);
		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				reject(event.data.err);
				console.error(`booting worker:: ${workerName}: worker initialization failed:  + ${event.data.err}`);
				reject(event.data.err);
				return;
			}

			console.log(`booting worker: ${workerName}:  initialized`);

			// process incomming worker messages
			run();
		};
	});

	return promise.catch(function (err) {
		logger.error(FUNC, `could not boot worker: ${workerName}`, err);
	});
}

export function startWorkers() {
	return persist.getDb().then(() => {
		// Must wait for index db upgrade completion in main thread so that we do not trigger parallel index db upgrade in both main thread and worker thread.
		let promises = [];
		let promise;

		promise = bootWorker('assets/loggingWorker.js', LOGGING_WORKER, loggerWorkerMessageHandler, loggerSetWorker);
		promises.push(promise);

		promise = bootWorker('assets/netWorker.js', NET_WORKER, netWorkerMessageHandler, netSetWorker);
		promises.push(promise);

		promise = bootWorker('assets/stompWorker.js', STOMP_WORKER, stompWorkerMessageHandler, stompSetWorker);
		promises.push(promise);

		promise = bootWorker('assets/pouchWorker.js', POUCH_WORKER, pouchWorkerMessageHandler, pouchSetWorker);
		promises.push(promise);

		promise = bootWorker('assets/commonWorker.js', COMMON_WORKER, commonWorkerMessageHandler, commonWorkerSetWorker);
		promises.push(promise);

		return Promise.all(promises)
			.then(() => {
				initTasks.forEach((task) => {
					task();
				});
			})
			.catch((err) => {
				console.error(`error while booting workers: ${err}`, err);
			});
	});
}

/**
 * This needs to be called immidiatelly after angular application boots, i.e. in AppComponent.constructor()
 */

export async function initWorkersForMobile(appVersion: string, deviceInfo: DeviceInfo) {
	sendAppVersion(appVersion);
	sendEnvironment(getEnvironment().name || 'unknown');
	sendDeviceInfo(deviceInfo);
}

/**
 * This needs to be called immidiatelly after angular application boots, i.e. in AppComponent.constructor()
 */

export async function initWorkersForBrowser(appVersion: string) {
	sendAppVersion(appVersion);
	sendEnvironment(getEnvironment().name || 'unknown');
	let deviceInfo: DeviceInfo = await getDeviceInfoForBrowser();
	sendDeviceInfo(deviceInfo);
}
