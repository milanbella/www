import { PROJECT_NAME } from './consts';
import { IWorkerMessage } from './types';
import { getLogger } from './logger';
import { waitFor } from './common/utils';
import { authPrincipal } from './authprincipal';
import { Group } from './typesStompGroups';
import { EventSource } from './eventSource';
import { getExecutionContext } from './executionContext';

import * as _ from 'underscore';

const FILE = 'stomp.ts';
let logger = getLogger(PROJECT_NAME, 'stomp.ts');

export let stomp;
stomp = {};

let worker;
let workerId;
let workerName: string;

function initFinished(): Promise<any> {
	let werr = new Error('stomp.ts:initFinished(): workerId >= 0');
	return waitFor(function () {
		return workerId >= 0;
	}, werr);
}

stomp.start = function (queueNames: string[]): Promise<any> {
	const FUNC = 'stomp.start()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	if (!queueNames) {
		throw new Error('missing queue names');
	}
	return initFinished().then(function () {
		return authPrincipal.getPrincipal().then(function () {
			//  Webworker might have refreshed access token. Calling getPrincipal() ensures that new principal is casshed in main thread.

			return new Promise<any>(function (resolve, reject) {
				let channel = new MessageChannel();
				let msg: IWorkerMessage = {
					workerId: workerId,
					workerName: workerName,
					messageName: 'stompStart',
					messageData: {
						queueNames: queueNames,
					},
				};

				worker.postMessage(msg, [channel.port2]);

				channel.port1.onmessage = function (event) {
					if (event.data.err) {
						logger.error(FUNC, `stomp: start(): `, event.data.err);
						reject(event.data.err);
						return;
					}
					resolve(undefined);
				};
			});
		});
	});
};

stomp.stop = function (): Promise<any> {
	const FUNC = 'stomp.stop()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'stompStop',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `stomp: stop(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(undefined);
			};
		});
	});
};

stomp.pause = function (): Promise<any> {
	const FUNC = 'stomp.pause()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'stompPause',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `stomp: pause(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(undefined);
			};
		});
	});
};

stomp.resume = function () {
	const FUNC = 'stomp.resume()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'stompResume',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `stomp: resume(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(undefined);
			};
		});
	});
};

stomp.getGroups = function (): Promise<Group[]> {
	const FUNC = 'stomp.getGroups()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'stompGetGroups',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `stomp: getGroups(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data.groups);
			};
		});
	});
};

stomp.getGroup = function (id: string): Promise<Group> {
	const FUNC = 'stomp.getGroup()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'stompGetGroup',
				messageData: {
					id: id,
				},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `stomp: getGroups(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data.group);
			};
		});
	});
};

async function test() {
	const FUNC = 'test()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	return initFinished().then(function () {
		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'stompTest',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `stomp: test(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data.group);
			};
		});
	});
}
stomp.test = test;

export function stompWorkerMessageHandler(event) {
	const FUNC = 'stompWorkerMessageHandler()';
	let msg: IWorkerMessage = event.data;
	try {
		if ('stompMessageRateLimit' === msg.messageName) {
			event.ports[0].postMessage({});
			let isOverLimit: boolean = msg.messageData.isOverLimit;
			EventSource.stompMessageRateOverLimit.generateEvent(isOverLimit);
		} else {
			// reply back with negative ackonwledgemet
			event.ports[0].postMessage({
				err: 'unknow messageName',
			});
		}
	} catch (err) {
		console.error(`${FILE}:${FUNC}: stomp: error: `, err);
		console.error(`${FILE}:${FUNC}: stomp: error: `, err);
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}

export function stompSetWorker(_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
}
