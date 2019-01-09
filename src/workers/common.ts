import { promiseReject } from '../app/common/utils';
import { IWorkerMessage }  from '../app/services/types';
import { NET_WORKER }  from '../app/services/types';
import { pingHttp as basePingHttp } from './../app/services/pinghttp';
import { Principal } from '../app/services/types';
import { workerCtx } from './workerCtx';

var _self: any = self;


// Send message to main thread and returns reply;
export function sendMessage  (msg: IWorkerMessage) : Promise<any>  {
	return new Promise<any> ((resolve, reject) => {
		var channel = new MessageChannel();

		_self.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				reject(event.data.err);
				return;
			}
			resolve(event.data);
		}
	});
}

export function pingHttp () : Promise<any> {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName, 
		dstWorkerName: NET_WORKER, 
		messageName: 'setOfflinneState',
		messageData: {}
	}
	return basePingHttp().then(function (v) {
		msg.messageData.offline = false;
		sendMessage(msg);
		return v;
	}, function (v) {
		msg.messageData.offline = true;
		sendMessage(msg);
		return promiseReject(v);
	});
}

export function refreshPrincipal () : Promise<any> {
	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName, 
		messageName: 'refreshPrincipal',
		messageData: {}
	}
	return sendMessage(msg);
}

