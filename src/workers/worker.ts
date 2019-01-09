import { promiseReject } from '../app/common/utils';
import { IWorkerMessage, WorkerCtx }  from '../app/services/types';
import { NET_WORKER }  from '../app/services/types';
import { pingHttp as basePingHttp } from './../app/services/pinghttp';
import { workerCtx, setSettings } from './workerCtx';
import { listenToEvenets as listenToEvenetsWebsql } from './websqlw';
import { Principal } from '../app/services/types';

var DEBUG_WORKER = false;

var _self: any = self;

export function bootWorker (messageHandlerFn, startupFn?) {

	self.addEventListener('message', function (event) {     
		var msg: IWorkerMessage = event.data;
		var err;
		var startupCalled = false;


		if (DEBUG_WORKER) {
			console.log('worker: ' + msg.workerName + ': ' + msg.messageName);
		}

		try {

			if ('workerId' === msg.messageName) {
				workerCtx.workerId = msg.messageData.workerId;
				workerCtx.workerName = msg.workerName;
				console.log('worker: ' + msg.workerName + ': ' + workerCtx.workerId + ' :' + 'started');
				event.ports[0].postMessage({
					workerId: workerCtx.workerId
				}); 
				if (startupFn) {
					if (!startupCalled) {
						startupCalled = true;
						startupFn();
					}
				}
				return;
			} 

			if (!((workerCtx.workerId === msg.workerId) // this is message comming from main thread handler for this worker 
				|| (workerCtx.workerId === msg.dstWorkerId))) { // this is message from other worker for this worker forwarded to this worker by main thread handler for other worker, see: app/services/worker.ts forwardMessageToWorker()
				console.error('workers/worker: workerId differs');
				err = new Error('workers/worker: workerId differs');
				event.ports[0].postMessage({
					err: '' + err
				});
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
				workerCtx.environment = msg.messageData.environment
				return;
			}
			if ('principal' === msg.messageName) {
				event.ports[0].postMessage({});
				workerCtx.principal = msg.messageData.principal;
				return;
			}

			if (listenToEvenetsWebsql(event)) {
				return;
			}

			if (messageHandlerFn(event)) {
				return;
			}

		} catch (err) {
			console.error('workerCommon: listenToEvenets(): error: ');
			console.dir(err);
			event.ports[0].postMessage({
				err: '' + err
			});
		}
	});    
}
