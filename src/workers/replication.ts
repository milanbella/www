import { PROJECT_NAME } from '../consts';
import { Logger } from '../types';
import { getLogger } from '../logger';

import { settings } from './workerCtx';
import { parseMessageForIndexedDb } from './jsontosqlparser1';

import * as _ from 'underscore';

let logger = getLogger(PROJECT_NAME, 'replication.ts');

export function processMessages(db, messages: any[]): Promise<any> {
	const FUNC = 'processMessages()';
	let records = [];
	for (let i = 0; i < messages.length; i++) {
		try {
			let _records = parseMessageForIndexedDb(messages[i]);
			_records.forEach((record) => {
				records.push(record);
			});
		} catch (err) {
			logger.error(FUNC, `replication processMessages: error in parseMessageForIndexedDb(): `, err);
			return Promise.reject(new Error(`replication processMessages: error in parseMessageForIndexedDb()`));
		}
	}

	if (settings.settings.isDebug && settings.settings.isDebugMessages && settings.settings.messagesDebugLevel > 0) {
		console.log(`replication received ${records.length} records`);
		console.dir(records);
	}

	return writeRecords(db, records);
}

function writeRecords(db, records): Promise<any> {
	const FUNC = 'writeRecords()';
	let startMs = Date.now();

	return new Promise((resolve, reject) => {
		if (records.length < 1) {
			resolve(undefined);
		}
		let isErr = false;

		// check if all stores are created

		let stores = records.reduce((a, record) => {
			a[record.storeName] = {
				storeName: record.storeName,
				key: record.key,
			};
			return a;
		}, {});
		stores = _.values(stores);
		for (let i = 0; i < stores.length; i++) {
			let store = stores[i];
			if (!db.objectStoreNames.contains(store.storeName)) {
				let errs = `replication flushRecords: database does not contain store: ${store.storeName}:`;
				console.error(errs);
				console.dir(store);
				let err = new Error(errs);
				reject(err);
				isErr = true;
				break;
			}
		}
		if (isErr) {
			return;
		}

		// open transaction

		let storeNames = stores.map((store) => {
			return store.storeName;
		});
		if (settings.settings.isDebug && settings.settings.isDebugMessages && settings.settings.messagesDebugLevel > 1) {
			logger.info(FUNC, `replication transation: storeNames:`, null, storeNames);
		}
		let trx = db.transaction(storeNames, 'readwrite');

		trx.onerror = () => {
			let err = trx.error;
			let errs = `replication writeRecords: idbDatabase: transaction: error`;
			logger.error(FUNC, errs, err);
			reject(new Error(errs));
		};

		trx.onabort = () => {
			let errs = `replication writeRecords: idbDatabase: transaction: aborted`;
			logger.error(FUNC, errs);
			reject(new Error(errs));
		};
		trx.oncomplete = () => {
			if (settings.settings.isDebug && settings.settings.isDebugMessages && settings.settings.messagesDebugLevel > 0) {
				let endMs = Date.now();
				let ms = endMs - startMs;
				console.info(FUNC, `replication flushed ${records.length} records in ${ms} ms`);
			}
			resolve(undefined);
		};

		writeRecordsTrx(trx, records);
	});
}

function writeRecordsTrx(trx, records) {
	const FUNC = 'writeRecordsTrx()';
	function next(i) {
		if (i === records.length) {
			return;
		}

		let record = records[i];
		let objectStore = trx.objectStore(record.storeName);
		if (settings.settings.isDebug && settings.settings.isDebugMessages && settings.settings.messagesDebugLevel > 2) {
			console.log(`replication trx: put: ${record.storeName}`);
			console.dir(record.value);
		}
		let request = objectStore.put(record.value);

		request.onerror = () => {
			let err = request.error;
			let errs = `replication writeRecord: error: ${err}`;
			logger.error(FUNC, errs, err, record);
		};

		request.onsuccess = () => {
			next(i + 1);
		};
	}
	next(0);
}
