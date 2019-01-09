import { newPromise, promiseResolve, promiseReject, waitFor } from '../common/utils';
import { EventSource } from './eventSource';
import { IWorkerMessage } from './types';
import { NET_WORKER } from './types';
import { pingHttp } from './pinghttp';
import { settings } from './settings';

var worker;
var workerId;
var workerName: string;

var offline: boolean = false;

function initFinished (): Promise<any> {
	return waitFor(function () {return workerId >= 0;});
}

export class Net {

	public networkIndicationToasterActive: boolean = false;

	constructor () {
		EventSource.offlineEventSource.generateEvent(offline);
	}

	isOnline () {
		return !offline;
	}

	isOffline () {
		return offline;
	}

	setOfflineState () {
		sendSetOfflinneState(true);
	}

	pingHttp (): Promise<any> {
		if (settings.settings.isOffline === true) {
			return promiseReject();
		} else {
			return pingHttp()
			.then((ret)=>{
				sendSetOfflinneState(false);
				return ret;
			}, (ret) => {
				sendSetOfflinneState(true);
				return promiseReject(ret);
			});
		}
	}

}

export var net: Net = new Net();

export function sendSetOfflinneState (offline) : Promise<any>  {
	return initFinished().then(function () {

		var channel = new MessageChannel();
		var msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'setOfflinneState',
			messageData: {
				offline: offline
			}
		}

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('net.sendSetOfflinneState(): ' + event.data.err); 
				console.dir(event.data.err);
			}
		}
	});
}

export function workerMessageHandler (event) {
	var msg: IWorkerMessage = event.data;

	try {

		if ('offline' === msg.messageName) {
			event.ports[0].postMessage({});
			var _offline = msg.messageData.offline;
			if (offline != _offline) {
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
				err: 'unknow messageName'
			});
		}

	} catch (err) {
		console.error('net: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err
		});
	}
};

export function setWorker (_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
};
