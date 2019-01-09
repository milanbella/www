import { waitFor } from '../common/utils';
import { IWorkerMessage } from './types';
import { Principal } from './types';
import { EventSource } from './eventSource';

import { _ } from 'underscore';

// Note: The same interface is implemented for workers in src/workers/logger.ts

var worker;
var workerId;
var workerName;

var offline;
var principal: Principal;

function initFinished (): Promise<any> {
	return waitFor(function () {return workerId >= 0;});
}

//TODO: remove (use instaead getLogger() factory)
export var logger = {
	log: function (message: string, err?: any, attrs?: any) {
		logger.doLog('INFO', message, err, attrs);
	},
	info: function (message: string, err?: any, attrs?: any) {
		logger.doLog('INFO', message, err, attrs);
	},
	fatal: function (message: string, err?: any, attrs?: any) {
		logger.doLog('FATAL', message, err, attrs);
	},
	error: function (message: string, err?: any, attrs?: any) {
		logger.doLog('ERROR', message, err, attrs);
	},
	debug: function (message: string, err?: any, attrs?: any) {
		logger.doLog('DEBUG', message, err, attrs);
	},
	warn: function (message: string, err?: any, attrs?: any) {
		logger.doLog('WARN', message, err, attrs);
	},
	trace: function (message: string, err?: any, attrs?: any) {
		logger.doLog('TRACE', message, err, attrs);
	},

	doLog: function (level: string, message: string, err?: any, attrs?: any) {
		if (err) {
			message = message + '' + err; 
		}
		// in main thread
		sendOfflineLogMessage(level, new Date(), message, attrs)
	}
}

type LogFn = (message: string, err?: any, attrs?: any) => any;

export interface Logger {
	log: LogFn;
	info: LogFn;
	fatal: LogFn;
	error: LogFn;
	debug: LogFn;
	warn: LogFn;
	trace: LogFn;
	doLog: any;
};



export function getLogger (messagePrefix?) : Logger {
	var prefix = messagePrefix || '';

	function makeMessage (message) {
		return prefix + ': '  + message;
	}

	var logger: Logger = {
		log: function (message: string, err?: any, attrs?: any) {
			logger.doLog('INFO', message, err, attrs);
		},
		info: function (message: string, err?: any, attrs?: any) {
			logger.doLog('INFO', message, err, attrs);
		},
		fatal: function (message: string, err?: any, attrs?: any) {
			logger.doLog('FATAL', message, err, attrs);
		},
		error: function (message: string, err?: any, attrs?: any) {
			logger.doLog('ERROR', message, err, attrs);
		},
		debug: function (message: string, err?: any, attrs?: any) {
			logger.doLog('DEBUG', message, err, attrs);
		},
		warn: function (message: string, err?: any, attrs?: any) {
			logger.doLog('WARN', message, err, attrs);
		},
		trace: function (message: string, err?: any, attrs?: any) {
			logger.doLog('TRACE', message, err, attrs);
		},

		doLog: function (level: string, message: string, err?: any, attrs?: any) {
			message = makeMessage(message);

			if (err) {
				message = message + '' + err; 
			}
			// in main thread
			sendOfflineLogMessage(level, new Date(), message, attrs)
		}
	};

	return logger;
}


EventSource.offlineEventSource.source.subscribe(function (_offline) {
	offline = _offline;
});

EventSource.principalChangeEventSource.source.subscribe(function (_principal: Principal) {
	principal = _principal;
});

export function sendOfflineLogMessage (level: string, time: Date, message: string, attrs: any): Promise<any> {
	return initFinished().then(function () {
		if(!attrs) {
			attrs = {};
		}
		return new Promise<any> (function (resolve, reject) {
			if (principal) {
				attrs = _.extend(attrs, { 
					userUuid: principal.userUuid,
					userName: principal.userName,
					userEmail: principal.userEmail,
					adUserId: principal.adUserId,
					adClientId: principal.adClientId,
				});
			} else {
				attrs = _.extend(attrs, { 
					userUuid: 'unknown',
					userName: 'unknown',
					userEmail: 'unknown',
					adUserId: 'unknown',
					adClientId: 'unknown',
				});
			}
			attrs.offline = offline;

			var channel = new MessageChannel();

			var msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'log',
				messageData: {
					level: level,
					time: time,
					message: message,
					attrs: attrs
				}
			}

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					reject(event.data.err);
					console.error('mainthread/logger.sendOfflineLogMessage(): ' + event.data.err); 
					return;
				}
				resolve();
			}
		});
	});
}

export function workerMessageHandler (event) {
	var msg: IWorkerMessage = event.data;

	try {
		event.ports[0].postMessage({
			err: 'unknow messageName'
		});
	} catch (err) {
		console.error('logger: error: ');
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
