import { PROJECT_NAME } from '../consts';
import { getEnvironment } from '../environments/environment';
import { IWorkerMessage } from '../types';
import { Principal } from '../types';
import { Logger } from '../types';
import { getLogger } from '../logger';
import { bootWorker } from './worker';
import { workerCtx, settings, savedPrincipal } from './workerCtx';
import { authPrincipal } from '../authprincipal';
import { sendMessage } from './common';
import { pingHttp } from '../pinghttp';
import { webServicePlain } from '../webserviceplain';

import * as _ from 'underscore';

const DEBUG_WORKER = false;

let logger = getLogger(PROJECT_NAME, 'commonWorker.ts');

function refreshPrincipalTokens(): Promise<any> {
	const FUNC = 'refreshPrincipal()';
	return webServicePlain.sessionGetToken().then((data) => {
		if (!savedPrincipal.savedPrincipal) {
			return;
		}
		if (!data.accessToken) {
			let err = new Error(`no access token received`);
			logger.error(FUNC, `error: `, err);
			return Promise.reject(err);
		}
		savedPrincipal.savedPrincipal.accessToken = data.accessToken;
		if (!data.accessToken) {
			let err = new Error(`no access token received`);
			logger.error(FUNC, `error: `, err);
			return Promise.reject(err);
		}
		savedPrincipal.savedPrincipal.cubejsToken = data.cubejsToken;
	});
}

function setPrincipal(principal: Principal) {
	savedPrincipal.savedPrincipal = principal;
}

function getPrincipal(): Principal {
	return savedPrincipal.savedPrincipal;
}

function init() {}

bootWorker(function (event) {
	const FUNC = 'bootWorker()';
	let msg: IWorkerMessage = event.data;

	try {
		if (settings.settings.isDebug && DEBUG_WORKER) {
			console.log('commonWorker: received message: ' + msg.messageName);
		}

		if ('getPrincipal' === msg.messageName) {
			event.ports[0].postMessage({
				principal: getPrincipal(),
			});
			return true;
		}

		if ('setPrincipal' === msg.messageName) {
			let principal: Principal = msg.messageData.principal;
			setPrincipal(principal);
			event.ports[0].postMessage({});
			return true;
		}
	} catch (err) {
		let errs = `error: ${err}`;
		logger.error(FUNC, errs, err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}, init);
