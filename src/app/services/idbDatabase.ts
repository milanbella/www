import { promiseReject, promiseResolve, newPromise } from '../common/utils';
import { logger } from './logger';
import { Principal, CurrentUser } from './types';


var indexedDB =  self['indexedDB'] || self['mozIndexedDB'] || self['webkitIndexedDB'] || self['msIndexedDB'];

export class KeyRange {
	public idbKeyRange: any; // IDBKeyRange

	constructor (lower: string | number | null, upper: string | number | null | undefined, lowerOpen: boolean | null | undefined, upperOpen: boolean | null | undefined) {
		if (lower && upper) {
			this.idbKeyRange = IDBKeyRange.bound(lower, upper, (!lowerOpen)? false: lowerOpen, (!upperOpen)? false: upperOpen);
		} else if (lower) {
			this.idbKeyRange = IDBKeyRange.lowerBound(lower, (!lowerOpen)? false : lowerOpen);
		} else if (upper) {
			this.idbKeyRange = IDBKeyRange.upperBound(upper, (!upperOpen)? false: upperOpen);
		} else {
			console.error('idbDatabase: KeyRange: either lower or upper limit must be specified');
			var err = new Error('idbDatabase: KeyRange: either lower or upper limit must be specified');
			logger.error('idbDatabase: KeyRange: either lower or upper limit must be specified', err);
			throw err;
		}
	}

}

export class Database {

	constructor(public idbDb: any) {

		this.idbDb.onerror = (event) => {
			var err = event.target.error
			console.error ('idbDatabase: Database: error: ' + err); 
			console.dir(err)
			logger.error('idbDatabase: Database: error: ' + err, err);
		}

		this.idbDb.onabort = (event) => {
			console.warn ('idbDatabase: Database: aborted'); 
			console.dir(event)
			logger.warn('idbDatabase: Database: aborted');
		}

		this.idbDb.onversionchange = (event) => {
			console.warn ('idbDatabase: Database: version change'); 
			console.dir(event)
			logger.warn('idbDatabase: Database: version change');
		}
	}

	public getIndexCount(storeName: string, indexName: string) : Promise<any> {
		return newPromise((resolve, reject) => {
			try {
				var idbTransaction = this.idbDb.transaction([storeName], 'readonly');
				var result;

				idbTransaction.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: transaction: error: ' + err); 
					console.dir(err)
					logger.error('idbDatabase: transaction: error: ' + err, err);
					reject(err);
				}

				idbTransaction.onabort = () => {
					console.warn ('idbDatabase: transaction: aborted'); 
					reject('idbDatabase: transaction: aborted');
					logger.warn('idbDatabase: transaction: aborted');
				}
				idbTransaction.oncomplete = (event) => {
					resolve(result);
				}

				var idbObjectStore = idbTransaction.objectStore(storeName);
				var idbIndex = idbObjectStore.index(indexName);
				var idbRequest = idbIndex.count();

				idbRequest.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: ObjectStore.count(): error: ' + err); 
					console.dir(err);
					logger.error('idbDatabase: ObjectStore.count(): error: ' + err, err);
				}

				idbRequest.onsuccess = (event) => {
					result = event.target.result;
				}
			} catch (err) {
				console.error('idbDatabase: idbDatabase: error: ' + err);
				console.dir(err);
				logger.error('idbDatabase: idbDatabase: error: ' + err, err);
				reject(err);
			}
		})
	}

	private _getRecord(storeName: string, indexName: string, key: string | number | KeyRange) : Promise<any> {
		return newPromise((resolve, reject) => {
			try {
				var idbTransaction = this.idbDb.transaction([storeName], 'readonly');
				var result;

				idbTransaction.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: transaction: error: ' + err); 
					console.dir(err)
					logger.error('idbDatabase: transaction: error: ' + err, err);
					reject(err);
				}

				idbTransaction.onabort = () => {
					console.warn ('idbDatabase: transaction: aborted'); 
					logger.warn('idbDatabase: transaction: aborted');
					reject('idbDatabase: transaction: aborted');
				}
				idbTransaction.oncomplete = (event) => {
					resolve(result);
				}

				var idbObjectStore = idbTransaction.objectStore(storeName);
				var idbRequest;
				if (indexName) {
					var idbIndex = idbObjectStore.index(indexName);
					idbRequest = idbIndex.get(key);
				} else {
					idbRequest = idbObjectStore.get(key);
				}
				idbRequest.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: ObjectStore.get(): error: ' + err); 
					console.dir(err);
					logger.error('idbDatabase: ObjectStore.get(): error: ' + err, err);
				}

				idbRequest.onsuccess = (event) => {
					result = event.target.result
				}
			} catch (err) {
				console.error('idbDatabase: idbDatabase: error: ' + err);
				console.dir(err);
				logger.error('idbDatabase: idbDatabase: error: ' + err, err);
				reject(err);
			}
		})
	}

	// Gets the record at key, or first value identified by key range.

	getRecord(storeName: string, key: string | number | KeyRange) : Promise<any> {
		return this._getRecord(storeName, null, key);
	}

	getIndexRecord(storeName: string, indexName: string, key: string | number | KeyRange) : Promise<any> {
		return this._getRecord(storeName, indexName, key);
	}

	addRecord(storeName: string, record: any, key?: string | number) : Promise<any> {
		return newPromise((resolve, reject) => {
			try {
				var idbTransaction = this.idbDb.transaction([storeName], 'readwrite');
				var result;

				idbTransaction.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: transaction: error: ' + err); 
					console.dir(err)
					logger.error('idbDatabase: transaction: error: ' + err, err);
					reject(err);
				}

				idbTransaction.onabort = () => {
					console.warn ('idbDatabase: transaction: aborted'); 
					logger.warn('idbDatabase: transaction: aborted');
					reject('idbDatabase: transaction: aborted');
				}
				idbTransaction.oncomplete = (event) => {
					resolve(result);
				}

				var idbObjectStore = idbTransaction.objectStore(storeName);
				var idbRequest;
				if (key) {
					idbRequest = idbObjectStore.add(record, key);
				} else {
					idbRequest = idbObjectStore.add(record);
				}
				idbRequest.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: ObjectStore.add(): error: ' + err); 
					console.dir(err);
					logger.error('idbDatabase: ObjectStore.add(): error: ' + err, err);
				}

				idbRequest.onsuccess = (event) => {
					result = event.target.result;
				}
			} catch (err) {
				console.error('idbDatabase: error: ' + err);
				console.dir(err);
				logger.error('idbDatabase: error: ' + err, err);
				reject(err);
			}
		})
	}

	putRecord(storeName: string, record: any, key?: string | number) : Promise<any> {
		return newPromise((resolve, reject) => {
			try {
				var idbTransaction = this.idbDb.transaction([storeName], 'readwrite');
				var result;

				idbTransaction.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: transaction: error: ' + err); 
					console.dir(err);
					logger.error('idbDatabase: transaction: error: ' + err, err);
					reject(err);
				}

				idbTransaction.onabort = () => {
					console.warn ('idbDatabase: transaction: aborted'); 
					logger.warn('idbDatabase: transaction: aborted');
					reject('idbDatabase: transaction: aborted');
				}
				idbTransaction.oncomplete = (event) => {
					resolve(result);
				}

				var idbObjectStore = idbTransaction.objectStore(storeName);
				var idbRequest;
				if (key) {
					idbRequest = idbObjectStore.put(record, key);
				} else {
					idbRequest = idbObjectStore.put(record);
				}
				idbRequest.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: ObjectStore.put(): error'); 
					console.dir(err)
					logger.error('idbDatabase: ObjectStore.put(): error', err);
				}

				idbRequest.onsuccess = (event) => {
					result = event.target.result;
				}
			} catch (err) {
				console.error('idbDatabase: error: ' + err);
				console.dir(err);
				logger.error('idbDatabase: error: ' + err, err);
				reject(err);
			}
		})
	}

	removeRecord(storeName: string, key: string | number | KeyRange) : Promise<any> {
		return newPromise((resolve, reject) => {
			try {
				var idbTransaction = this.idbDb.transaction([storeName], 'readwrite');
				var result;

				idbTransaction.onerror = (event) => {
					var err = event.target.error
					console.error ('idbDatabase: transaction: error: ' + err); 
					console.dir(err)
					logger.error('idbDatabase: transaction: error: ' + err, err);
					reject(err);
				}

				idbTransaction.onabort = (event) => {
					console.warn ('Transaction: aborted'); 
					logger.warn('Transaction: aborted');
					reject('Transaction: aborted');
				}
				idbTransaction.oncomplete = (event) => {
					resolve(result);
				}

				var idbObjectStore = idbTransaction.objectStore(storeName);
				var idbRequest = idbObjectStore.delete(key);
				idbRequest.onerror = (event) => {
					var result = event.target.result;
					console.error ('ObjectStore.delete(): error'); 
					console.dir(idbRequest.error)
					logger.error('ObjectStore.delete(): error', idbRequest.error);
				}

				idbRequest.onsuccess = (event) => {
					result = event.target.result;
				}
			} catch (err) {
				console.error('idbDatabase: error: ' + err);
				console.dir(err);
				logger.error('idbDatabase: error: ' + err, err);
				reject(err);
			}
		})
	}

	private _openCursor(storeName: string, indexName?: string, range?: KeyRange | string | number, direction?: string): any {
		var idbTransaction = this.idbDb.transaction([storeName], 'readwrite');

		idbTransaction.onerror = (event) => {
			var err = event.target.error
			console.error ('idbDatabase: transaction: error: ' + err); 
			console.dir(err);
			logger.error('idbDatabase: transaction: error: ' + err, err);
		}

		idbTransaction.onabort = (event) => {
			console.dir(event);
			console.warn ('idbDatabase: transaction: aborted'); 
			logger.warn('idbDatabase: transaction: aborted');
		}
		idbTransaction.oncomplete = () => {
		}

		var idbObjectStore = idbTransaction.objectStore(storeName);
		var idbRequest;
		if (indexName) {
			var idbIndex = idbObjectStore.index(name);
			idbRequest = idbIndex.openCursor(range, direction);
		} else {
			idbRequest = idbObjectStore.openCursor(range, direction);
		}
		return {
			idbRequest: idbRequest,
			idbTransaction: idbTransaction
		}
	}

	// see: https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/openCursor
	// Returns idbReuest or indefined if no such key exists.

	openCursor(storeName: string, range?: KeyRange | string | number, direction?: string): any {
		return this._openCursor(storeName, null, range, direction);
	}

	openIndexCursor(storeName: string, indexName: string, range?: KeyRange | string | number, direction?: string): any {
		return this._openCursor(storeName, indexName, range, direction);
	}

}

// Get db instance 'Database' of existing database , or creates new db one if both upgrade function and version 0 specified,
// or upgrades existing db to a new version if version > 0 specified. 'upgradeFn' is passed db instance of 'Database'

export function getDatabase (name: string, version?: number, upgradeFn?: any) : Promise<any> {
	return newPromise((resolve, reject) => {
		if (!indexedDB) {
			console.error('idbDatabase: indexedDB not supported');
			logger.error('idbDatabase: indexedDB not supported', new Error('idbDatabase: indexedDB not supported'));
			reject('idbDatabase: indexedDB not supported');
		}
		var idbRequest = indexedDB.open(name, version);

		idbRequest.onerror = (event) => {
			var err = event.target.error;
			var errStr: string = `idbDatabase: database: ${name}:  version: ${version}  : open failed: ${err}`; 
			console.error(errStr);
			console.dir(err);
			logger.error(errStr, err);
			reject(err);
		};

		idbRequest.onsuccess = (event) => {
			var idbDb = event.target.result;
			var database = new Database(idbDb);
			resolve(database);
		};

		idbRequest.onblocked = (event) => {
			var msg: string = `idbDatabase: database: ${name}:  version: ${version}  : blocked`;
			console.error(msg);
			logger.error(msg);
			reject();
		}

		idbRequest.onupgradeneeded = (event) => {

			var idbDb = event.target.result;
			var database = new Database(idbDb);

			if (upgradeFn) {
				upgradeFn(database);
			} else {
				console.error('idbDatabase: no upgradeFn');
				logger.error('idbDatabase: no upgradeFn');
				reject('idbDatabase: no upgradeFn');
			}
		};
	});
}

export function deleteDatabase (name: string) : Promise<any> {
	return newPromise((resolve, reject) => {
		if (!indexedDB) {
			console.error('idbDatabase: indexedDB not supported');
			logger.error('idbDatabase: indexedDB not supported');
			reject('idbDatabase: indexedDB not supported');
		}
		var idbRequest = indexedDB.deleteDatabase(name);

		idbRequest.onerror = (event) => {
			var err = event.target.error;
			var errStr: string = `database: ${name}: delete failed:${err}`; 
			console.error(errStr);
			console.dir(err);
			logger.error(errStr, err);
			reject(err);
		};

		idbRequest.onsuccess = (event) => {
			resolve();
		};

		idbRequest.onblocked = (event) => {
			var err: string = `idbDatabase: database: ${name}: delete failed: database still in use`;
			console.error(err);
			logger.error(err);
			reject(err);
		}

		idbRequest.onupgradeneeded = (event) => {
			var err = `idbDatabase: database: ${name}: delete: unexpected event: upgradeneeded`; 
			console.error(err);
			logger.error(err);	
			reject(err);
		};
	});
}

// --------------- cloudempiere database definitions ---------------------

const DATABASE_NAME_CLOUDEMPIERE = 'cloudempiereDb';

export const STORAGE_NAME_USER = 'user';
export const INDEX_NAME_USER_PIN = 'pin';
export const STORAGE_NAME_CURRENT_USER = 'current_user';
export const STORAGE_NAME_SETTINGS = 'settings';

export function GetCloudempiereDatabase (): Promise<any> {
	var upgradeFn = (database: Database) => {
		var idbDb = database.idbDb;

		var idbObjectStore = idbDb.createObjectStore(STORAGE_NAME_USER, {keyPath: "userUuid"});
		idbObjectStore.createIndex(INDEX_NAME_USER_PIN, 'pin', {unique: true});

		idbDb.createObjectStore(STORAGE_NAME_CURRENT_USER, {keyPath: "id"});
		idbDb.createObjectStore(STORAGE_NAME_SETTINGS, {keyPath: "id"});
	}
	return getDatabase(DATABASE_NAME_CLOUDEMPIERE, 1, upgradeFn);
}

export function DeleteCloudempiereDatabase (): Promise<any> {
	return deleteDatabase(DATABASE_NAME_CLOUDEMPIERE);
}

