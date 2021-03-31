import { getEnvironment } from '../environments/environment';
import { Database, Dcursor } from '../idbDatabase';
import { workerCtx, settings } from './workerCtx';
import { bootWorker } from './worker';
import { IWorkerMessage } from '../types';
import { ILogEventData, ISender, ILogEntry, ILogEntrySender, IRegisteredSenders } from '../loggerCommon';
import { STORE_NAME_OFFLINE_LOG } from '../loggerCommon';
import { GetLogDatabase } from '../loggerDatabase';

import * as _ from 'underscore';

let OFFLINE_LOG_ENTRY_FLUSH_INTERVAL = 1000; // intrval in milliseconds for periodic flush sending of offline logs,
let SENDER_SEND_TIMEOUT = 10 * 1000;
let OFFLINE_LOG_ENTRY_MAX_FLUSH_COUNT = 6; // number of attempts to send offline log entry, if more then 6 attempts offline log entry will be deleted

export let LOG_EVENT_NAME = 'log';

class LogSender implements ISender {
	constructor() {}

	sendLog(attrs: any): Promise<any> {
		return new Promise((resolve, reject) => {
			let request = new XMLHttpRequest();
			request.onreadystatechange = function () {
				if (request.readyState === 4) {
					if (request.status === 200) {
						resolve(undefined);
					} else {
						console.error('loggingWorker: LogSender.sendLog(): failed: http status: ' + request.status);
						reject('loggingWorker: LogSender.sendLog(): failed: http status: ' + request.status);
					}
				}
			};
			request.onerror = function (err) {
				console.error('loggingWorker: LogSender.sendLog(): failed: ' + err);
				console.dir(err);
				reject('loggingWorker: LogSender.sendLog(): failed: ' + err);
			};
			let url = getEnvironment().backendLoggingApiUrl;
			request.open('POST', url, true);
			request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');

			let msg = attrs;

			let body = JSON.stringify(msg);

			request.send(body);
		});
	}
}

let registeredSenders: IRegisteredSenders = {};
registeredSenders.LOG_SENDER = new LogSender();

function makeLogMessage(level: string, time: string, message: string, attrs: any): any {
	let msg = {
		level: level,
		time: time,
		message: message,
	};

	if (attrs) {
		let normAttrs = _.reduce(
			attrs,
			function (acc, val: any, key) {
				if (_.isFunction(val)) {
					return acc;
				}
				if (_.isDate(val)) {
					// if entry_type of object is Date()
					acc[key] = val.toISOString();
				} else {
					acc[key] = '' + val;
				}
				return acc;
			},
			{}
		);
		msg = _.extend(msg, normAttrs);
	}
	if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
		console.log('loggingWorker: makeLogMessage(): workerCtx:');
		console.dir(workerCtx);
		console.log('loggingWorker: makeLogMessage(): msg:');
		console.dir(msg);
	}
	return msg;
}

function mainLoop(): Promise<any> {
	function sendOfflineLog(logEntry: ILogEntry, senderName: string): Promise<any> {
		let attrs: any;
		if (logEntry.entry_type === 'log') {
			let level: string = logEntry.level;
			let time: string = logEntry.time;
			let message: string = logEntry.message;
			let _attrs: any = logEntry.attrs;
			attrs = makeLogMessage(level, time, message, _attrs);
		} else if (logEntry.entry_type === 'event') {
			attrs = logEntry.event;
			attrs.time = logEntry.time;
		}

		if (!registeredSenders[senderName]) {
			console.error('loggingWorker: sendOfflineLog(): sender is not registered: ' + senderName);
			return Promise.reject('loggingWorker: sendOfflineLog(): sender is not registered: ' + senderName);
		}

		if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
			console.log('loggingWorker: sendOfflineLog(): senderName: + ' + senderName);
			console.dir(attrs);
		}

		return new Promise((resolve, reject) => {
			let hTimeout;
			registeredSenders[senderName].sendLog(attrs).then(
				(v) => {
					resolve(v);
					if (hTimeout) {
						clearTimeout(hTimeout);
					}
				},
				(err) => {
					reject(err);
					if (hTimeout) {
						clearTimeout(hTimeout);
					}
				}
			);
			hTimeout = setTimeout(() => {
				console.error('loggingWorker: sendOfflineLog(): send timeout');
				reject('loggingWorker: sendOfflineLog(): send timeout');
			}, SENDER_SEND_TIMEOUT);
		});
	}

	// loop over all messages in  oflline log store to get the batch of first n messages and send the batch

	return GetLogDatabase()
		.then((db) => {
			let database = new Database(db);
			return new Promise((resolve, reject) => {
				// collect the batch of messages to be sent

				let batch = [];

				let dcursor = new Dcursor();
				let dresult = database.openWriteCursor(STORE_NAME_OFFLINE_LOG, dcursor);
				let transaction = dresult.transaction;
				let request = dresult.request;

				transaction.onerror = (event) => {
					let err = event.target.error;
					console.error('loggingWorker: error: ' + err);
					console.dir(err);
					reject(err);
				};

				transaction.onabort = () => {
					console.warn('loggingWorker: transaction aborted');
				};

				transaction.oncomplete = () => {
					resolve(batch);
				};

				request.onsuccess = (event) => {
					try {
						let cursor = event.target.result;

						if (!cursor) {
							// no more records to send
							return;
						}

						if (workerCtx.offline) {
							// we are offline, try again later
							return;
						}

						let logEntry: ILogEntry = cursor.value;
						let key: any = cursor.key;

						// remove entry if it has already been sent via all registered senders or if there was too many unsuccessfull attempts to send

						let remove: boolean;
						remove =
							_.reduce(
								logEntry.senders,
								function (acc, sender) {
									return acc && sender.sentOk;
								},
								true
							) || logEntry.flush_count >= OFFLINE_LOG_ENTRY_MAX_FLUSH_COUNT;
						if (remove) {
							cursor.delete();
							cursor.continue();
							return;
						}

						if (batch.length < 5) {
							batch.push({
								key: key,
								logEntry: logEntry,
							});
							cursor.continue();
						} else {
							return;
						}
					} catch (err) {
						console.error('loggingWorker: error: ');
						console.dir(err);
						reject(err);
					}
				};
				request.onerror = (event) => {
					try {
						let err = event.target.error;
						console.error('loggingWorker: failed to read next offline log entry');
						console.dir(err);
					} catch (err) {
						console.error('loggingWorker: error: ');
						console.dir(err);
					}
				};
			}).then((batch) => {
				// send batch of messages

				function send(logEntry: ILogEntry, key: any): Promise<any> {
					let promises = _.reduce(
						logEntry.senders,
						(acc: any, sender: ILogEntrySender, senderName: string) => {
							try {
								if (!sender.sentOk) {
									let promise = sendOfflineLog(logEntry, senderName)
										.then(
											() => {
												logEntry.flush_count += 1;
												logEntry.senders[senderName].timeSentAt = Date.now();
												logEntry.senders[senderName].sentOk = true;
												return database.putRecord(STORE_NAME_OFFLINE_LOG, logEntry, key);
											},
											(err) => {
												console.error('loggingWorker: sendOfflineLog(), 1, error: ');
												console.dir(err);
												logEntry.flush_count += 1;
												logEntry.senders[senderName].errorCounter += 1;
												return database.putRecord(STORE_NAME_OFFLINE_LOG, logEntry, key);
											}
										)
										.catch((err) => {
											console.error('loggingWorker: sendOfflineLog(), 2, error: ');
											console.dir(err);
											logEntry.flush_count += 1;
											logEntry.senders[senderName].errorCounter += 1;
											return database.putRecord(STORE_NAME_OFFLINE_LOG, logEntry, key);
										});
									acc.push(promise);
								}
								return acc;
							} catch (err) {
								console.error('loggingWorker: sendOfflineLog(), 3, error: ');
								console.dir(err);
								logEntry.flush_count += 1;
								logEntry.senders[senderName].errorCounter += 1;
								return database.putRecord(STORE_NAME_OFFLINE_LOG, logEntry, key);
							}
						},
						[]
					);
					return Promise.all(promises);
				}
				let promises = _.reduce(
					batch,
					(acc: any, v: any) => {
						let promise = send(v.logEntry, v.key);
						acc.push(promise);
						return acc;
					},
					[]
				);
				return Promise.all(promises);
			});
		})
		.catch((err) => {
			console.error('loggingWorker: sending batch, error: ');
			console.dir(err);
		});
}

function flushPeriodicallyAllOfflineLogs(period: number) {
	if (workerCtx.offline) {
		setTimeout(function () {
			flushPeriodicallyAllOfflineLogs(period);
		}, period);
		return;
	}
	setTimeout(function () {
		mainLoop().then(
			function () {
				flushPeriodicallyAllOfflineLogs(period);
			},
			function () {
				flushPeriodicallyAllOfflineLogs(period);
			}
		);
	}, period);
}

// start main loop
flushPeriodicallyAllOfflineLogs(OFFLINE_LOG_ENTRY_FLUSH_INTERVAL);

bootWorker(function (event) {
	let msg: IWorkerMessage = event.data;
	if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
		console.log('loggingWorker: received message: ' + msg.messageName);
	}

	try {
	} catch (err) {
		console.error('loggingWorker: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
});
