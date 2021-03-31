import { IWorkerMessage } from '../types';
import { sendMessage } from './common';
import { settings } from './workerCtx';
import { workerCtx } from './workerCtx';
import { bootWorker } from './worker';
import { pingHttp } from '../pinghttp';

let offline = false;

function doPing() {
	let interval = settings.settings.httpPingInterval || 500;

	self.setTimeout(() => {
		pingHttp().then(
			() => {
				let _offline = false;

				// Force offline state if offline state is set in preferences.
				if (settings.settings.isOffline) {
					_offline = true;
				}

				if (offline !== _offline) {
					offline = _offline;
					sendOfflineState(offline);
				}
			},
			() => {
				let _offline = true;

				if (offline !== _offline) {
					offline = _offline;
					sendOfflineState(offline);
				}
			}
		);

		// loop for ever
		doPing();
	}, interval);
}

function sendOfflineState(offline) {
	let msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'offline',
		messageData: {
			offline: offline,
		},
	};
	sendMessage(msg);
	if (settings.settings.isDebug && settings.settings.isDebugNet) {
		console.log('netWorker: sent message: offline ' + offline);
	}
}

function init() {
	sendOfflineState(offline);
	doPing();
}

bootWorker(function (event) {
	let msg: IWorkerMessage = event.data;

	try {
		if (settings.settings.isDebug && settings.settings.isDebugNet) {
			console.log('netWorker: received message: ' + msg.messageName);
		}

		if ('setOfflineState' === msg.messageName) {
			let _offline = msg.messageData.offlile;

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
			err: '' + err,
		});
	}
}, init);
