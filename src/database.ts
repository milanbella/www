import { PROJECT_NAME } from './consts';
import { waitFor } from './common/utils';
import { settings } from './settings';
import { Logger } from './types';
import { getLogger } from './logger';

import * as _ from 'underscore';

let gDb: any;
let logger = getLogger(PROJECT_NAME, 'database.ts');

export class Database {
	public getDatabaseFilename: any;
	public reset: any;
	public execute: any;
	public schemaInit: any;
	public DBInstanceInit: any;
	public getDb: any;

	private usedDatabaseImplemntation: string;
	private schemaInitCalled = false;
	public init: any;

	constructor() {
		const FUNC = 'Database.constructor()';
		let database_name = 'database.db';
		let self = this;

		let db;

		this.getDatabaseFilename = () => {
			return database_name;
		};

		// init handle to db instance

		if (window['sqlitePlugin']) {
			db = window['sqlitePlugin'].openDatabase({
				name: this.getDatabaseFilename(),
				location: 'default',
			});
			logger.info(FUNC, 'database.ts: using sqlite plugin');
			this.usedDatabaseImplemntation = 'sqlite plugin';
		} else {
			db = window['openDatabase'](this.getDatabaseFilename(), '1', 'my', 1024 * 1024 * 100);
			logger.info(FUNC, 'database.ts: using browser websql');
			this.usedDatabaseImplemntation = 'browser websql';
		}

		function executeSqlFile(fileName): Promise<any> {
			const FUNC = 'executeSqlFile()';
			let werr = new Error('Database:executeSqlFile(): db');
			return waitFor(() => {
				return db;
			}, werr).then(() => {
				if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
					logger.info(FUNC, 'Database.executeSqlFile: ' + self.usedDatabaseImplemntation);
					logger.info(FUNC, 'Database.executeSqlFile: ' + fileName);
				}
				return fetchFile('assets/db/' + fileName).then((text) => {
					let sqls = text.split('\n');

					sqls = _.filter(sqls, (str: string) => {
						return null === str.match(/^(\s*)$/); // remove empty lines
					});
					return new Promise<any>((resolve, reject) => {
						db.transaction(
							(tx) => {
								_.each(sqls, (sql) => {
									tx.executeSql(
										sql,
										[],
										() => {},
										(_tx, err) => {
											logger.error(FUNC, `Database.executeSqlFile: executeSql: ${fileName}`, err);
											reject(err);
										}
									);
								});
							},
							(err) => {
								logger.error(FUNC, `Database.executeSqlFile: executeSqlFile: transaction error: ${fileName}`, err);
								reject(err);
							},
							() => {
								if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
									logger.info(FUNC, 'Database.executeSqlFile: executeSqlFile: transaction finished ok: ' + fileName);
								}
								resolve(undefined);
							}
						);
					});
				});
			});
		}

		this.schemaInitCalled = false;

		this.schemaInit = (): Promise<any> => {
			const FUNC = 'schemaInit()';
			let werr = new Error('Database:schemaInit(): db');
			return waitFor(() => {
				return db;
			}, werr).then(() => {
				if (!this.schemaInitCalled) {
					this.schemaInitCalled = true;
					let wasInit = window.localStorage.getItem('cloudempiere.services.database.init');
					if (wasInit) {
						return Promise.resolve();
					} else {
						logger.info(FUNC, 'database.ts: init database .....');
						return executeSqlFile('drop.sql')
							.then(() => {
								return executeSqlFile('create.sql');
							})
							.then(() => {
								logger.info(FUNC, 'database.ts: init database ok');
								window.localStorage.setItem('cloudempiere.services.database.init', 'true');
							})
							.catch((err) => {
								window.localStorage.setItem('cloudempiere.services.database.init', 'true');
								logger.error(FUNC, `Database.schemaInit: failed`, err);
								return Promise.resolve();
							});
					}
				} else {
					return Promise.resolve();
				}
			});
		};

		this.execute = (sql, binding): Promise<any> => {
			const FUNC = 'execute()';
			if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
				logger.info(FUNC, 'Database.execute: ' + self.usedDatabaseImplemntation);
				logger.info(FUNC, 'Database.execute: ' + sql);
			}
			return this.schemaInit().then(() => {
				return new Promise<any>((resolve, reject) => {
					db.transaction(
						(tx) => {
							tx.executeSql(
								sql,
								binding,
								(_tx, results) => {
									resolve(results);
								},
								(_tx, err) => {
									logger.error(FUNC, `Database.execute: tx.executeSql: `, err);
									reject(err);
								}
							);
						},
						(err) => {
							logger.error(FUNC, `Database.execute: transaction: `, err);
						},
						() => {}
					);
				});
			});
		};

		this.getDb = (): Promise<any> => {
			// init handle to db instance
			return this.schemaInit().then(() => {
				return db;
			});
		};

		gDb = this.getDb();
	}
}

function fetchFile(url): Promise<any> {
	const FUNC = 'fetchFile()';
	return new Promise<any>((resolve, reject) => {
		let xhttp: any = new XMLHttpRequest();
		xhttp.timeout = 20000;
		xhttp.onreadystatechange = () => {
			if (xhttp.readyState === 4) {
				if (xhttp.status === 200) {
					resolve(xhttp.responseText);
				} else {
					reject();
				}
			}
		};
		xhttp.open('GET', url, true);
		xhttp.send();

		xhttp.ontimeout = () => {
			logger.error(FUNC, `database.ts: fetchFille(): timeout`);
			let err = new Error('database.ts: fetchFille(): timeout');
			return reject(err);
		};

		xhttp.error = (err) => {
			logger.error(FUNC, `database.ts: fetchFille() failed: `, err);
			return reject(err);
		};
	});
}

export function getDatabase(): Promise<any> {
	let werr = new Error('database.ts:getDatabase(): gDb');
	return waitFor(function () {
		return gDb;
	}, werr);
}

export let database: Database = new Database();
