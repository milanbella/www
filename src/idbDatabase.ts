import { PROJECT_NAME } from './consts';
import { Logger } from './types';
import { getLogger } from './logger';
import { getExecutionContext } from './executionContext';
import { getGlobalThis } from './globalThis';

import * as _ from 'underscore';

let logger = getLogger(PROJECT_NAME, 'idbDatabase.ts');

let indexedDB = getGlobalThis()['indexedDB'] || getGlobalThis()['mozIndexedDB'] || getGlobalThis()['webkitIndexedDB'] || getGlobalThis()['msIndexedDB'];

export class Dresult {
	promise: Promise<any>;
	database: any;
	transaction: any;
	request: any;

	constructor(database?: any) {
		this.database = database;
	}
}

export class Dcursor {
	range: any = null;
	direction: 'next' | 'nextunique' | 'prev' | 'prevunique' = 'next';
	writeMode = false;
}

export let only;
export let bound;
export let lowerBound;
export let upperBound;

if (getGlobalThis().IDBKeyRange) {
	only = IDBKeyRange.only;
	bound = IDBKeyRange.bound;
	lowerBound = IDBKeyRange.lowerBound;
	upperBound = IDBKeyRange.upperBound;
}

let OBJECT_STORES_SEALED = false;
let OBJECT_STORES: any = [];

export class Database {
	constructor(public db: any) {
		const FUNC = 'constructor';
		this.db.onerror = (event) => {
			let err = event.target.error;
			logger.error(FUNC, `idbDatabase: Database: error: `, err);
		};

		this.db.onabort = (event) => {
			logger.warn(FUNC, `idbDatabase: Database: aborted`);
		};

		this.db.onversionchange = (event) => {
			logger.warn(FUNC, `idbDatabase: Database: version change`);
		};
	}

	public tableExists(tableName: string): boolean {
		if (this.db.objectStoreNames.contains(tableName)) {
			return true;
		} else {
			return false;
		}
	}

	public primaryKeyExists(tableName, primaryKeyKeys: string[]): boolean {
		const FUNC = 'primaryKeyExists()';
		if (this.tableExists(tableName)) {
			let store = OBJECT_STORES.find((s) => {
				return s.name === tableName;
			});
			if (!store) {
				let errs = `idbDatabase.ts: primaryKeyExists(): no object store found for table: ${tableName}`;
				console.error(errs);
				console.dir(OBJECT_STORES);
				throw new Error(errs);
			}
			if (primaryKeyKeys.length !== store.keyPath.length) {
				return false;
			}
			let same = true;
			for (let i = 0; i < primaryKeyKeys.length; i++) {
				if (primaryKeyKeys[i] !== store.keyPath[i]) {
					same = false;
					break;
				}
			}
			return same;
		} else {
			return false;
		}
	}

	public findIndexName(tableName, indexKeys: string[]): string {
		if (this.tableExists(tableName)) {
			let store = OBJECT_STORES.find((s) => {
				return s.name === tableName;
			});
			if (!store) {
				let errs = `idbDatabase.ts: indexExists(): no object store found for table: ${tableName}`;
				console.error(errs);
				console.dir(OBJECT_STORES);
				throw new Error(errs);
			}
			let indexes = store.indexes || [];
			for (let i = 0; i < indexes.length; i++) {
				let index = indexes[i];
				if (indexKeys.length !== index.keyPath.length) {
					continue; // Continue to next index
				}
				let same = true;
				for (let i = 0; i < indexKeys.length; i++) {
					if (indexKeys[i] !== index.keyPath[i]) {
						same = false;
						break;
					}
				}
				if (same) {
					return index.indexName;
				}
			}
		}
	}

	public openTransactionDresult(storeNames: string[], writeMode?: boolean): Dresult {
		const FUNC = 'openTransactionDresult()';
		let mode, err, errs;

		function storeNamesToString() {
			return storeNames.reduce((a, name) => {
				a += name + ', ';
				return a;
			}, '');
		}

		if (writeMode === undefined || writeMode === null) {
			mode = 'readonly';
		} else {
			if (writeMode) {
				mode = 'readwrite';
			} else {
				mode = 'readonly';
			}
		}

		let dresult = new Dresult(this.db);
		let transaction;
		try {
			transaction = this.db.transaction(storeNames, mode);
		} catch (err) {
			errs = `idbDatabase: transaction: storeNames: ${storeNamesToString()}: error: ${err}`;
			logger.error(FUNC, errs, err);
			throw err;
		}
		dresult.transaction = transaction;

		dresult.promise = new Promise((resolve, reject) => {
			transaction.onerror = () => {
				err = transaction.error;
				errs = `idbDatabase: transaction: storeNames: ${storeNamesToString()}: error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			};

			transaction.onabort = () => {
				errs = `idbDatabase: transaction: storeNames: ${storeNamesToString()}: aborted`;
				logger.error(FUNC, errs);
				reject(new Error(errs));
			};

			transaction.oncomplete = () => {
				resolve(undefined);
			};
		});

		return dresult;
	}

	private _getRecord(storeName: string, indexName: string, key?: any, transaction?: any, allRecords?: boolean): Dresult {
		const FUNC = '_getRecord()';
		let errs;
		if (null === key) {
			key = undefined;
		}
		if (_.isArray(key)) {
			key = only(key);
		}
		let dresult = new Dresult(this.db);
		dresult.promise = new Promise((resolve, reject) => {
			let request;
			try {
				if (!transaction) {
					let dresult: Dresult = this.openTransactionDresult([storeName]);
					dresult.promise.catch(reject);
					transaction = dresult.transaction;
				}
				dresult.transaction = transaction;

				let objectStore = transaction.objectStore(storeName);
				if (indexName) {
					let index = objectStore.index(indexName);
					if (allRecords) {
						request = index.getAll(key);
					} else {
						request = index.get(key);
					}
				} else {
					if (allRecords) {
						request = objectStore.getAll(key);
					} else {
						request = objectStore.get(key);
					}
				}
			} catch (err) {
				errs = `idbDatabase: _getRecord(): storeName ${storeName}, indexName ${indexName}:   error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			}

			request.onerror = () => {
				let err = request.error;
				errs = `idbDatabase: _getRecord(): storeName ${storeName}, indexName ${indexName}:   error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
			dresult.request = request;
		});
		return dresult;
	}

	getRecordDresult(storeName: string, key: any, _transaction?: any): Dresult {
		return this._getRecord(storeName, null, key, _transaction);
	}

	getRecord(storeName: string, key: any, transaction?: any): Promise<any> {
		let dresult = this.getRecordDresult(storeName, key, transaction);
		return dresult.promise;
	}

	getRecordsDresult(storeName: string, key?: any, transaction?: any): Dresult {
		return this._getRecord(storeName, null, key, transaction, true);
	}

	getRecords(storeName: string, key?: any, transaction?: any): Promise<any> {
		let dresult = this.getRecordsDresult(storeName, key, transaction);
		return dresult.promise;
	}

	getIndexRecordDresult(storeName: string, indexName: string, key: any, transaction?: any): Dresult {
		return this._getRecord(storeName, indexName, key, transaction);
	}

	getIndexRecord(storeName: string, indexName: string, key: any, transaction?: any): Promise<any> {
		let dresult = this.getIndexRecordDresult(storeName, indexName, key, transaction);
		return dresult.promise;
	}

	getIndexRecordsDresult(storeName: string, indexName: string, key?: any, transaction?: any): Dresult {
		return this._getRecord(storeName, indexName, key, transaction, true);
	}

	getIndexRecords(storeName: string, indexName: string, key?: any, transaction?: any): Promise<any> {
		let dresult = this.getIndexRecordsDresult(storeName, indexName, key, transaction);
		return dresult.promise;
	}

	addRecordDresult(storeName: string, record: any, key?: any, transaction?: any): Dresult {
		const FUNC = 'addRecordDresult()';
		let errs;
		let dresult = new Dresult(this.db);
		dresult.promise = new Promise((resolve, reject) => {
			let request;
			try {
				if (!transaction) {
					let dresult: Dresult = this.openTransactionDresult([storeName], true);
					dresult.promise.catch(reject);
					transaction = dresult.transaction;
				}
				dresult.transaction = transaction;

				let objectStore = transaction.objectStore(storeName);
				if (key) {
					request = objectStore.add(record, key);
				} else {
					request = objectStore.add(record);
				}
			} catch (err) {
				errs = `idbDatabase: addRecordDresult(): storeName ${storeName}:   error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			}

			request.onerror = () => {
				let err = request.error;
				errs = `'idbDatabase: addRecordDresult(): storeName ${storeName}:   error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
			dresult.request = request;
		});
		return dresult;
	}

	addRecord(storeName: string, record: any, key?: any, transaction?: any): Promise<any> {
		let dresult = this.addRecordDresult(storeName, record, key, transaction);
		return dresult.promise;
	}

	putRecordDresult(storeName: string, record: any, key?: any, transaction?: any): Dresult {
		const FUNC = 'putRecordDresult()';
		let errs;
		let dresult = new Dresult(this.db);
		dresult.promise = new Promise((resolve, reject) => {
			let request;
			try {
				if (!transaction) {
					let dresult: Dresult = this.openTransactionDresult([storeName], true);
					dresult.promise.catch(reject);
					transaction = dresult.transaction;
				}
				dresult.transaction = transaction;

				let objectStore = transaction.objectStore(storeName);
				if (key) {
					request = objectStore.put(record, key);
				} else {
					request = objectStore.put(record);
				}
			} catch (err) {
				errs = `idbDatabase: putRecordDresult(): storeName ${storeName}: error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			}

			request.onerror = () => {
				let err = request.error;
				errs = `idbDatabase: putRecordDresult(): storeName ${storeName}: error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
			dresult.request = request;
		});
		return dresult;
	}

	putRecord(storeName: string, record: any, key?: any, transaction?: any): Promise<any> {
		let dresult = this.putRecordDresult(storeName, record, key, transaction);
		return dresult.promise;
	}

	_removeRecordDresult(storeName: string, key?: any, transaction?: any, allRecords?: boolean): Dresult {
		const FUNC = '_removeRecordDresult()';
		let errs;
		if (null === key) {
			key = undefined;
		}
		if (_.isArray(key)) {
			key = only(key);
		}
		let dresult = new Dresult(this.db);
		dresult.promise = new Promise((resolve, reject) => {
			let request;
			try {
				if (!transaction) {
					let dresult: Dresult = this.openTransactionDresult([storeName], true);
					dresult.promise.catch(reject);
					transaction = dresult.transaction;
				}
				dresult.transaction = transaction;

				let objectStore = transaction.objectStore(storeName);
				if (allRecords) {
					request = objectStore.clear();
				} else {
					request = objectStore.delete(key);
				}
			} catch (err) {
				errs = `idbDatabase: _removeRecordDresult(): storeName ${storeName}:   error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			}

			request.onerror = () => {
				let err = request.error;
				errs = `idbDatabase: _removeRecordDresult(): storeName ${storeName}:   error: ${err}`;
				logger.error(FUNC, errs, err);
				reject(err);
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
			dresult.request = request;
		});
		return dresult;
	}

	removeRecordDresult(storeName: string, key: any, transaction?: any): Dresult {
		return this._removeRecordDresult(storeName, key, transaction);
	}

	removeRecord(storeName: string, key: any, transaction?: any): Promise<any> {
		let dresult = this.removeRecordDresult(storeName, key, transaction);
		return dresult.promise;
	}

	removeRecordsDresult(storeName: string, key: any, transaction?: any): Dresult {
		return this._removeRecordDresult(storeName, key, transaction, true);
	}

	removeRecords(storeName: string, key?: any, transaction?: any): Promise<any> {
		let dresult = this.removeRecordsDresult(storeName, key, transaction);
		return dresult.promise;
	}

	private _getRecordsCountDresult(storeName: string, indexName?: string, key?: any, transaction?: any): Dresult {
		const FUNC = '_getRecordsCountDresult()';
		if (null === key) {
			key = undefined;
		}
		let dresult = new Dresult(this.db);
		dresult.promise = new Promise((resolve, reject) => {
			let request;
			try {
				if (!transaction) {
					let dresult: Dresult = this.openTransactionDresult([storeName]);
					dresult.promise.catch(reject);
					transaction = dresult.transaction;
				}
				dresult.transaction = transaction;

				let objectStore = transaction.objectStore(storeName);

				if (indexName) {
					let index = objectStore.index(indexName);
					request = index.count(key);
				} else {
					request = objectStore.count();
				}
			} catch (err) {
				logger.error(FUNC, `idbDatabase: _getRecordsCountDresult(): error: `, err);
				reject(err);
			}

			request.onerror = () => {
				let err = request.error;
				logger.error(FUNC, `idbDatabase: _getRecordsCountDresult(): error: `, err);
				reject(err);
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
			dresult.request = request;
		});
		return dresult;
	}

	public getRecordsCountDresult(storeName: string, transaction?: any): Dresult {
		return this._getRecordsCountDresult(storeName, null, null, transaction);
	}

	public getRecordsCount(storeName: string, transaction?: any): Promise<any> {
		let dresult = this.getRecordsCountDresult(storeName, transaction);
		return dresult.promise;
	}

	public getIndexRecordsCountDresult(storeName: string, indexName: string, key: any, transaction?: any): Dresult {
		return this._getRecordsCountDresult(storeName, indexName, key, transaction);
	}

	public getIndexRecordsCount(storeName: string, indexName: string, key: any, transaction?: any): Promise<any> {
		let dresult = this.getIndexRecordsCountDresult(storeName, indexName, key, transaction);
		return dresult.promise;
	}

	private _openCursor(storeName: string, indexName?: string, cursor?: Dcursor, transaction?: any, writeMode?: boolean): Dresult {
		if (!cursor) {
			cursor = new Dcursor();
		}

		let dresult = new Dresult(this.db);

		dresult.promise = new Promise((resolve, reject) => {
			if (!transaction) {
				if (writeMode === undefined || writeMode === null) {
					writeMode = cursor.writeMode;
				} else {
					if (writeMode) {
						writeMode = true;
					} else {
						writeMode = false;
					}
				}

				let dresult: Dresult;
				dresult = this.openTransactionDresult([storeName], writeMode);
				dresult.promise.then(resolve, reject);
				transaction = dresult.transaction;
			}
			dresult.transaction = transaction;

			let objectStore = transaction.objectStore(storeName);
			let request;
			if (indexName) {
				let index = objectStore.index(name);
				request = index.openCursor(cursor.range ? cursor.range : undefined, cursor.direction);
			} else {
				request = objectStore.openCursor(cursor.range ? cursor.range : undefined, cursor.direction);
			}
			dresult.request = request;
		});
		return dresult;
	}

	openCursorDresult(storeName: string, cursor?: Dcursor, transaction?: any): Dresult {
		return this._openCursor(storeName, null, cursor, transaction);
	}

	openCursor(storeName: string, cursor?: Dcursor, transaction?: any): Dresult {
		let dresult = this.openCursorDresult(storeName, cursor, transaction);
		dresult.promise.catch((err) => {
			console.error('error', err);
		});
		return dresult;
	}

	openIndexCursorDresult(storeName: string, indexName: string, cursor?: Dcursor, transaction?: any): Dresult {
		return this._openCursor(storeName, indexName, cursor, transaction);
	}

	openIndexCursor(storeName: string, indexName: string, cursor?: Dcursor, transaction?: any): Dresult {
		let dresult = this.openIndexCursorDresult(storeName, indexName, cursor, transaction);
		dresult.promise.catch((err) => {
			console.error('error', err);
		});
		return dresult;
	}

	openWriteCursorDresult(storeName: string, cursor?: Dcursor, transaction?: any): Dresult {
		return this._openCursor(storeName, null, cursor, transaction, true);
	}

	openWriteCursor(storeName: string, cursor?: Dcursor, transaction?: any): Dresult {
		let dresult = this.openWriteCursorDresult(storeName, cursor, transaction);
		dresult.promise.catch((err) => {
			console.error('error', err);
		});
		return dresult;
	}

	openIndexWriteCursorDresult(storeName: string, indexName: string, cursor?: Dcursor, transaction?: any): Dresult {
		return this._openCursor(storeName, indexName, cursor, transaction, true);
	}

	openIndexWriteCursor(storeName: string, indexName: string, cursor?: Dcursor, transaction?: any): Dresult {
		let dresult = this.openIndexWriteCursorDresult(storeName, indexName, cursor, transaction);
		dresult.promise.catch((err) => {
			console.error('error', err);
		});
		return dresult;
	}
}

// Get db instance 'Database' of existing database , or creates new db one if both upgrade function and version 0 specified,
// or upgrades existing db to a new version if version > 0 specified. 'upgradeFn' is passed db instance of 'Database'

export function getDatabase(name: string, version?: number, upgradeFn?: any): Dresult {
	const FUNC = 'getDatabase()';
	let dresult = new Dresult();
	dresult.promise = new Promise((resolve, reject) => {
		if (!indexedDB) {
			logger.info(FUNC, `idbDatabase: indexedDB not supported (probably due to running on server side)`);
			resolve(null);
			return;
		}
		let request = indexedDB.open(name, version);

		request.onerror = (event) => {
			let err = event.target.error;
			let errStr = `idbDatabase: database: ${name}:  version: ${version}  : open failed: ${err}`;
			logger.error(FUNC, errStr, err);
			reject(err);
		};
		request.onsuccess = (event) => {
			let db = event.target.result;
			let database = new Database(db);
			resolve(database);
		};
		request.onblocked = () => {
			let msg = `idbDatabase: database: ${name}:  version: ${version}  : blocked`;
			logger.error(FUNC, msg);
			reject();
		};
		request.onupgradeneeded = (event) => {
			let idbDb = event.target.result;
			let database = new Database(idbDb);

			if (upgradeFn) {
				upgradeFn(database, event.target.transaction, event.oldVersion);
			} else {
				logger.error(FUNC, `idbDatabase: no upgradeFn`);
				reject(`idbDatabase: no upgradeFn`);
			}
		};
		dresult.request = request;
	});

	return dresult;
}

export function deleteDatabase(name: string): Dresult {
	const FUNC = 'deleteDatabase()';
	let dresult = new Dresult();
	dresult.promise = new Promise((resolve, reject) => {
		if (!indexedDB) {
			logger.error(FUNC, `idbDatabase: indexedDB not supported`);
			reject(`idbDatabase: indexedDB not supported`);
		}
		let request = indexedDB.deleteDatabase(name);

		request.onerror = (event) => {
			let err = event.target.error;
			let errStr = `database: ${name}: delete failed:${err}`;
			logger.error(FUNC, errStr, err);
			reject(err);
		};
		request.onsuccess = () => {
			resolve(undefined);
		};
		request.onblocked = () => {
			let err = `idbDatabase: database: ${name}: delete failed: database still in use`;
			logger.error(FUNC, err);
			reject(err);
		};
		request.onupgradeneeded = () => {
			let err = `idbDatabase: database: ${name}: delete: unexpected event: upgradeneeded`;
			logger.error(FUNC, err);
			reject(err);
		};

		dresult.request = request;
	});
	return dresult;
}

function createObjectStore(db, _transaction, name, keyPath, indexes?) {
	const FUNC = 'createObjectStore()';
	if (db) {
		let objectStore = db.createObjectStore(name, { keyPath: keyPath });
		if (indexes) {
			indexes.forEach((index) => {
				if (!_.isArray(index.keyPath)) {
					let errs = `keyPath is not array`;
					console.error(errs);
					throw new Error(errs);
				}
				objectStore.createIndex(index.indexName, index.keyPath, index.params);
			});
		}
	}

	if (!OBJECT_STORES_SEALED) {
		OBJECT_STORES.push({
			name: name,
			keyPath: keyPath,
			indexes: indexes,
		});
	}
}

function createIndexes(db, transaction, objectStoreName, indexes) {
	if (db) {
		let objectStore = transaction.objectStore(objectStoreName);
		if (indexes) {
			indexes.forEach((index) => {
				if (!_.isArray(index.keyPath)) {
					let errs = 'keyPath is not array';
					console.error(errs);
					throw new Error(errs);
				}
				objectStore.createIndex(index.indexName, index.keyPath, index.params);
			});
		} else {
			return;
		}
	}

	if (!OBJECT_STORES_SEALED) {
		let store = OBJECT_STORES.find((v) => {
			return v.name === objectStoreName;
		});
		if (store) {
			if (!store.indexes) {
				store.indexes = [];
			}
			store.indexes = store.indexes.reduce((a, v) => {
				a.push(v);
				return a;
			}, store.indexes);
		}
	}
}

function upgradeDatabaseToV1(database: Database, transaction) {
	let db;
	if (database) {
		db = database.db;
		console.log(`idbDatabase.ts: upgrading database ${db.name} to version 1`);
	} else {
		db = null;
	}

	createObjectStore(db, transaction, 'user', ['userUuid'], [{ indexName: 'pin', keyPath: ['pin'], params: { unique: true } }]);

	createObjectStore(db, transaction, 'current_user', ['id']);

	createObjectStore(db, transaction, 'device', ['id']);

	createObjectStore(db, transaction, 'client', ['id']);

	createObjectStore(db, transaction, '__appcache', ['appid', 'controller']);

	createObjectStore(db, transaction, 'ad_user', ['ad_user_id'], [{ indexName: 'ad_client_id', keyPath: ['ad_client_id'] }]);

	createObjectStore(db, transaction, 'ad_client', ['ad_client_id']);

	createObjectStore(db, transaction, 'ad_org', ['ad_org_id'], [{ indexName: 'ad_client_id', keyPath: ['ad_client_id'] }]);

	createObjectStore(db, transaction, 'ad_user_orgaccess', ['ad_user_id']);

	createObjectStore(db, transaction, 'ad_role', ['ad_role_id']);

	createObjectStore(
		db,
		transaction,
		'c_doctype',
		['c_doctype_id'],
		[
			{
				indexName: 'ad_client_id_docbasetype_docsubtypeinv',
				keyPath: ['ad_client_id', 'docbasetype', 'docsubtypeinv'],
			},
			{
				indexName: 'ad_client_id_docbasetype',
				keyPath: ['ad_client_id', 'docbasetype'],
			},
			{
				indexName: 'docbasetype_docsubtyperma',
				keyPath: ['docbasetype', 'docsubtyperma'],
			},
		]
	);

	createObjectStore(db, transaction, 'c_bpartner', ['c_bpartner_id'], [{ indexName: 'salesrep_id', keyPath: ['salesrep_id'] }]);

	createObjectStore(db, transaction, 'c_bpartner_location', ['c_bpartner_location_id'], [{ indexName: 'c_bpartner_id', keyPath: ['c_bpartner_id'] }]);

	createObjectStore(db, transaction, 'c_pos', ['c_pos_id'], [{ indexName: 'salesrep_id', keyPath: ['salesrep_id'] }]);

	createObjectStore(db, transaction, 'c_postype', ['c_postype_id']);

	createObjectStore(db, transaction, 'c_currency', ['c_currency_id']);

	createObjectStore(db, transaction, 'c_location', ['c_location_id']);

	createObjectStore(db, transaction, 'c_postendertype', ['c_postendertype_id']);

	createObjectStore(db, transaction, 'c_uom', ['c_uom_id']);

	createObjectStore(
		db,
		transaction,
		'c_uom_conversion',
		['c_uom_conversion_id'],
		[
			{
				indexName: 'm_product_id_c_uom_id_c_uom_to_id',
				keyPath: ['m_product_id', 'c_uom_id', 'c_uom_to_id'],
			},
			{ indexName: 'm_product_id', keyPath: ['m_product_id'] },
		]
	);

	createObjectStore(db, transaction, 'c_uom_trl', ['c_uom_id', 'ad_language']);

	createObjectStore(db, transaction, 'm_attributesetinstance', ['m_attributesetinstance_id'], [{ indexName: 'm_lot_id', keyPath: ['m_lot_id'] }]);

	createObjectStore(db, transaction, 'm_discountschema', ['m_discountschema_id']);

	createObjectStore(db, transaction, 'm_discountschemabreak', ['m_discountschemabreak_id']);

	createObjectStore(db, transaction, 'm_handlingunit', ['m_handlingunit_id'], [{ indexName: 'value', keyPath: ['value'] }]);

	createObjectStore(
		db,
		transaction,
		'm_locator',
		['m_locator_id'],
		[
			{ indexName: 'ad_org_id', keyPath: ['ad_org_id'] },
			{
				indexName: 'ad_org_id_m_warehouse_id',
				keyPath: ['ad_org_id', 'm_warehouse_id'],
			},
			{
				indexName: 'm_warehouse_id_isdefault',
				keyPath: ['m_warehouse_id', 'isdefault'],
			},
			{ indexName: 'upc', keyPath: ['upc'] },
		]
	);

	createObjectStore(db, transaction, 'm_lot', ['m_lot_id'], [{ indexName: 'name', keyPath: ['name'] }]);

	createObjectStore(db, transaction, 'm_packtype', ['m_packtype_id']);

	createObjectStore(db, transaction, 'm_pricelist', ['m_pricelist_id']);

	createObjectStore(db, transaction, 'm_product', ['m_product_id'], [{ indexName: 'upc', keyPath: ['upc'] }]);

	createObjectStore(db, transaction, 'm_product_category', ['m_product_category_id'], [{ indexName: 'name', keyPath: ['name'] }]);

	createObjectStore(db, transaction, 'm_product_po', ['m_product_id']);

	createObjectStore(db, transaction, 'm_productprice', ['m_product_id', 'm_pricelist_version_id'], [{ indexName: 'm_product_id', keyPath: ['m_product_id'] }]);

	createObjectStore(db, transaction, 'm_pricelist_version', ['m_pricelist_version_id'], [{ indexName: 'm_pricelist_id', keyPath: ['m_pricelist_id'] }]);

	createObjectStore(
		db,
		transaction,
		'm_storageonhand',
		['m_product_id', 'm_locator_id', 'm_attributesetinstance_id', 'datematerialpolicy'],
		[
			{
				indexName: 'm_product_id_m_locator_id',
				keyPath: ['m_product_id', 'm_locator_id'],
			},
			{
				indexName: 'ad_client_id_m_locator_id_m_product_id',
				keyPath: ['ad_client_id', 'm_locator_id', 'm_product_id'],
			},
			{ indexName: 'm_locator_id', keyPath: ['m_locator_id'] },
			{ indexName: 'm_product_id', keyPath: ['m_product_id'] },
		]
	);

	createObjectStore(db, transaction, 'm_warehouse', ['m_warehouse_id'], [{ indexName: 'ad_org_id', keyPath: ['ad_org_id'] }]);
}

function upgradeDatabaseToV2(database: Database, transaction) {
	let db;
	if (database) {
		db = database.db;
		console.log(`idbDatabase.ts: upgrading database ${db.name} to version 2`);
	} else {
		db = null;
	}

	createIndexes(db, transaction, 'm_product', [{ indexName: 'm_locator_id', keyPath: ['m_locator_id'] }]);
}

function upgradeDatabaseToV3(database: Database, transaction) {
	let db;
	if (database) {
		db = database.db;
		console.log(`idbDatabase.ts: upgrading database ${db.name} to version 3`);
	} else {
		db = null;
	}

	createObjectStore(
		db,
		transaction,
		'process',
		['process_id'],
		[
			{
				indexName: 'process_status',
				keyPath: ['process_status'],
			},
			{
				indexName: 'couch_document_id',
				keyPath: ['couch_document_id'],
			},
		]
	);
}

const DATABASE_VERSION = 3;

function upgradeDatabase(database: Database, transaction, oldVersion: number) {
	if (database && database.db) {
		console.log(`idbDatabase.ts: upgradeDatabase(): name ${database.db.name}: upgarade to version ${database.db.version}`);
	}

	if (
		(!database && DATABASE_VERSION >= 1) || // Logic for dry Run, Object Stores to store only up to DATABASE_VERSION
		(database && (!database.db.version || (oldVersion < 1 && database.db.version >= 1)))
	) {
		// Or we dont have version in DB, OR we are in range oldVersion < 1 <= db.version
		upgradeDatabaseToV1(database, transaction);
	}

	if (
		(!database && DATABASE_VERSION >= 2) || // Logic for dry Run, Object Stores to store only up to DATABASE_VERSION
		(database && (!database.db.version || (oldVersion < 2 && database.db.version >= 2)))
	) {
		// Or we dont have version in DB, OR we are in range oldVersion < 1 <= db.version
		upgradeDatabaseToV2(database, transaction);
	}

	if (
		(!database && DATABASE_VERSION >= 3) || // Logic for dry Run, Object Stores to store only up to DATABASE_VERSION
		(database && (!database.db.version || (oldVersion < 3 && database.db.version >= 3)))
	) {
		// Or we dont have version in DB, OR we are in range oldVersion < 1 <= db.version
		upgradeDatabaseToV3(database, transaction);
	}

	// if ((!database) || (!database.db.version || database.db.version === 1)) {
	// 	upgradeDatabaseToV1(database, transaction);
	// }

	// if ((!database) || (!database.db.version || database.db.version === 2)) {
	// 	upgradeDatabaseToV2(database, transaction);
	// }

	OBJECT_STORES_SEALED = true;
}

// --------------- cloudempiere database definitions ---------------------

const DATABASE_NAME_CLOUDEMPIERE = 'cloudempiereDb';

export function GetCloudempiereDatabase(): Promise<any> {
	upgradeDatabase(null, null, null); // dry run to init global variable  OBJECT_STORES as a side effect
	let dresult = getDatabase(DATABASE_NAME_CLOUDEMPIERE, DATABASE_VERSION, upgradeDatabase);
	return dresult.promise;
}

export function DeleteCloudempiereDatabase(): Promise<any> {
	let dresult = deleteDatabase(DATABASE_NAME_CLOUDEMPIERE);
	return dresult.promise;
}
