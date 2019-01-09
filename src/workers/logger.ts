import { IWorkerMessage } from '../app/services/types';
import { LOGGING_WORKER } from '../app/services/types';
import { sendMessage } from './common';
import { workerCtx } from './workerCtx';

import { _ } from 'underscore';

// Note: The same interface is implemented for workers in src/app/services/logger.ts

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
		sendOfflineLogMessage(level, new Date(), message, attrs);
    }
}

function sendOfflineLogMessage (level: string, time: Date, message: string, attrs: any): Promise<any> {
	var principal = workerCtx.principal;
	var offline = workerCtx.offline;
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
			workerId: workerCtx.workerId,
			workerName: workerCtx.workerName,
			dstWorkerName: LOGGING_WORKER, 
			messageName: 'log',
			messageData: {
				level: level,
				time: time,
				message: message,
				attrs: attrs
			}
		}

		sendMessage(msg)
		.catch(function (err) {
			console.error('workers/logger.sendOfflineLogMessage(): ' + err); 
		});
	});
}
