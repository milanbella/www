import { PROJECT_NAME } from '../consts';
import { waitFor } from '../common/utils';
import { pouch } from '../pouch1';
import { getLogger } from '../logger';
import { settings } from '../settings';
import { authPrincipal } from '../authprincipal';
import { cdDbObject, Principal } from '../types';

import * as _ from 'underscore';
import * as R from 'ramda';

let logger = getLogger(PROJECT_NAME, 'pouch-document1.ts');

function waitForPouchRunning(): Promise<any> {
	let werr = new Error('pouchDbObject.ts:waitForPouchRunning():  pouch.isRunning === true');
	return waitFor(function () {
		return pouch.isRunning === true;
	}, werr);
}

export class PouchDbObject {
	constructor() {}

	// see: https://pouchdb.com/guides/mango-queries.html
	public static async Find(mangoQueryOptions: any): Promise<cdDbObject[]> {
		const FUNC = 'Find()';
		try {
			await waitForPouchRunning();

			let startTime = new Date().getTime();
			let docs = await pouch.find(mangoQueryOptions);
			let endTime = new Date().getTime();

			let duration = endTime - startTime;
			if (duration > 1000) {
				let errs = `query execution took too long: ${duration} ms, query: ${JSON.stringify(mangoQueryOptions)}`;
				logger.error(FUNC, errs);
			}

			return docs.docs as cdDbObject[];
		} catch (err) {
			let errs = `error: ` + err;
			logger.error(FUNC, errs);
			throw err;
		}
	}

	public static async CreateDocument(doc: cdDbObject, id?: any): Promise<cdDbObject> {
		const FUNC = 'CreateDocument()';
		try {
			await waitForPouchRunning();

			doc = R.clone(doc);

			if (!doc.DB_TableName) {
				let errs = `error: document is missing 'DB_TableName'`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				return Promise.reject(err);
			}
			let documentName = doc.DB_TableName;
			doc.modifiedDate = new Date().toISOString();

			let principal: Principal = await authPrincipal.getPrincipal();
			if (!principal) {
				let errs = `${documentName}:  error: no auth principal`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}

			let response = await pouch.createDoc(doc, id);
			if (response.ok) {
				doc._id = response.id;
				doc._rev = response.rev;

				return doc;
			} else {
				let errs = `${documentName}: document not created: ` + JSON.stringify(response);
				logger.error(FUNC, errs);
				throw new Error(errs);
			}
		} catch (err) {
			let errs = `error: ` + err;
			logger.error(FUNC, errs);
			throw err;
		}
	}

	public static async UpdateDocument(doc: cdDbObject): Promise<cdDbObject> {
		const FUNC = 'UpdateDocument()';
		try {
			await waitForPouchRunning();

			if (!doc.DB_TableName) {
				let errs = `error: document is missing 'DB_TableName'`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}
			let documentName = doc.DB_TableName;
			if (!doc._id) {
				let errs = `${documentName}: document is missing _id`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}
			if (!doc._rev) {
				let errs = `${documentName}: document is missing _rev`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}

			doc = R.clone(doc);
			doc.modifiedDate = new Date().toISOString();

			let rdoc: cdDbObject = await pouch.getDoc(doc._id);
			doc._rev = rdoc._rev;
			let response = await pouch.updateDoc(doc, true);
			if (response.ok) {
				doc._id = response.id;
				doc._rev = response.rev;
				if (settings.settings.isDebug && settings.settings.isDebugDocuments) {
					logger.info(FUNC, `${documentName}: document updated: ` + JSON.stringify(doc) + ' ' + JSON.stringify(response));
				}
				return doc;
			} else {
				let errs = `${documentName}: document not updated: ` + ' ' + JSON.stringify(doc) + ' ' + JSON.stringify(response);
				logger.error(FUNC, errs);
				throw new Error(errs);
			}
		} catch (err) {
			let errs = `error: ` + err;
			logger.error(FUNC, errs);
			throw err;
		}
	}

	static DocMapForUpdateDocumentSerially: any = {};

	// Serialize updates for given document to avoid conflicts.

	public static UpdateDocumentSerially(doc: cdDbObject): Promise<cdDbObject> {
		return waitForPouchRunning().then(() => {
			let promise = PouchDbObject.DocMapForUpdateDocumentSerially[doc._id];
			if (promise) {
				promise = promise.then(
					() => {
						return PouchDbObject.UpdateDocument(doc);
					},
					() => {
						return PouchDbObject.UpdateDocument(doc);
					}
				);
			} else {
				promise = PouchDbObject.UpdateDocument(doc);
			}
			PouchDbObject.DocMapForUpdateDocumentSerially[doc._id] = promise;

			return promise;
		});
	}

	public static async GetDocument(id: string, noNotFoundError?: boolean): Promise<cdDbObject> {
		const FUNC = 'GetDocument()';
		try {
			await waitForPouchRunning();
			let doc: cdDbObject = await pouch.getDoc(id, noNotFoundError);
			if (doc) {
				if (settings.settings.isDebug && settings.settings.isDebugDocuments) {
					logger.info(FUNC, `got document: ` + JSON.stringify(doc));
				}
				if (!doc.DB_TableName) {
					let errs = `error: document is missing 'DB_TableName'`;
					logger.error(FUNC, errs);
					let err = new Error(errs);
					return Promise.reject(err);
				}
				return doc;
			} else {
				return null;
			}
		} catch (err) {
			let errs = `error: ` + err;
			logger.error(FUNC, errs);
			throw err;
		}
	}

	public static async DeleteDocument(doc: cdDbObject): Promise<void> {
		const FUNC = 'DeleteDocument()';
		try {
			await waitForPouchRunning();
			let id = doc._id;
			let rev = doc._rev;
			if (!id) {
				let errs = `missing _id`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}
			if (!rev) {
				let errs = `missing _rev`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}
			if (!doc.DB_TableName) {
				let errs = `error: document is missing 'DB_TableName'`;
				logger.error(FUNC, errs);
				let err = new Error(errs);
				throw err;
			}

			await authPrincipal.getPrincipal();
			try {
				let v: any = await pouch.deleteDoc(id, rev);
				return v;
			} catch (err) {
				let _err = JSON.parse(err); // errors from worker come in stringified json format since we cannot sent Error object directly via channel
				if (_err.name === 'conflict') {
					// read latest version
					let _doc: any = await pouch.getDoc(id, true);
					logger.warn(FUNC, `conflict: `, null, {
						memoryDoc: JSON.stringify(doc),
						pouchDoc: JSON.stringify(_doc),
					});
					let response = await pouch.deleteDoc(_doc._id, _doc._rev);
					if (settings.settings.isDebug && settings.settings.isDebugDocuments) {
						logger.info(FUNC, `deleted document: ${id} ${rev} :` + JSON.stringify(response));
					}
				} else {
					throw _err;
				}
			}
		} catch (err) {
			let errs = `error: ` + err;
			logger.error(FUNC, errs);
			throw err;
		}
	}
}
