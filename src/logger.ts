import { LoggerProvider, LogLevel, Logger as CldeLogger, LoggerConfig, GetLoggerFn } from '@cloudempiere/clde-types/dist/logger';

import { waitFor } from './common/utils';
import { Principal } from './types';
import { DeviceInfo } from './types';
import { Logger } from './types';
import { EventSource } from './eventSource';
import { getEnvironment } from './environments/environment';
import { ILogEntry, ILogEntrySender } from './loggerCommon';
import { saveOfflineLog } from './loggerDatabase';
import { isRunningInWorker } from './workers/workerCtx';
import { isPlainObject } from 'is-plain-object';
import { getExecutionContext } from './executionContext';
import { fetch, newRequest } from './fetch';

import * as _ from 'underscore';

const PROJECT = 'cd-www';
const FILE = 'logger.ts';

let worker;
let workerId;
let workerName;

let offline;
let principal: Principal;

export let loggerCtx: any = {};

function initFinished(): Promise<any> {
	let werr = new Error('logger.ts:initFinished(): workerId >= 0 || isRunningInWorker.isRunningInWorker || getExecutionContext.isServerSide');
	return waitFor(function () {
		return workerId >= 0 || isRunningInWorker.isRunningInWorker || getExecutionContext().isServerSide;
	}, werr);
}

EventSource.offlineEventSource.source.subscribe(function (_offline) {
	offline = _offline;
});

EventSource.principalChangeEventSource.source.subscribe(function (_principal: Principal) {
	principal = _principal;
});

let registeredSenders = ['LOG_SENDER'];

function addCommonAttributes(_attrs: any) {
	let attrs = { ..._attrs };
	let executionContext = getExecutionContext();
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
	attrs.isServerSide = executionContext.isServerSide;
	if (executionContext.isServerSide === true) {
		attrs.offline = false;
	} else {
		attrs.offline = offline;
	}
	attrs.appVersion = loggerCtx.appVersion || 'unknown';
	attrs.environment = loggerCtx.environment || 'unknown';
	if (loggerCtx.device) {
		attrs.deviceId = loggerCtx.device.uuid || 'unknown';
		attrs.platform = loggerCtx.device.platform || 'unknown';
	} else {
		attrs.deviceId = 'unknown';
		attrs.platform = 'unknown';
	}
	return attrs;
}

function makeLogEntry(level: string, time: Date, message: string, attrs: any): ILogEntry {
	function makeLogEntrySender(): ILogEntrySender {
		return {
			timeSentAt: 0,
			errorCounter: 0,
			sentOk: false,
		};
	}
	let logEntry = {
		entry_type: 'log',
		message: message,
		level: level,
		time: time.toISOString(),
		attrs: addCommonAttributes(attrs),
		flush_count: 0,
		senders: {},
	};
	registeredSenders.forEach((senderName: string) => {
		logEntry.senders[senderName] = makeLogEntrySender();
	});
	return logEntry;
}

function makeLogEventEntry(time: Date, attrs: any): ILogEntry {
	function makeLogEntrySender(): ILogEntrySender {
		return {
			timeSentAt: 0,
			errorCounter: 0,
			sentOk: false,
		};
	}
	let logEntry = {
		entry_type: 'event',
		time: time.toISOString(),
		attrs: addCommonAttributes({}),
		event: attrs,
		flush_count: 0,
		senders: {},
	};
	registeredSenders.forEach((senderName: string) => {
		logEntry.senders[senderName] = makeLogEntrySender();
	});
	return logEntry;
}

function sendLogEntry(logEntry: ILogEntry): Promise<any> {
	const FUNC = 'sendLogEntry()';
	let executionContext = getExecutionContext();
	if (executionContext.isServerSide) {
		return fetch(
			newRequest(getEnvironment().backendLoggingApiUrl, {
				method: 'POST',
				body: JSON.stringify(logEntry.event),
				headers: { 'Content-Type': 'application/json' },
			})
		).then((res) => {
			if (!res.ok) {
				console.error(`${FILE}:${FUNC}: failed, isServerSide: ${executionContext.isServerSide}`);
			}
		});
	} else {
		return saveOfflineLog(logEntry).catch((err) => {
			console.error(`${FILE}:${FUNC}: failed, isServerSide: ${executionContext.isServerSide}`);
		});
	}
}

export function sendLogMessage(level: string, time: Date, message: string, attrs: any) {
	const FUNC = 'sendLogMessage()';
	return initFinished()
		.then(function () {
			if (!attrs) {
				attrs = {};
			}
			let logEntry = makeLogEntry(level, time, message, attrs);
			return sendLogEntry(logEntry);
		})
		.catch((err) => {
			console.error(`${FILE}:${FUNC}: error: `, err);
		});
}

export function sendLogEvent(time: Date, attrs: any): Promise<any> {
	const FUNC = 'sendLogEvent()';
	return initFinished()
		.then(function () {
			if (!attrs) {
				attrs = {};
			}
			let logEntry = makeLogEventEntry(time, attrs);
			return sendLogEntry(logEntry);
		})
		.catch((err) => {
			console.error(`${FILE}:${FUNC}: error: `, err);
		});
}

export let getLoggerProvider = (): LoggerProvider => {
	const FUNC = 'LoggerProviderFn()';

	let currentLogLevel = LogLevel.INFO;
	let isConsoleLogOnly = false;

	let logLevelTostr = (logLevel: LogLevel): string => {
		if (logLevel === LogLevel.DEBUG) {
			return 'DEBUG';
		} else if (logLevel === LogLevel.INFO) {
			return 'INFO';
		} else if (logLevel === LogLevel.WARN) {
			return 'WARN';
		} else if (logLevel === LogLevel.ERROR) {
			return 'ERROR';
		} else {
			throw new Error(`${PROJECT}:${FILE}:${FUNC}: unkonwn logLevel: ${logLevel}`);
		}
	};

	let getLoggerFn = (projectName: string, fileName: string): CldeLogger => {
		let logFn = (logLevel: LogLevel, functionName: string, message: string, errOrAttrs?: any, attrs?: any): void => {
			let isError = function (e) {
				return e && e.stack && e.message && typeof e.stack === 'string' && typeof e.message === 'string';
			};

			if (isError(errOrAttrs)) {
				message = message + ' ' + errOrAttrs;
			} else {
				attrs = errOrAttrs;
			}
			if (!attrs) {
				attrs = {};
			}

			if (!isPlainObject(attrs)) {
				attrs = {};
			}

			if (logLevel === LogLevel.ERROR) {
				console.error(`${projectName}:${fileName}:${functionName}: ${message}`);
			} else if (logLevel === LogLevel.WARN) {
				console.warn(`${projectName}:${fileName}:${functionName}: ${message}`);
			} else {
				console.log(`${projectName}:${fileName}:${functionName}: ${message}`);
			}

			if (attrs) {
				console.dir(attrs);
			}

			// send log message to logging worker thread
			attrs.projectName = projectName;
			attrs.fileName = fileName;
			attrs.functionName = functionName;
			if (!isConsoleLogOnly) {
				sendLogMessage(logLevelTostr(logLevel), new Date(), `${projectName}:${fileName}:${functionName}: ${message}`, attrs);
			}
		};

		return {
			debug: (functionName: string, message: string, err?: any, attrs?: any): void => {
				if (currentLogLevel <= LogLevel.DEBUG) {
					logFn(LogLevel.DEBUG, functionName, message, err, attrs);
				}
			},

			info: (functionName: string, message: string, err?: any, attrs?: any): void => {
				if (currentLogLevel <= LogLevel.INFO) {
					logFn(LogLevel.INFO, functionName, message, err, attrs);
				}
			},

			warn: (functionName: string, message: string, err?: any, attrs?: any): void => {
				if (currentLogLevel <= LogLevel.WARN) {
					logFn(LogLevel.WARN, functionName, message, err, attrs);
				}
			},

			error: (functionName: string, message: string, err?: any, attrs?: any): void => {
				if (currentLogLevel <= LogLevel.ERROR) {
					logFn(LogLevel.ERROR, functionName, message, err, attrs);
				}
			},

			event: (attrs: any): void => {
				sendLogEvent(new Date(), attrs);
			},
		};
	};

	let configureFn = (cfg: LoggerConfig): void => {
		if (cfg.logLevel) {
			currentLogLevel = cfg.logLevel;
		}
		if (cfg.hasOwnProperty('isConsoleLogOnly')) {
			isConsoleLogOnly = cfg.isConsoleLogOnly;
		}
	};

	return {
		getLogger: getLoggerFn,
		configure: configureFn,
	};
};

let loggerProvider: LoggerProvider = getLoggerProvider();

export let getLogger: GetLoggerFn = loggerProvider.getLogger;

export function configureLogger(cfg: LoggerConfig) {
	loggerProvider.configure(cfg);
}

export function setLoggerProvider(_loggerProvider: LoggerProvider) {
	loggerProvider = _loggerProvider;
	getLogger = loggerProvider.getLogger;
}

export function loggerWorkerMessageHandler(event) {
	try {
		event.ports[0].postMessage({
			err: 'unknow messageName',
		});
	} catch (err) {
		console.error('logger: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}

export function loggerSetWorker(_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
}

/**
 * This needs to be called immidiatelly after angular application boots, i.e. in AppComponent.constructor()
 */

export async function initLoggerForMobile(appVersion: string, deviceInfo: DeviceInfo) {
	loggerCtx.appVersion = appVersion;
	loggerCtx.device = deviceInfo;

	loggerCtx.environment = getEnvironment().name;
	loggerCtx.applicationName = getEnvironment().applicationName;
}

/**
 * This needs to be called immidiatelly after angular application boots, i.e. in AppComponent.constructor()
 */

export async function initLoggerForBrowser(appVersion: string, deviceInfo: DeviceInfo) {
	loggerCtx.appVersion = appVersion;
	loggerCtx.device = deviceInfo;

	loggerCtx.environment = getEnvironment().name;
	loggerCtx.applicationName = getEnvironment().applicationName;
}
