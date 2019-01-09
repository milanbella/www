import { IWorkerMessage } from './types';
import { LOGGING_WORKER, NET_WORKER, SQS_WORKER } from './types';
import { EventSource } from './eventSource';
import { websqlmAttach  } from './websqlm';
import { logger } from './logger';
import { settings } from './settings';
import { net } from './net';
import { authPrincipal } from './authprincipal';
import { workerMessageHandler as loggingWorkerMessageHandler } from './logger';
import { setWorker as loggingWorkerSetWorker } from './logger';
import { workerMessageHandler as netWorkerMessageHandler } from './net';
import { setWorker as netWorkerSetWorker } from './net';
import { workerMessageHandler as sqsWorkerMessageHandler } from './sqs1';
import { setWorker as sqsWorkerSetWorker } from './sqs1';

var DEBUG_WORKER = false;

var workers: any = [];

function forwardEventToWorkers (worker, workerId, workerName) {
	function sendEvent (messageName, messageData) {
		var channel = new MessageChannel();
		var msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: messageName,
			messageData: messageData
		}

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: forwardEventToWorkers(): ' +  messageName + ': ' + event.data.err); 
				console.dir(event.data.err);
			}
		}
	}

	EventSource.settingsChangeEventSource.source.subscribe((_settings) => {
		sendEvent('settings', {
			settings: _settings
		});
	});
	sendEvent('settings', {
		settings: settings.settings
	});

	EventSource.offlineEventSource.source.subscribe((isOffline) => {
		sendEvent('offline', {
			offline: isOffline
		});
	});
	sendEvent('offline', {
		offline: net.isOffline()
	});

	EventSource.principalChangeEventSource.source.subscribe((principal) => {
		sendEvent('principal', {
			principal: principal
		});
	});
	authPrincipal.getPrincipal().then(function (principal) {
		sendEvent('principal', {
			principal: principal
		});
	});
	

	var channel = new MessageChannel();
	var msg: IWorkerMessage = {
		workerId: workerId,
		workerName: workerName,
		messageName: 'device',
		messageData: {
			device: self['device'] || {}
		}
	}

	worker.postMessage(msg, [channel.port2]);

	channel.port1.onmessage = function (event) {
		if (event.data.err) {
			console.error('services/worker: forwardEventToWorkers(): device: ' + event.data.err); 
			console.dir(event.data.err);
		}
	}
}

function forwardMessageToWorker (event) {
	var msg: IWorkerMessage = event.data;
	var dstWorkerId = msg.dstWorkerId;
	var dstWorkerName = msg.dstWorkerName;

	var messageProcessed = false;

	if (dstWorkerId || dstWorkerName) {
		var worker = workers.every(function (worker) {
			var send;

			if (dstWorkerId) {
				send = worker.workerId === dstWorkerId;
				if (dstWorkerName) {
					send = worker.workerName === dstWorkerName;
				};
			} else if (dstWorkerName) {
				send = worker.workerName === dstWorkerName
			} else {
				send = false;
			}

			if (send) {
				var channel = new MessageChannel();
				if (!msg.dstWorkerId) {
					msg.dstWorkerId = worker.workerId;
				}
				if (!msg.dstWorkerName) {
					msg.dstWorkerName = worker.workerName;
				}
				worker.worker.postMessage(msg, [channel.port2]);
				channel.port1.onmessage = function (_event) {
					var err = _event.data.err;
					if (err) {
						console.error('services/worker: forwardMessageToWorker(): ' + err); 
						console.dir(err);
					}
					event.ports[0].postMessage(_event.data); 
				}
				messageProcessed = true;
			}
			
		});
	}
	return messageProcessed;
}

function  apiCall (event) {
	var msg: IWorkerMessage = event.data;
	var messageProcessed = false;

	if ('refreshPrincipal' === msg.messageName) {
		messageProcessed = true;
		event.ports[0].postMessage({}); 
		authPrincipal.getPrincipal().then(function (principal) {
			EventSource.principalChangeEventSource.generateEvent(principal);
		});
	}
	return messageProcessed;
}

export function sendAppVersion (appVersion) {
	function send (worker, workerId, workerName) {
		var channel = new MessageChannel();
		var msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'appVersion',
			messageData: {
				appVersion: appVersion
			}
		}

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: sendAppVersion(): ' + event.data.err); 
				console.dir(event.data.err);
			}
		}
	}
	workers.every(function (worker) {
		send(worker.worker, worker.workerId, worker.workerName);
	});
}

export function sendEnvironment (environment) {
	function send (worker, workerId, workerName) {
		var channel = new MessageChannel();
		var msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'environment',
			messageData: {
				environment: environment
			}
		}

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				console.error('services/worker: sendEnvironment(): ' + event.data.err); 
				console.dir(event.data.err);
			}
		}
	}
	workers.every(function (worker) {
		send(worker.worker, worker.workerId, worker.workerName);
	});
}

function bootWorker (fileName,  workerName, messageHandlerFn, setWorkerFn) : Promise<any> {

	var promise = new Promise<any> (function (resolve, reject) {
		var worker = new Worker(fileName);

		var workerId = workers.length;
		workers.push({
			workerId: workerId,
			workerName: workerName,
			worker: worker
		});
		var err;

		var channel = new MessageChannel();
		var msg: IWorkerMessage = {
			messageName: 'workerId',
			workerId: workerId,
			workerName: workerName,
			messageData: {
				workerId: workerId
			}
		}

		console.log('booting worker: ' + workerName);
		worker.postMessage(msg, [channel.port2]);
		channel.port1.onmessage = function (event) {

			if (DEBUG_WORKER) {
				console.log('main thread: ' + msg.workerName + ': ' + msg.messageName);
			}

			if (event.data.err) {
				reject(event.data.err);
				console.error('services/worker: getWorkerId(): ' + event.data.err); 
				reject(event.data.err);
				return;
			}
			if (event.data.workerId != workerId) {
				err = new Error('services/worker: workerId does not match');
				console.error('services/worker: workerId does not match');
				reject(err);
				return;
			}
			console.log('thread connected to worker: ' + workerName);
			setWorkerFn(worker, workerId, workerName);
			resolve();

			forwardEventToWorkers(worker, workerId, workerName);

			var websqlmMessageHandler =  websqlmAttach(worker, workerId, workerName);

			worker.onmessage = function(event) {
				var msg: IWorkerMessage = event.data;

				try {
					if (forwardMessageToWorker(event)) {
						return;
					}
					if (websqlmMessageHandler(event)) {
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
						err: '' + err
					});
				}
			};

		}
	});

	return promise.catch(function (err) {
		console.error('could not boot worker: ' + workerName);
		console.dir(err);
		logger.error('could not boot worker: ' + workerName, err);
	});
}

bootWorker('assets/loggingWorker.js', LOGGING_WORKER, loggingWorkerMessageHandler, loggingWorkerSetWorker);
bootWorker('assets/netWorker.js', NET_WORKER, netWorkerMessageHandler, netWorkerSetWorker);
bootWorker('assets/sqsWorker.js', SQS_WORKER, sqsWorkerMessageHandler, sqsWorkerSetWorker);
