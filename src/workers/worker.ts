import { IWorkerMessage } from '../types';
import { EventSource } from '../eventSource';
import { workerCtx, setSettings, isRunningInWorker } from './workerCtx';
import { setEnvironment } from '../environments/environment';

import * as _ from 'underscore';

let DEBUG_WORKER = false;

export function bootWorker(messageHandlerFn, initFn?) {
	isRunningInWorker.isRunningInWorker = true;
	self.addEventListener('message', function (event) {
		let msg: IWorkerMessage = event.data;
		let err;

		if (!initFn) {
			initFn = () => {
				return new Promise((resolve) => {
					resolve(undefined);
				});
			};
		} else if (!_.isFunction(initFn.then)) {
			let fn = initFn;
			initFn = () => {
				return new Promise((resolve, reject) => {
					try {
						let res = fn();
						resolve(res);
					} catch (err) {
						reject(err);
					}
				});
			};
		}

		if (DEBUG_WORKER) {
			console.log('worker: ' + msg.workerName + ': ' + msg.messageName);
		}

		try {
			if ('workerId' === msg.messageName) {
				workerCtx.workerId = msg.messageData.workerId;
				workerCtx.workerName = msg.workerName;
				setSettings(msg.messageData.settings);
				setEnvironment(msg.messageData.environment);
				event.ports[0].postMessage({
					workerId: workerCtx.workerId,
				});
				return;
			}

			if (
				!(workerCtx.workerId === msg.workerId || workerCtx.workerId === msg.dstWorkerId) // this is message comming from main thread handler for this worker
			) {
				console.error('worker: workerId differs');
				err = new Error('worker: workerId differs');
				event.ports[0].postMessage({
					err: '' + err,
				});
				return;
			}

			if ('workerInit' === msg.messageName) {
				initFn().then(
					(result) => {
						event.ports[0].postMessage({
							result: result,
						});
					},
					(err) => {
						console.error('worker: ' + msg.workerName + ': ' + workerCtx.workerId + ' : ' + 'initialization failed: ' + err, err);
						event.ports[0].postMessage({
							err: '' + err,
						});
					}
				);
				return;
			}

			if ('settings' === msg.messageName) {
				setSettings(msg.messageData.settings);
				event.ports[0].postMessage({});
				return;
			}
			if ('offline' === msg.messageName) {
				event.ports[0].postMessage({});
				workerCtx.offline = msg.messageData.offline;
				EventSource.offlineEventSource.generateEvent(msg.messageData.offline);
				return;
			}
			if ('device' === msg.messageName) {
				event.ports[0].postMessage({});
				workerCtx.device = msg.messageData.device;
				return;
			}
			if ('appVersion' === msg.messageName) {
				event.ports[0].postMessage({});
				workerCtx.appVersion = msg.messageData.appVersion;
				return;
			}
			if ('environment' === msg.messageName) {
				event.ports[0].postMessage({});
				setEnvironment(msg.messageData.environment);
				return;
			}
			if ('principal' === msg.messageName) {
				event.ports[0].postMessage({});
				workerCtx.principal = msg.messageData.principal;
				return;
			}

			if (messageHandlerFn(event)) {
				return;
			} else {
				console.error(`worker: unknown message: ${msg.messageName}`);
				event.ports[0].postMessage({
					err: `worker: unknown message: ${msg.messageName}`,
				});
			}
		} catch (err) {
			console.error('worker: listenToEvenets(): error: ');
			console.dir(err);
			event.ports[0].postMessage({
				err: '' + err,
			});
		}
	});
}
