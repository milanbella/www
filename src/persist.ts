import { GetCloudempiereDatabase as getDb, Database, Dresult } from './idbDatabase';

import * as _ from 'underscore';

export class Persist {
	private _db;

	constructor() {}

	async _getDb(db?) {
		if (db) {
			return db;
		} else {
			if (this._db) {
				return this._db;
			} else {
				this._db = await getDb();
				return this._db;
			}
		}
	}

	async getDb() {
		return this._getDb();
	}

	async tableExists(tableName: string, _db?: Database) {
		let db = await this._getDb(_db);
		return db.tableExists(tableName);
	}

	async primaryKeyExists(tableName: string, primaryKeyKeys: string[], _db?: Database) {
		let db = await this._getDb(_db);
		return db.primaryKeyExists(tableName, primaryKeyKeys);
	}

	async findIndexName(tableName: string, indexKeys: string[], _db?: Database) {
		let db = await this._getDb(_db);
		return db.findIndexName(tableName, indexKeys);
	}

	async getRecord(tableName: string, key: any, _db?: Database) {
		let db = await this._getDb(_db);
		return db.getRecord(tableName, key);
	}

	async getRecords(tableName: string, key?: any, _db?: Database) {
		let db = await this._getDb(_db);
		return db.getRecords(tableName, key);
	}

	async getIndexRecord(tableName: string, indexName, key: any, _db?: Database) {
		let db = await this._getDb(_db);
		return db.getIndexRecord(tableName, indexName, key);
	}

	async getIndexRecords(tableName: string, indexName, key?: any, _db?: Database) {
		let db = await this._getDb(_db);
		return db.getIndexRecords(tableName, indexName, key);
	}

	async getRecordsCount(tableName: string, _db?: Database) {
		let db = await this._getDb(_db);
		return db.getRecordsCount(tableName);
	}

	async getIndexRecordsCount(tableName: string, indexName, key?: any, _db?: Database) {
		let db = await this._getDb(_db);
		return db.getIndexRecordsCount(tableName, indexName, key);
	}

	private buildKey(objectStore, record) {
		let key;
		let keyPath = objectStore.keyPath;
		let errs;
		if (_.isArray(keyPath)) {
			key = [];
			for (let k in keyPath) {
				if (!record.hasOwnProperty(keyPath[k])) {
					errs = `buildKey(): objectStore '${objectStore.name}': record is missing key part: ${keyPath[k]}`;
					console.error(errs);
					throw new Error(errs);
				}
				key.push(record[keyPath[k]]);
			}
		} else if (_.isString(keyPath)) {
			if (!record.hasOwnProperty(keyPath)) {
				errs = `buildKey(): objectStore '${objectStore.name}': record is missing key: ${keyPath}`;
				console.error(errs);
				throw new Error(errs);
			}
			key = record[keyPath];
		} else {
			errs = `buildKey(): objectStore '${objectStore.name}': unknown key path type`;
			console.error(errs);
			throw new Error(errs);
		}
		return key;
	}

	// Fetch the original record from database. Merge original record with supplied record and then write resulting record in the database.

	async updateRecord(tableName: string, record: any, key?: any, _db?: Database) {
		let db = await this._getDb(_db);

		let dresult: Dresult;
		let errs;

		dresult = db.openTransactionDresult([tableName], true);
		let transaction = dresult.transaction;

		let objectStore = dresult.transaction.objectStore(tableName);
		if (!key) {
			key = this.buildKey(objectStore, record);
		}

		dresult = db.getRecordDresult(tableName, key, transaction);
		return dresult.promise.then((recordOrig) => {
			if (!recordOrig) {
				let k = key.reduce((a, v) => {
					return (a += `'${v}', `);
				}, '');
				errs = `updateRecord(): objectStore '${tableName}': record not found for key: ${k}`;
				console.error(errs);
				throw new Error(errs);
			}

			let r = _.extendOwn(recordOrig, record);
			return db.putRecord(tableName, r, null, dresult.transaction);
		});
	}

	// Overwrite original record if exists in the database with supplied record, add the supplied record in the database otherwise.

	async saveRecord(tableName: string, record: any, key?: any, _db?: Database) {
		let db = await this._getDb(_db);

		let dresult: Dresult;

		dresult = db.openTransactionDresult([tableName], true);

		if (!key) {
			return db.putRecord(tableName, record, null, dresult.transaction);
		} else {
			return db.putRecord(tableName, record, key, dresult.transaction);
		}
	}

	async removeRecord(tableName: string, key: any, _db?: Database) {
		let db = await this._getDb(_db);
		return db.removeRecord(tableName, key);
	}

	async removeRecords(tableName: string, _db?: Database) {
		let db = await this._getDb(_db);
		return db.removeRecords(tableName);
	}

	// Inner join two sets of records on common 'column'. If 'outer' is specified then do left or right outer join instead inner join.
	// Both records sets are assumed to be already sorted according 'column' values but if 'sort' is true then both sets are sorted before joining them.

	joinRecords(records1: any[], records2: any[], column: string, outer?: 'left' | 'right', sort?: boolean) {
		function compareFn(record1: any, record2: any): number {
			if (record1[column] < record2[column]) {
				return -1;
			} else if (record1[column] === record2[column]) {
				return 0;
			} else {
				return 1;
			}
		}

		if (sort) {
			return _joinRecords(records1, records2, compareFn, outer, compareFn, compareFn);
		} else {
			return _joinRecords(records1, records2, compareFn, outer);
		}
	}

	joinRecords1(records1: any[], records2: any[], compareFn: (record1: any, record2: any) => number, outer?: 'left' | 'right', compareFn1?: (recordA: any, recordB: any) => number, compareFn2?: (recordA: any, recordB: any) => number) {
		return _joinRecords(records1, records2, compareFn, outer, compareFn1, compareFn2);
	}
}

export let persist: Persist = new Persist();

// Inner join two sets of records. To speed up join it is assumed that both sets are already sorted in way compatible with 'compareFn'.
// 'compareFn' compares record in the first set to record in the second set, it must return -1, 0, 1 (less, equal, greater).
//
// If 'compareFn1' is spcified then the first set is sorted using 'compareFn1' prior performing join.
// If 'compareFn2' is spcified then  the second set is sorted using 'compareFn2' prior performing join.
//
// Both sets must be sorted in way compatible with 'compareFn', for example following must hold true:
// If compareFn(record1A, record2A) === 0 and compareFn(record1B, record2B) === 0 and compareFn1(record1A, record1B) < 0 then compareFn2(record2A, record2B) < 0.
//
// It is possible to perfom left outer join or right outer if optional parameter 'outer' is specified.

export function _joinRecords(records1: any[], records2: any[], compareFn: (record1: any, record2: any) => number, outer?: 'left' | 'right', compareFn1?: (recordA: any, recordB: any) => number, compareFn2?: (recordA: any, recordB: any) => number) {
	function clone(rs: any[]) {
		return rs.reduce((a, r) => {
			a.push(r);
			return a;
		}, []);
	}

	if (compareFn1) {
		records1 = clone(records1);
		records1.sort(compareFn1);
	}
	if (compareFn2) {
		records2 = clone(records2);
		records2.sort(compareFn2);
	}

	let records = [];
	let o = 0;
	if (outer === 'left') {
		o = 1;
	} else if (outer === 'right') {
		o = 2;
	}

	let mask;
	if (o === 1) {
		mask = records1.reduce((a) => {
			a.push(false);
			return a;
		}, []);
	} else if (o === 2) {
		mask = records2.reduce((a) => {
			a.push(false);
			return a;
		}, []);
	}

	function assertR1R2(r1, r2) {
		if (!r1) {
			throw new Error('r1 is undefined');
		}
		if (!r2) {
			throw new Error('r2 is undefined');
		}
	}

	let i1 = 0,
		i2 = 0,
		r1,
		r2;
	while (true) {
		if (i1 < records1.length) {
			r1 = records1[i1];
		} else {
			break;
		}
		if (i2 < records2.length) {
			r2 = records2[i2];
		} else {
			break;
		}
		assertR1R2(r1, r2);
		if (compareFn(r1, r2) < 0) {
			++i1;
		} else if (compareFn(r1, r2) === 0) {
			records.push({
				r1: r1,
				r2: r2,
			});
			if (o === 1) {
				mask[i1] = true;
			} else if (o === 2) {
				mask[i2] = true;
			}
			while (true) {
				++i1;
				if (i1 < records1.length) {
					assertR1R2(r1, records1[i1]);
					if (compareFn(r1, records1[i1]) === 0) {
						records.push({
							r1: records1[i1],
							r2: r2,
						});
						if (o === 1) {
							mask[i1] = true;
						} else if (o === 2) {
							mask[i2] = true;
						}
					} else {
						break;
					}
				} else {
					break;
				}
			}
			while (true) {
				++i2;
				if (i2 < records2.length) {
					assertR1R2(r2, records2[i2]);
					if (compareFn(r2, records2[i2]) === 0) {
						records.push({
							r1: r1,
							r2: records2[i2],
						});
						if (o === 1) {
							mask[i1] = true;
						} else if (o === 2) {
							mask[i2] = true;
						}
					} else {
						break;
					}
				} else {
					break;
				}
			}
		} else {
			++i2;
		}
	}
	if (o === 1) {
		records = mask.reduce((a, b, i) => {
			if (b === false) {
				a.push({
					r1: records1[i],
					r2: null,
				});
			}
			return a;
		}, records);
	} else if (o === 2) {
		records = mask.reduce((a, b, i) => {
			if (b === false) {
				a.push({
					r1: null,
					r2: records2[i],
				});
			}
			return a;
		}, records);
	}

	return records;
}
