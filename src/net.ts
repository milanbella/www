import { waitFor } from './common/utils';
import { EventSource } from './eventSource';
import { IWorkerMessage } from './types';
import { pingHttp } from './pinghttp';
import { settings } from './settings';
import { getExecutionContext } from './executionContext';

let worker;
let workerId;
let workerName: string;

let offline: boolean = false;

function initFinished(): Promise<any> {
	let werr = new Error('net.ts:initFinished(): workerId > 0');
	return waitFor(function () {
		return workerId >= 0;
	}, werr);
}

export class Net {
	public networkIndicationToasterActive: boolean = false;

	constructor() {
		EventSource.offlineEventSource.generateEvent(offline);
	}

	isOnline() {
		return !offline;
	}

	isOffline() {
		return offline;
	}

	setOfflineState() {
		sendSetOfflinneState(true);
	}

	pingHttp(): Promise<any> {
		if (settings.settings.isOffline === true) {
			return Promise.reject();
		} else {
			return pingHttp().then(
				(ret) => {
					sendSetOfflinneState(false);
					return ret;
				},
				(ret) => {
					sendSetOfflinneState(true);
					return Promise.reject(ret);
				}
			);
		}
	}
}

export let net: Net = new Net();

export function sendSetOfflinneState(offline): Promise<any> {
	if (getExecutionContext().isServerSide) {
		return Promise.resolve();
	}
	return initFinished().then(function () {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'offline',
			messageData: {
				offline: offline,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('net.sendSetOfflinneState(): ' + event.data.err);
				console.dir(event.data.err);
			}
		};
	});
}

export function netWorkerMessageHandler(event) {
	let msg: IWorkerMessage = event.data;

	try {
		if ('offline' === msg.messageName) {
			event.ports[0].postMessage({});
			let _offline = msg.messageData.offline;
			if (offline !== _offline) {
				offline = _offline;
				if (offline) {
					console.log('net: offline');
				} else {
					console.log('net: online');
				}
				EventSource.offlineEventSource.generateEvent(offline);
			}
		} else {
			// reply back with negative ackonwledgemet
			event.ports[0].postMessage({
				err: 'unknow messageName',
			});
		}
	} catch (err) {
		console.error('net: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}

export function netSetWorker(_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
}
