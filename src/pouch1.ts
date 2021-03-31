import { PROJECT_NAME } from './consts';
import { IWorkerMessage } from './types';
import { waitFor } from './common/utils';
import { Logger } from './types';
import { getLogger } from './logger';
import { EventSource } from './eventSource';
import { getExecutionContext } from './executionContext';

const FILE = 'pouch1.ts';

let logger = getLogger(PROJECT_NAME, 'pouch1.ts');

import * as _ from 'underscore';

let worker;
let workerId;
let workerName: string;

function initFinished(): Promise<any> {
	let werr = new Error('pouch1.ts:initFinished(): workerId >= 0');
	return waitFor(function () {
		return workerId >= 0;
	}, werr);
}

export let pouch: any = {
	isRunning: false,
};

async function start() {
	const FUNC = 'start()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	const startD = Date.now();
	logger.info(FUNC, `pouch start ...`);

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchStart',
			messageData: {},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: start()`, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(undefined);
		};
	}).then(() => {
		pouch.isRunning = true;

		const endD = Date.now();
		logger.info(FUNC, `pouch started in ${endD - startD} ms`);
	});
}
pouch.start = start;

async function stop() {
	const FUNC = 'stop()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	const startD = Date.now();
	logger.info(FUNC, `pouch stop ...`);

	await initFinished();

	pouch.isRunning = false;
	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchStop',
			messageData: {},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: stop(): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(undefined);
		};
	}).then((v) => {
		const endD = Date.now();
		logger.info(FUNC, `pouch stopped in ${endD - startD} ms`);
		return v;
	});
}
pouch.stop = stop;

async function createDoc(doc: any, id?: string) {
	const FUNC = 'createDoc()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	if (!id) {
		id = null;
	}

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchCreateDoc',
			messageData: {
				doc: doc,
				id: id,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: createDoc(${id}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.createDoc = createDoc;

async function updateDoc(doc: any, force?: boolean) {
	const FUNC = 'updateDoc()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchUpdateDoc',
			messageData: {
				doc: doc,
				force: force,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				try {
					let _err = JSON.parse(event.data.err);
					if (_err.name === 'conflict') {
						reject(event.data.err);
						return;
					}
					logger.error(FUNC, `pouch: updateDoc(${doc._id}, ${doc._rev}):`, event.data.err);
					reject(event.data.err);
					return;
				} catch (e) {
					logger.error(FUNC, `pouch: updateDoc(${doc._id}, ${doc._rev}): `, event.data.err);
					reject(event.data.err);
					return;
				}
			}
			resolve(event.data.result);
		};
	});
}
pouch.updateDoc = updateDoc;

async function deleteDoc(docOrId: any, rev?: string) {
	const FUNC = 'deleteDoc()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	if (!rev) {
		rev = null;
	}

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchDeleteDoc',
			messageData: {
				docOrId: docOrId,
				rev: rev,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				try {
					let _err = JSON.parse(event.data.err);
					if (_err.name === 'conflict') {
						reject(event.data.err);
						return;
					}
					logger.error(FUNC, `pouch: deleteDoc(${docOrId}, ${rev}): `, event.data.err);
					reject(event.data.err);
					return;
				} catch (e) {
					logger.error(FUNC, `pouch: deleteDoc(${docOrId}, ${rev}): `, event.data.err);
					reject(event.data.err);
					return;
				}
			}
			resolve(event.data.result);
		};
	});
}
pouch.deleteDoc = deleteDoc;

// If 'noNotFoundError' is true return undefined if document is not found and does not report error.
async function getDoc(id: string, noNotFoundError?: boolean) {
	const FUNC = 'getDoc()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchGetDoc',
			messageData: {
				id: id,
				noNotFoundError: noNotFoundError,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: getDoc(${id}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.getDoc = getDoc;

async function query(view: string, options?: any) {
	const FUNC = 'query()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	if (!options) {
		options = null;
	}

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchQuery',
			messageData: {
				view: view,
				options: options,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: query(${view}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.query = query;

async function find(selector: any) {
	const FUNC = 'find()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchFind',
			messageData: {
				selector: selector,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: find(${JSON.stringify(selector)}):  `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.find = find;

async function getLocks(documentName: string) {
	const FUNC = 'getLocks()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchGetLocks',
			messageData: {
				documentName: documentName,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `${FILE}:${FUNC}: pouch: getLocks(${documentName}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.getLocks = getLocks;

async function getLock(documentName: string, id: string) {
	const FUNC = 'getLock()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchGetLock',
			messageData: {
				documentName: documentName,
				id: id,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: getLock(${documentName}, ${id}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.getLock = getLock;

async function setLock(documentName: string, id: string, principal: any) {
	const FUNC = 'setLock()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchSetLock',
			messageData: {
				documentName: documentName,
				id: id,
				principal: principal,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: setLock(${documentName}, ${id}, ${principal.adUserId}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.setLock = setLock;

async function removeLock(documentName: string, id: string) {
	const FUNC = 'removeLock()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchRemoveLock',
			messageData: {
				documentName: documentName,
				id: id,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: removeLock(${documentName}, ${id}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.removeLock = removeLock;

async function getDb() {
	return new Promise<any>((resolve) => {
		return resolve({
			find: find,
			query: query,
		});
	});
}
pouch.getDb = getDb;

async function getUserData(userUuid: string) {
	const FUNC = 'getUserData()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchGetUserData',
			messageData: {
				userUuid: userUuid,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: getUserData(${userUuid}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.getUserData = getUserData;

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
				messageName: 'pouchTest',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					logger.error(FUNC, `${FILE}:${FUNC}: pouch: test(): `, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data.group);
			};
		});
	});
}
pouch.test = test;

async function setUserData(userUuid: string, userData: any) {
	const FUNC = 'setUserData()';

	if (getExecutionContext().isServerSide) {
		logger.error(FUNC, 'server side: call ignored');
		return Promise.reject(new Error('server side: call ignored'));
	}

	await initFinished();

	return new Promise<any>(function (resolve, reject) {
		let channel = new MessageChannel();
		let msg: IWorkerMessage = {
			workerId: workerId,
			workerName: workerName,
			messageName: 'pouchSetUserData',
			messageData: {
				userUuid: userUuid,
				userData: userData,
			},
		};

		worker.postMessage(msg, [channel.port2]);

		channel.port1.onmessage = function (event) {
			if (event.data.err) {
				logger.error(FUNC, `pouch: setUserData(${userUuid}): `, event.data.err);
				reject(event.data.err);
				return;
			}
			resolve(event.data.result);
		};
	});
}
pouch.setUserData = setUserData;

export function pouchWorkerMessageHandler(event) {
	let msg: IWorkerMessage = event.data;

	try {
		if ('pouchDocChange' === msg.messageName) {
			event.ports[0].postMessage({});
			if (msg.messageData.deleted) {
				EventSource.pouchLockChangeEventSource.generateEvent(msg.messageData);
				EventSource.pouchDocumentChangeEventSource.generateEvent(msg.messageData);
			} else {
				if (msg.messageData.documentName === 'AD_Private_Access') {
					EventSource.pouchLockChangeEventSource.generateEvent(msg.messageData);
				} else {
					EventSource.pouchDocumentChangeEventSource.generateEvent(msg.messageData);
				}
			}
		} else if ('pouchMessageRateLimit' === msg.messageName) {
			event.ports[0].postMessage({});
			let isOverLimit: boolean = msg.messageData.isOverLimit;
			EventSource.pouchMessageRateOverLimit.generateEvent(isOverLimit);
		} else {
			// reply back with negative ackonwledgemet
			event.ports[0].postMessage({
				err: 'unknow messageName',
			});
		}
	} catch (err) {
		console.error('pouch: error: ');
		console.dir(err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}

export function pouchSetWorker(_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
}
