import { newPromise, promiseResolve, promiseReject, promiseAll } from '../app/common/utils';

import { Database } from '../app/services/idbDatabase';
import { Principal } from '../app/services/types';
import { getDatabase, deleteDatabase } from '../app/services/idbDatabase';
import { sendMessage } from './common';
import { workerCtx, settings } from './workerCtx';
import { bootWorker } from './worker';
import { IWorkerMessage } from '../app/services/types';

import { _ } from 'underscore';

export interface ILogEventData {
	level: string;
	message: string;
}

interface ISender {
	sendLogMessage (level: string, time: string, message: string, attrs: any): Promise<any>
}

interface ILogEntry {
	message: string;
	level: string;
	time: string;
	attrs: any;
	flushCount: number;
	senders: {
		[senderName: string]: ILogEntrySender
	}
}

interface ILogEntrySender {
	timeSentAt: number;
	errorCounter: number;
	sentOk: boolean;
}

interface IRegisteredSenders {
	[senderName: string]: ISender,
}

var DATABASE_NAME_OFFLINE_LOG = 'logDb';
var STORE_NAME_OFFLINE_LOG = 'offlineLog';

var OFFLINE_LOG_ENTRY_FLUSH_INTERVAL = 1000; // intrval in milliseconds for periodic flush sending of offline logs, 
var SENDER_SEND_TIMEOUT = 10 * 1000; 
var OFFLINE_LOG_ENTRY_MAX_FLUSH_COUNT = 6; // number of attempts to send offline log entry, if more then 6 attempts offline log entry will be deleted   

export var LOG_EVENT_NAME = "log";

var registeredSenders: IRegisteredSenders = {};

var principal: Principal;
var environment: string = 'unknown';


function GetLogDatabase (): Promise<any> {
	var upgradeFn = (database: Database) => {

		var idbDb = database.idbDb;
		idbDb.createObjectStore(STORE_NAME_OFFLINE_LOG, {autoIncrement: true});
	}
	return getDatabase(DATABASE_NAME_OFFLINE_LOG, 1, upgradeFn);
}

function DeleteLogDatabase (): Promise<any> {
	return deleteDatabase(DATABASE_NAME_OFFLINE_LOG);
}


function mainLoop (): Promise<any> {

	function sendOfflineLog (logEntry: ILogEntry, senderName: string) : Promise<any> {

		var level: string = logEntry.level;
		var time: string = logEntry.time;
		var message: string = logEntry.message;
		var attrs: any = logEntry.attrs;

		if (!registeredSenders[senderName]) {
			console.error('loggingWorker: sendOfflineLog(): sender is not registered: ' + senderName);
			return promiseReject('loggingWorker: sendOfflineLog(): sender is not registered: ' + senderName);
		}

		if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
			console.debug('loggingWorker: sendOfflineLog(): senderName: + ' + senderName + ' message: ' + message);
		}

		return newPromise((resolve, reject) => {
			var hTimeout;
			registeredSenders[senderName].sendLogMessage(level, time, message, attrs).then((v) => {
				resolve(v);
				if (hTimeout) {
					clearTimeout(hTimeout);
				}
			}, (err) => {
				reject(err);
				if (hTimeout) {
					clearTimeout(hTimeout);
				}
			});
			hTimeout = setTimeout(() => {
				console.error('loggingWorker: sendOfflineLog(): send timeout');
				reject('loggingWorker: sendOfflineLog(): send timeout');
			}, SENDER_SEND_TIMEOUT);
		});
	}

	// loop over all messages in  oflline log store get the batch of first n messages and send the batch

	return GetLogDatabase().then((database) => {

		return newPromise((resolve, reject) => {
			// collect the batch of messages to be sent 

			var batch = [];
			var ret = database.openCursor(STORE_NAME_OFFLINE_LOG);
			var idbRequest = ret.idbRequest;
			var idbTransaction = ret.idbTransaction;

			idbTransaction.onerror = (event) => {
				var err = event.target.error
				console.error('loggingWorker: error: ' + err);
				console.dir(err);
				reject(err);
			}

			idbTransaction.onabort = () => {
				console.warn ('loggingWorker: transaction aborted'); 
			}

			idbTransaction.oncomplete = () => {
				resolve(batch);
			}

			idbRequest.onsuccess = (event) => {
				try {
					var idbCursor = event.target.result;

					if (!idbCursor) {
						// no more records to send
						return;
					}

					if (workerCtx.offline) {
						// we are offline, try again later
						return;
					}

					var logEntry: ILogEntry = idbCursor.value;
					var key: any = idbCursor.key;

					// remove entry if it has already been sent via all registered senders or if there was too many unsuccessfull attempts to send

					var remove: boolean 
					remove = _.reduce(logEntry.senders, function (acc, sender) {
						return acc && sender.sentOk;
					}, true) || (logEntry.flushCount >= OFFLINE_LOG_ENTRY_MAX_FLUSH_COUNT)
					if (remove) {
						idbCursor.delete();
						idbCursor.continue();
						return;
					}

					if (batch.length < 5) {
						batch.push({
							key: key,
							logEntry: logEntry
						});
						idbCursor.continue();
					} else {
						return;
					}

				} catch (err) {
					console.error('loggingWorker: error: ');
					console.dir(err);
					reject(err);
				}
			};
			idbRequest.onerror = (event) => {
				try {
					var err = event.target.error
					console.error('loggingWorker: failed to read next offline log entry');
					console.dir(err);
				} catch (err) {
					console.error('loggingWorker: error: ');
					console.dir(err);
				}
			};
		}).then((batch) => {

			// send batch of messages

			function send (logEntry: ILogEntry, key: any) : Promise<any> {
				var promises = _.reduce(logEntry.senders, (acc: any, sender: ILogEntrySender, senderName: string) => {
					if (!sender.sentOk) {
						var promise = sendOfflineLog(logEntry, senderName).then(() => {
							logEntry.flushCount += 1;
							logEntry.senders[senderName].timeSentAt = Date.now();
							logEntry.senders[senderName].sentOk = true;
							return database.putRecord(STORE_NAME_OFFLINE_LOG, logEntry, key);
						}, (err) => {
							logEntry.flushCount += 1;
							logEntry.senders[senderName].errorCounter += 1;
							return database.putRecord(STORE_NAME_OFFLINE_LOG, logEntry, key);
						}); 
						acc.push(promise);
					}
					return acc;
				}, []);
				return promiseAll(promises);
			}
			var promises = _.reduce(batch, (acc: any, v: any) => {
				var promise = send(v.logEntry, v.key);
				acc.push(promise);
				return acc;
			}, []);
			return promiseAll(promises);


		});
	}).catch((err) => {
		console.error('loggingWorker: error: ');
		console.dir(err);
	});
}

function saveOfflineLog (logEntry: ILogEntry): Promise<any> {
	return GetLogDatabase().then((database) => {
		if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
			console.debug('loggingWorker: saving offline log: ' + logEntry.message);
		}
		return database.addRecord(STORE_NAME_OFFLINE_LOG, logEntry)
	});
}

function makeSQSmessage(level: string, time: string, message: string, attrs: any) : any {


	var msg = {
		level: level, 
		time: time,
		message: message,
		deviceId: workerCtx.device.uuid || 'unknown',
		platform: workerCtx.device.platform || 'unknown',
		environment: workerCtx.environment || 'unknown',
		appVersion: workerCtx.appVersion || 'unknown'
	};

	if (attrs) {
		var normAttrs = _.reduce(attrs, function (acc, val, key) {
			if (_.isObject(val) && val.getTime() && val.toISOString()) { // if type of object is Date()
				acc[key] = val.toISOString();
			} else {
				acc[key] = '' + val;
			}
			return acc;
		}, {});
		msg = _.extend(msg, normAttrs); 
	}
	if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
		console.debug('loggingWorker: makeSQSmessage(): workerCtx:' );
		console.dir(workerCtx);
		console.debug('loggingWorker: makeSQSmessage(): msg:' );
		console.dir(msg);
	}
	return msg;
}

class SQSLogSender implements ISender {
	private sqs: any;
	private queueUrl = 'https://sqs.eu-west-1.amazonaws.com/806902423583/logstash_mobile';

	constructor () {}

	sendLogMessage (level: string, time: string, message: string, attrs): Promise<any> {
		return newPromise((resolve, reject) => {
			var request = new XMLHttpRequest();
			request.onreadystatechange = function() {
				if (request.readyState === 4) {
					if (request.status === 200) {
						resolve();
					} else {
						console.error('loggingWorker: SQSLogSender.sendLogMessage(): failed: http status: ' + request.status);
						reject('loggingWorker: SQSLogSender.sendLogMessage(): failed: http status: ' + request.status);
					}
				}
			};
			request.onerror = function (err) {
				console.error('loggingWorker: SQSLogSender.sendLogMessage(): failed: ' + err);
				console.dir(err);
				reject('loggingWorker: SQSLogSender.sendLogMessage(): failed: ' + err);
			}
			request.open("POST", "https://apiv1.cloudempiere.com/alpha/logs/send", true);
			request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

			var msg = makeSQSmessage(level, time, message, attrs);

			var body = JSON.stringify(msg);

			request.send(body);
		});
	}

}

function flushPeriodicallyAllOfflineLogs (period: number) {

	if (workerCtx.offline) {
		setTimeout(function () {
			flushPeriodicallyAllOfflineLogs(period);
		}, period)
		return;
	}
	setTimeout(function () {
		mainLoop().then(function () {
			flushPeriodicallyAllOfflineLogs(period);
		}, function (err) {
			flushPeriodicallyAllOfflineLogs(period);
		})
	}, period)
}

// worker handling

function makeLogEntry (level: string, time: Date, message: string, attrs: any): ILogEntry {
	function makeLogEntrySender (): ILogEntrySender {
		return {
			timeSentAt: 0,
			errorCounter: 0,
			sentOk: false,
		}
	}
	var logEntry = {
		message: message,
		level: level,
		time: time.toISOString(),
		attrs: attrs,
		flushCount: 0,
		senders: {}
	};
	_.each(registeredSenders, (val, key) => {
		logEntry.senders[key] = makeLogEntrySender();
	})
	return logEntry;
}


		
// register all senders
registeredSenders.SQS_SENDER = new SQSLogSender();

// start main loop
flushPeriodicallyAllOfflineLogs(OFFLINE_LOG_ENTRY_FLUSH_INTERVAL); 

bootWorker(function (event) {     
	var msg: IWorkerMessage = event.data;
	if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
		console.debug('loggingWorker: received message: ' +  msg.messageName);
	}

	try {

		if ('log' === msg.messageName) {

			event.ports[0].postMessage({}); // immidatelly reply back with positive ackonwledgemet
			var logEntry = makeLogEntry(msg.messageData.level, msg.messageData.time, msg.messageData.message, msg.messageData.attrs);
			saveOfflineLog(logEntry)
			.catch((err) => {
				console.error('loggingWorker: saveOfflineLog(): error: ' + err);
				console.dir(err);
			});
			return true;
		} 

	} catch (err) {
		console.error('loggingWorker: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err
		});
	}
});    
