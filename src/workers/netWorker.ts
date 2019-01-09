import { IWorkerMessage } from '../app/services/types';
import { sendMessage } from './common';
import { settings } from './workerCtx';
import { workerCtx } from './workerCtx';
import { bootWorker } from './worker';
import { pingHttp } from '../app/services/pinghttp';

var offline = false;

function doPing () {

	var interval = settings.settings.httpPingInterval || 0;
	if (interval <  15000) {
		interval = 15000;
	}

	self.setTimeout(() => {
		pingHttp(5000).then(
			() => {
				var _offline = false;

				// Force offline state if offline state is set in preferences.
				if (settings.settings.isOffline) {
					_offline = true;
				}

				if(offline !== _offline) {
					offline = _offline;
					sendOfflineState(offline);
				}
			},
			() => {
				var _offline = true;

				if (offline !== _offline) {
					offline = _offline;
					sendOfflineState(offline);
				}

			});

		// loop for ever
		doPing();
	}, interval);
}


function sendOfflineState (offline)  {

	var msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'offline',
		messageData: {
			offline: offline
		}
	}
	sendMessage (msg) 
	if (settings.settings.isDebug && settings.settings.isDebugNet) {
		console.debug('netWorker: sent message: offline ' + offline);
	}
}

function startup () {
	sendOfflineState(offline);
	doPing();
}


bootWorker(function (event) {     
	var msg: IWorkerMessage = event.data;
	var started = false;

	try {
		if (settings.settings.isDebug && settings.settings.isDebugNet) {
			console.debug('netWorker: received message: ' + msg.messageName);
		}

		if ('setOfflineState' === msg.messageName) {
			var _offline = msg.messageData.offlile;

			event.ports[0].postMessage({}); // immidatelly reply back with positive ackonwledgemet
			if (offline !== _offline) {
				offline = _offline; 
				sendOfflineState(offline);
			}
			return true;
		}
	} catch (err) {
		console.error('netWorker: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err
		});
	}
}, startup);    
