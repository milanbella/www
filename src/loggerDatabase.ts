import { DATABASE_NAME_OFFLINE_LOG, STORE_NAME_OFFLINE_LOG } from './loggerCommon';
import { ILogEntry } from './loggerCommon';
import { settings } from './settings';
import { getExecutionContext } from './executionContext';
import { getGlobalThis } from './globalThis';

const FILE = 'loggerDatabase.ts';

let indexedDB = getGlobalThis()['indexedDB'] || getGlobalThis()['mozIndexedDB'] || getGlobalThis()['webkitIndexedDB'] || getGlobalThis()['msIndexedDB'];

let logDatabase = null;

export function GetLogDatabase(): Promise<any> {
	const FUNC = 'GetLogDatabase()';
	return new Promise((resolve, reject) => {
		if (logDatabase) {
			resolve(logDatabase);
		}
		let upgradeFn = (db) => {
			db.createObjectStore(STORE_NAME_OFFLINE_LOG, { autoIncrement: true });
		};

		if (!indexedDB) {
			console.error(`${FILE}:${FUNC}: idbDatabase: indexedDB not supported`);
			reject(new Error(`${FILE}:${FUNC}: idbDatabase: indexedDB not supported`));
		}
		let request = indexedDB.open(DATABASE_NAME_OFFLINE_LOG, 1);

		request.onerror = (event) => {
			let err = event.target.error;
			let errStr: string = `${FILE}:${FUNC}: db open failed: ${err}`;
			console.error(errStr);
			console.dir(err);
			reject(err);
		};
		request.onsuccess = (event) => {
			let db = event.target.result;
			logDatabase = db;
			resolve(db);
		};
		request.onblocked = () => {
			let msg: string = `${FILE}:${FUNC}: db blocked`;
			console.error(msg);
			reject();
		};
		request.onupgradeneeded = (event) => {
			let idbDb = event.target.result;
			upgradeFn(idbDb);
		};
	});
}

export function saveOfflineLog(logEntry: ILogEntry): Promise<any> {
	const FUNC = 'saveOfflineLog()';
	return GetLogDatabase().then((db) => {
		if (settings.settings.isDebug && settings.settings.isDebugLoggingWorker) {
			console.log('saving offline log: ' + logEntry.message);
		}
		return new Promise((resolve, reject) => {
			let transaction = db.transaction([STORE_NAME_OFFLINE_LOG], 'readwrite');
			let objectStore = transaction.objectStore(STORE_NAME_OFFLINE_LOG);
			let request = objectStore.add(logEntry);

			transaction.onerror = () => {
				let err = transaction.error;
				let errs = `${FILE}:${FUNC}: db transaction error: ${err}`;
				console.error(errs);
				console.dir(err);
				reject(err);
			};

			transaction.onabort = () => {
				let errs = `${FILE}:${FUNC}: db transaction aborted`;
				console.error(errs);
				reject(new Error(errs));
			};

			transaction.oncomplete = () => {
				resolve(undefined);
			};
		});
	});
}
