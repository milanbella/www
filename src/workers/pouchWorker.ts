import { PROJECT_NAME } from '../consts';
import { getEnvironment } from '../environments/environment';
import { IWorkerMessage } from '../types';
import { Principal } from '../types';
import { makeMessageRateCounterEventSource } from '../eventSource';
import { createIndexes } from '../providers/pouchDbIndexes';
import { Logger } from '../types';
import { getLogger } from '../logger';
import { bootWorker } from './worker';
import { workerCtx, settings } from './workerCtx';
import { authPrincipal } from '../authprincipal';
import { sendMessage } from './common';
import { pingHttp } from '../pinghttp';
import { CouchDbVersion, CouchDbAdminDoc } from '../types';
import { getCouchClientDbName, getCouchAdminDbName } from '../commonLib';

import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import PouchDBDebug from 'pouchdb-debug';
import * as _ from 'underscore';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBDebug);

let logger = getLogger(PROJECT_NAME, 'pouchWorker.ts');
let logEvent = { event: 'pouchWorker' };

const DB_NAME = 'PouchDb';
const CONTROL_DB_NAME = 'PouchControlDb';

function BACKEND_COUCH_DB_API_URL() {
	return getEnvironment().backendCouchDbApiUrl;
}

function COUCH_DB_ADMIN_DOC_NAME() {
	return getEnvironment().couchDbAdminDocName;
}

function POUCH_DB_ADMIN_DOC_NAME() {
	return COUCH_DB_ADMIN_DOC_NAME();
}

let localDb;
let remoteDb;
let hChanges;
let hSync;

let DEBUG_SYNC: boolean = true;
let DEBUG_WORKER: boolean = false;

let messageRateCounterEventSource;
let messageRateCounterEventSourceSubscription;

interface PouchDbAdminDoc {
	version: string;
}

function sendMessageRateLimit(isOverLimit: boolean) {
	let msg: IWorkerMessage = {
		workerId: workerCtx.workerId,
		workerName: workerCtx.workerName,
		messageName: 'pouchMessageRateLimit',
		messageData: {
			isOverLimit: isOverLimit,
		},
	};
	sendMessage(msg);
	if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_WORKER) {
		console.log(`pouchWorker: message rate over limit: ${isOverLimit}`);
	}
}

async function start() {
	const FUNC = 'start()';

	function isOffline(): Promise<any> {
		return pingHttp().then(
			() => {
				return false;
			},
			() => {
				return true;
			}
		);
	}

	logger.info(FUNC, `start(): start pouchdb ...`);

	// Clean up in case stop() was not called.
	if (hChanges) {
		hChanges.cancel();
		hChanges = null;
	}
	if (hSync) {
		hSync.cancel();
		hSync = null;
	}
	if (messageRateCounterEventSourceSubscription) {
		messageRateCounterEventSourceSubscription.unsubscribe();
		messageRateCounterEventSourceSubscription = null;
	}
	messageRateCounterEventSource = makeMessageRateCounterEventSource(settings.settings.pouchMessageRateIndicationWindowMilliseconds, settings.settings.pouchMessageRateIndicationLimitCount);

	PouchDB.debug.disable();

	let _offline = await isOffline();
	if (!_offline) {
		let principal = await authPrincipal.getPrincipal();
		if (!principal) {
			logger.error(FUNC, `start(): start: pouch not started: no principal: did you already log in ?`);
			return;
		}

		messageRateCounterEventSourceSubscription = messageRateCounterEventSource.subject.subscribe((isOverLimit: boolean) => {
			sendMessageRateLimit(isOverLimit);
		});

		// Open local database and start syncing.
		// If server has new database vesion drop and create local database and start syncing with new database vesion.

		try {
			let ret = await openLocalDbAndRemoteDbAtVersion(principal);
			localDb = ret.localDb;
			remoteDb = ret.remoteDb;
			hSync = sync(localDb, remoteDb);
			hChanges = changes(localDb);
			await createIndexes(localDb, logger);
		} catch (err) {
			logger.error(FUNC, `start(): error: ${err}`, err);
			throw err;
		}
	} else {
		logger.error(FUNC, `network is offline,  database will not be syncing`);
		localDb = openDb();
	}

	logger.info(FUNC, `start(): started ok`);
}

async function stop() {
	const FUNC = 'stop()';

	logger.info(FUNC, `stop(): stop pouchdb`);

	if (hChanges) {
		hChanges.cancel();
		hChanges = null;
	}
	if (hSync) {
		hSync.cancel();
		hSync = null;
	}
}

function openDb(): any {
	return new PouchDB(DB_NAME, {
		auto_compaction: true,
		adapter: 'idb',
	});
}

function openControlDb(): any {
	return new PouchDB(CONTROL_DB_NAME, {
		auto_compaction: true,
		adapter: 'idb',
	});
}

function openRemoteDb(version, x_auth_username): any {
	let url = `${BACKEND_COUCH_DB_API_URL()}/${version}`;
	return new PouchDB(url, {
		skip_setup: true,

		fetch: function (url, opts) {
			opts.headers.set('X-Auth-CouchDB-UserName', x_auth_username);
			return PouchDB.fetch(url, opts);
		},
	});
}

function getDbVersions(adClientId, x_auth_username): Promise<CouchDbVersion[]> {
	const FUNC = 'getDbVersions()';

	let db = getCouchAdminDbName(adClientId);
	let url = `${BACKEND_COUCH_DB_API_URL()}/${db}`;
	let adminDb = new PouchDB(url, {
		skip_setup: true,

		fetch: function (url, opts) {
			opts.headers.set('X-Auth-CouchDB-UserName', x_auth_username);
			return PouchDB.fetch(url, opts);
		},
	});
	return adminDb.get(COUCH_DB_ADMIN_DOC_NAME()).then(
		(r: CouchDbAdminDoc) => {
			logger.info(FUNC, `getting db versions from ${url}, doc: ${COUCH_DB_ADMIN_DOC_NAME()}: ${JSON.stringify(r)}`);
			return r.versions;
		},
		(err) => {
			if (err.name === 'not_found') {
				logger.info(FUNC, `getting db versions from ${url}, doc: ${COUCH_DB_ADMIN_DOC_NAME()}: no versions found`);
				return [];
			}
			logger.error(FUNC, `error: ${err}`, err);
			return Promise.reject(err);
		}
	);
}

function getLocalDbVersion(controlDb): Promise<string> {
	const FUNC = 'getLocalDbVersion()';
	return controlDb.get(POUCH_DB_ADMIN_DOC_NAME()).then(
		(r: PouchDbAdminDoc) => {
			return r.version;
		},
		(err) => {
			if (err.name === 'not_found') {
				return;
			}
			logger.error(FUNC, `error: ${err}`, err);
			return Promise.reject(err);
		}
	);
}

function writeLocalDbVersion(controlDb, version: string): Promise<void> {
	const FUNC = 'writeLocalDbVersion()';
	return controlDb.get(POUCH_DB_ADMIN_DOC_NAME()).then(
		(r) => {
			r.version = version;
			return controlDb.put(r);
		},
		(err) => {
			if (err.name === 'not_found') {
				return controlDb.put({ _id: POUCH_DB_ADMIN_DOC_NAME(), version: version });
			}
			logger.error(FUNC, `error: ${err}`, err);
			return Promise.reject(err);
		}
	);
}

async function openLocalDbAndRemoteDbAtVersion(principal: Principal) {
	let FUNC = 'openLocalDbAndRemoteDbAtVersion()';
	let localDb, remoteDb;

	let controlDb = openControlDb();

	let versions = await getDbVersions(principal.adClientId, principal.x_auth_username);
	let localVersion = await getLocalDbVersion(controlDb);

	if (!localVersion) {
		logger.info(FUNC, `no local db version found, dropping local db ...`);
		localDb = openDb();
		await localDb.destroy();

		logger.info(FUNC, `setting local db version ...`);

		let version;
		// Make sure that we are using correct database version.
		if (versions && versions.length > 0) {
			version = versions[versions.length - 1].version;
		} else {
			// Fall back to default db version.
			version = getCouchClientDbName(principal.adClientId);
		}
		await writeLocalDbVersion(controlDb, version);
		logger.info(FUNC, `local db version is ${version}`);
		localDb = openDb();
		remoteDb = openRemoteDb(version, principal.x_auth_username);
		return {
			localDb: localDb,
			remoteDb: remoteDb,
		};
	} else {
		if (versions && versions.length > 0) {
			// Make sure that we are using correct database version.
			// Delete local db if server has newer db version.
			let version = versions[versions.length - 1].version;

			if (localVersion !== version) {
				logger.info(FUNC, `server db version ${version} differs from local db version ${localVersion}, dropping local db ...`);
				localDb = openDb();
				await localDb.destroy();
				localDb = openDb();
				await writeLocalDbVersion(controlDb, version);
				remoteDb = openRemoteDb(version, principal.x_auth_username);
				logger.info(FUNC, `local db version is ${version}`);
				return {
					localDb: localDb,
					remoteDb: remoteDb,
				};
			} else {
				remoteDb = openRemoteDb(version, principal.x_auth_username);
				localDb = openDb();
				logger.info(FUNC, `local db version is ${version}`);
				return {
					localDb: localDb,
					remoteDb: remoteDb,
				};
			}
		} else {
			// Server has no db version
			// We fall back to default db version.
			let version = getCouchClientDbName(principal.adClientId);

			if (localVersion !== version) {
				logger.info(FUNC, `server db version ${version} differs from local db version ${localVersion}, dropping local db ...`);
				localDb = openDb();
				await localDb.destroy();
				localDb = openDb();
				await writeLocalDbVersion(controlDb, version);
				remoteDb = openRemoteDb(version, principal.x_auth_username);
				logger.info(FUNC, `local db version is ${version}`);
				return {
					localDb: localDb,
					remoteDb: remoteDb,
				};
			} else {
				localDb = openDb();
				remoteDb = openRemoteDb(localVersion, principal.x_auth_username);
				logger.info(FUNC, `local db version is ${localVersion}`);
				return {
					localDb: localDb,
					remoteDb: remoteDb,
				};
			}
		}
	}
}

function sync(localDb, couch) {
	const FUNC = 'sync()';
	if (!localDb) {
		logger.error(FUNC, 'sync: pouch.localDb not initialized', null, logEvent);
		throw new Error('pouchWorker: sync(): sync: pouch.localDb not initialized');
	}

	let options = {
		live: true,
		retry: true,
	};

	let syncHandle = localDb
		.sync(couch, options)
		.on('error', (err) => {
			logger.error(FUNC, 'sync: error: ' + err, err, logEvent);
			messageRateCounterEventSource.generateEvent(1);
		})
		.on('change', (info) => {
			if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_SYNC) {
				logger.info(FUNC, 'sync: change:' + info, info, logEvent);
			}
			messageRateCounterEventSource.generateEvent(1);
		})
		.on('paused', (err) => {
			if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_SYNC) {
				logger.info(FUNC, 'sync: paused: ' + err, err, logEvent);
			}
			messageRateCounterEventSource.generateEvent(1);
		})
		.on('active', () => {
			if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_SYNC) {
				logger.info('sync: active', null, logEvent);
			}
			messageRateCounterEventSource.generateEvent(1);
		})
		.on('denied', (err) => {
			if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_SYNC) {
				logger.info('sync: denied:' + err, err, logEvent);
			}
			messageRateCounterEventSource.generateEvent(1);
		})
		.on('complete', (info) => {
			if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_SYNC) {
				logger.info('sync: complete: ' + info, info, logEvent);
			}
		});

	return syncHandle;
}

function changes(localDb) {
	let options: any = {};
	options.live = true;
	options.since = 'now';
	options.include_docs = true;

	let hChanges = localDb
		.changes(options)
		.on('change', (data) => {
			messageRateCounterEventSource.generateEvent(1);

			let deleted;

			if (data.deleted === true) {
				deleted = true;
			} else {
				deleted = false;
			}

			// Note: When the document is deleted pouch does not include whole document content,
			// document content will only contain _id, _rev a _deleted set to true.

			let msg: IWorkerMessage = {
				workerId: workerCtx.workerId,
				workerName: workerCtx.workerName,
				messageName: 'pouchDocChange',
				messageData: {
					documentName: data.doc.DB_TableName,
					doc: data.doc,
					deleted: deleted,
				},
			};
			sendMessage(msg);
			if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_WORKER) {
				console.log('pouchWorker: sent message: pouchDocChange');
				console.dir(msg);
			}
			return;
		})
		.on('error', (err) => {
			console.error(`pouchWorker: changes(): error: ${err}`, err);
		})
		.on('complete', () => {
			console.log('pouchWorker: changes(): complete');
		});

	return hChanges;
}

async function createDoc(doc: any, id?: string) {
	if (id) {
		doc._id = id;

		return localDb.put(doc);
	} else {
		return localDb.post(doc);
	}
}

async function updateDoc(doc, force) {
	let opts: any = {};

	if (force === true) {
		opts.force = true;
	}

	return localDb.put(doc, opts);
}

async function deleteDoc(docOrId: any, rev?: string) {
	const FUNC = 'deleteDoc()';
	if (_.isObject(docOrId)) {
		return localDb.remove(docOrId);
	} else {
		if (_.isString(docOrId)) {
			return localDb.remove(docOrId, rev);
		} else {
			logger.error(FUNC, 'docOrId argument must be document or id', null, logEvent);
			throw new Error('docOrId argument must be document or id');
		}
	}
}

async function getDoc(id: string, noNotFoundError: boolean) {
	return localDb.get(id).catch((err) => {
		if (noNotFoundError) {
			if (err.name === 'not_found') {
				return;
			}
		}
		return Promise.reject(err);
	});
}

async function query(view: string, options?: any) {
	return localDb.query(view, options);
}

async function find(selector) {
	return localDb.find(selector);
}

async function getLocks(documentName: string) {
	let result = await localDb.query('AD_Private_Access/All', {
		startkey: [documentName],
		endkey: [documentName, {}], // https://stackoverflow.com/questions/6164686/composite-key-with-couchdb-finding-multiple-records
		// http://docs.couchdb.org/en/stable/ddocs/views/collation.html#key-ranges
		include_docs: true,
	});
	return result.rows.map((row) => {
		return row.doc;
	});
}

async function getLock(documentName: string, id: string) {
	const FUNC = 'getLock()';
	let result = await localDb.query('AD_Private_Access/All', {
		key: [documentName, id],
		include_docs: true,
	});
	if (result.rows.length === 1) {
		return result.rows[0].doc;
	} else if (result.rows.length === 0) {
		return null;
	} else {
		logger.error(FUNC, `more then one lock found for document: ${documentName}, ${id}`);
		throw new Error(`more then one lock found for document: ${documentName}, ${id}`);
	}
}

async function setLock(documentName: string, id: string, principal: any) {
	let _lock: any = { _id: 'lock.' + id, DB_TableName: 'AD_Private_Access', AD_Table_ID: documentName, Couch_Record_ID: id, principal: principal };
	localDb.get(_lock._id).then(
		(rep) => {
			_lock._rev = rep.rev;
			return localDb.put(_lock, { force: true });
		},
		(err) => {
			if (err.name === 'not_found') {
				return localDb.put(_lock);
			} else {
				return Promise.reject(err);
			}
		}
	);
}

async function removeLock(documentName: string, id: string) {
	return getLock(documentName, id).then((_lock) => {
		if (_lock) {
			return localDb.remove(_lock);
		}
	});
}

async function getUserData(userUuid: string) {
	localDb.get(userUuid).then(
		(rep) => {
			return rep;
		},
		(err) => {
			if (err.name === 'not_found') {
				return null;
			} else {
				return Promise.reject(err);
			}
		}
	);
}

async function setUserData(userUuid: string, userData: any) {
	localDb.get(userUuid).then(
		(rep) => {
			userData._id = rep._id;
			userData._rev = rep._rev;
			return localDb.put(userData, { force: true });
		},
		(err) => {
			if (err.name === 'not_found') {
				userData._id = userUuid;
				userData.DB_TableName = 'user_data';
				return localDb.put(userData);
			} else {
				return Promise.reject(err);
			}
		}
	);
}

function pouchTest() {
	let messageRateCounterEventSource = makeMessageRateCounterEventSource(settings.settings.pouchMessageRateIndicationWindowMilliseconds, settings.settings.pouchMessageRateIndicationLimitCount);

	messageRateCounterEventSource.subject.subscribe((isOverLimit: boolean) => {
		sendMessageRateLimit(isOverLimit);
	});

	function generateEvents(count: number) {
		setTimeout(() => {
			messageRateCounterEventSource.generateEvent(1);
			--count;
			if (count > 0) {
				generateEvents(count);
			}
		}, 100);
	}
	generateEvents(25);
}

function init() {}

bootWorker(function (event) {
	const FUNC = 'messageHanler()';
	let msg: IWorkerMessage = event.data;

	try {
		if (settings.settings.isDebug && settings.settings.isDebugPouchDb && DEBUG_WORKER) {
			console.log('pouchWorker: received message: ' + msg.messageName);
		}

		if ('pouchStart' === msg.messageName) {
			start().then(
				function () {
					event.ports[0].postMessage({});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchStop' === msg.messageName) {
			stop().then(
				function () {
					event.ports[0].postMessage({});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchCreateDoc' === msg.messageName) {
			createDoc(msg.messageData.doc, msg.messageData.id).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchUpdateDoc' === msg.messageName) {
			updateDoc(msg.messageData.doc, msg.messageData.force).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchDeleteDoc' === msg.messageName) {
			deleteDoc(msg.messageData.docOrId, msg.messageData.rev).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchGetDoc' === msg.messageName) {
			getDoc(msg.messageData.id, msg.messageData.noNotFoundError).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchQuery' === msg.messageName) {
			query(msg.messageData.view, msg.messageData.options).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchFind' === msg.messageName) {
			find(msg.messageData.selector).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchGetLocks' === msg.messageName) {
			getLocks(msg.messageData.documentName).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchGetLock' === msg.messageName) {
			getLock(msg.messageData.documentName, msg.messageData.id).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchSetLock' === msg.messageName) {
			setLock(msg.messageData.documentName, msg.messageData.id, msg.messageData.principal).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchRemoveLock' === msg.messageName) {
			removeLock(msg.messageData.documentName, msg.messageData.id).then(
				function (result) {
					event.ports[0].postMessage({
						result: result,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchGetUserData' === msg.messageName) {
			getUserData(msg.messageData.userUuid).then(
				function (userData) {
					event.ports[0].postMessage({
						result: userData,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchSetUserData' === msg.messageName) {
			setUserData(msg.messageData.userUuid, msg.messageData.userData).then(
				function (userData) {
					event.ports[0].postMessage({
						result: userData,
					});
				},
				function (err) {
					event.ports[0].postMessage({
						err: '' + err,
					});
				}
			);
			return true;
		}

		if ('pouchTest' === msg.messageName) {
			pouchTest();
			event.ports[0].postMessage({});
			return true;
		}
	} catch (err) {
		logger.error(FUNC, ' error', err);
		event.ports[0].postMessage({
			err: '' + err,
		});
	}
}, init);
