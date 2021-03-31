import { IWorkerMessage } from '../types';
import { NET_WORKER } from '../types';
import { pingHttp as basePingHttp } from '../pinghttp';
import { workerCtx } from './workerCtx';

let _self: any = self;

// Send message to main thread and returns reply;
export function sendMessage(msg: IWorkerMessage): Promise<any> {
	return new Promise<any>((resolve, reject) => {
		let channel = new MessageChannel();

		_self.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				reject(event.data.err);
				return;
			}
			resolve(event.data);
		};
	});
}

export function pingHttp(): Promise<any> {
	let msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		dstWorkerName: NET_WORKER,
		messageName: 'offline',
		messageData: {},
	};
	return basePingHttp().then(
		function (v) {
			msg.messageData.offline = false;
			sendMessage(msg);
			return v;
		},
		function (v) {
			msg.messageData.offline = true;
			sendMessage(msg);
			return Promise.reject(v);
		}
	);
}

export function refreshPrincipal(): Promise<any> {
	let msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'refreshPrincipal',
		messageData: {},
	};
	return sendMessage(msg);
}

export interface MessageRateCounter {
	eventSource: EventSource;
}
