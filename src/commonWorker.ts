import { PROJECT_NAME } from './consts';
import { IWorkerMessage } from './types';
import { waitFor } from './common/utils';
import { Logger } from './types';
import { Principal } from './types';
import { getLogger } from './logger';
import { isRunningInWorker, savedPrincipal } from './workers/workerCtx';

const FILE = 'src/commonWorker.ts';

let logger = getLogger(PROJECT_NAME, 'src/commonWorker.ts');

let worker;
let workerId;
let workerName: string;

function initFinished(): Promise<any> {
	let werr = new Error(`${FILE}:initFinished(): workerId >= 0`);
	return waitFor(function () {
		return workerId >= 0;
	}, werr);
}

export async function getPrincipal() {
	const FUNC = 'getPrincipal()';

	if (!isRunningInWorker.isRunningInWorker) {
		await initFinished();

		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'getPrincipal',
				messageData: {},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					let errs = `error: ${event.data.err}`;
					logger.error(FUNC, errs, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data.principal);
			};
		});
	} else {
		return getPrincipalIfRunningInWorker();
	}
}

function getPrincipalIfRunningInWorker() {
	return savedPrincipal.savedPrincipal;
}

export async function setPrincipal(principal: Principal) {
	const FUNC = 'setPrincipal()';

	if (!isRunningInWorker.isRunningInWorker) {
		await initFinished();

		return new Promise<any>(function (resolve, reject) {
			let channel = new MessageChannel();
			let msg: IWorkerMessage = {
				workerId: workerId,
				workerName: workerName,
				messageName: 'setPrincipal',
				messageData: {
					principal: principal,
				},
			};

			worker.postMessage(msg, [channel.port2]);

			channel.port1.onmessage = function (event) {
				if (event.data.err) {
					let errs = `error: ${event.data.err}`;
					logger.error(FUNC, errs, event.data.err);
					reject(event.data.err);
					return;
				}
				resolve(event.data.principal);
			};
		});
	} else {
		return setPrincipalIfRunningInWorker(principal);
	}
}

function setPrincipalIfRunningInWorker(principal: Principal) {
	savedPrincipal.savedPrincipal = principal;
}

export function commonWorkerMessageHandler(event) {
	const FUNC = 'commonWorkerMessageHandler()';

	try {
	} catch (err) {
		let errs = `error: ${err}`;
		logger.error(FUNC, errs, err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}

export function commonWorkerSetWorker(_worker, _workerId, _workerName) {
	worker = _worker;
	workerId = _workerId;
	workerName = _workerName;
}
