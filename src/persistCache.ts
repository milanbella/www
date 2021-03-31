import { Database } from './idbDatabase';
import { persist } from './persist';

import * as _ from 'underscore';

const REPORT_CACHE_MISS = true;

export class PersistCache {
	private cache = {};

	constructor() {
		let startTime = Date.now();
		console.log('PersistCache: building cache ...');
		this.buildCache().then(() => {
			let endTime = Date.now();
			console.log(`PersistCache: cache built in ${endTime - startTime} ms`);
		});
	}

	async getRecord(tableName: string, key: any, _db?: Database) {
		let ckey;
		if (!_.isArray(key)) {
			return persist.getRecord(tableName, key, _db).then((r) => {
				if (r && REPORT_CACHE_MISS) {
					console.warn(`PersistCache: cache miss for table: ${tableName}`);
					console.dir(key);
					console.dir(r);
				}
				return r;
			});
		} else {
			ckey = key.reduce((a, v) => {
				a += v;
				return a;
			}, '');
		}
		if (this.cache[tableName]) {
			let r = this.cache[tableName][ckey];
			if (r) {
				return r;
			} else {
				return persist.getRecord(tableName, key, _db).then((r) => {
					if (r && REPORT_CACHE_MISS) {
						console.warn(`PersistCache: cache miss for table: ${tableName}`);
						console.dir(key);
						console.dir(r);
					}
					return r;
				});
			}
		} else {
			return persist.getRecord(tableName, key, _db).then((r) => {
				if (r && REPORT_CACHE_MISS) {
					console.warn(`PersistCache: cache miss for table: ${tableName}`);
					console.dir(key);
					console.dir(r);
				}
				return r;
			});
		}
	}

	private buildCache(): Promise<any> {
		let promise,
			promises = [];

		promise = persist.getRecords('m_product').then((rs) => {
			this.cache['m_product'] = rs.reduce((a, r) => {
				a['' + r.m_product_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('m_locator').then((rs) => {
			this.cache['m_locator'] = rs.reduce((a, r) => {
				a['' + r.m_locator_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('m_warehouse').then((rs) => {
			this.cache['m_warehouse'] = rs.reduce((a, r) => {
				a['' + r.m_warehouse_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('c_uom').then((rs) => {
			this.cache['c_uom'] = rs.reduce((a, r) => {
				a['' + r.c_uom_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('c_uom_trl').then((rs) => {
			this.cache['c_uom_trl'] = rs.reduce((a, r) => {
				a['' + r.c_uom_id + r.ad_language] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('c_bpartner').then((rs) => {
			this.cache['c_bpartner'] = rs.reduce((a, r) => {
				a['' + r.c_bpartner_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('ad_user').then((rs) => {
			this.cache['ad_user'] = rs.reduce((a, r) => {
				a['' + r.ad_user_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('c_bpartner_location').then((rs) => {
			this.cache['c_bpartner_location'] = rs.reduce((a, r) => {
				a['' + r.c_bpartner_location_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		promise = persist.getRecords('c_doctype').then((rs) => {
			this.cache['c_doctype'] = rs.reduce((a, r) => {
				a['' + r.c_doctype_id] = r;
				return a;
			}, {});
		});
		promises.push(promise);

		return Promise.all(promises);
	}
}
export let persistCache: PersistCache = new PersistCache();
