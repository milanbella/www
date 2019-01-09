import { promiseResolve, promiseReject, waitFor } from '../common/utils';
import { settings } from './settings';
import { logger } from './logger';

import  { _ } from 'underscore';

var gDb: any;

export class Database {
	public getDatabaseFilename: any;
	public reset: any;
	public execute: any;
	public schemaInit: any;
	public DBInstanceInit: any;
	public getDb: any;

	private usedDatabaseImplemntation: string;
	private schemaInitCalled: boolean = false;
	public init: any;

	constructor () {

		var database_name = 'database.db';
		var self=this;

		var db;

		this.getDatabaseFilename = () =>
		{
			return database_name;
		};

		// init handle to db instance

		if (window['sqlitePlugin']) {
			db = window['sqlitePlugin'].openDatabase({ name: this.getDatabaseFilename(), location: 'default' });
			console.info('database.ts: using sqlite plugin');
			this.usedDatabaseImplemntation = 'sqlite plugin';
		} else {
			db = window['openDatabase'](this.getDatabaseFilename(), '1', 'my', 1024 * 1024 * 100);
			console.info('database.ts: using browser websql');
			this.usedDatabaseImplemntation = 'browser websql';
		}



		function executeSqlFile (fileName) : Promise<any> {
			return waitFor(() => {
				return db;
			}).then(() => {
				if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
					console.debug('Database.executeSqlFile: '  + self.usedDatabaseImplemntation);
					console.debug('Database.executeSqlFile: '  + fileName);
				}
				return fetchFile('assets/db/' + fileName).then((text) => {
					var sqls = text.split('\n');

					sqls = _.filter(sqls, (str) => {
						return null === str.match(/^(\s*)$/); // remove empty lines
					});
					return new Promise<any>((resolve, reject) => {
						db.transaction((tx) => {
							_.each(sqls, (sql) => {
								tx.executeSql(sql, [], () => {
								}, (tx, err) => {
									console.error('Database.executeSqlFile: executeSql: ' + fileName + ' ' + err);
									console.dir(err);
									logger.error('Database.executeSqlFile: executeSql: ' + fileName + ' ' + err, err, {event: 'SQL'});
									reject(err);
								});
							});
						}, (err) => {
							console.error('Database.executeSqlFile: executeSqlFile: transaction error: ' + fileName + ' : ' + err);
							logger.error('Database.executeSqlFile: executeSqlFile: transaction error: ' + fileName + ' : ' + err, err, {event: 'SQL'});
							reject(err);
						}, () => {
							if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
								console.debug('Database.executeSqlFile: executeSqlFile: transaction finished ok: ' + fileName);
							}
							resolve();
						});
					});
				});
			});
		}

		this.schemaInitCalled = false;


		this.schemaInit  = () : Promise<any> => {
			return waitFor(() => {
				return db;
			}).then(() => {
				if (!this.schemaInitCalled) {
					this.schemaInitCalled = true;
					var wasInit = window.localStorage.getItem('cloudempiere.services.database.init');
					if (wasInit) {
						return promiseResolve();
					} else {
						console.error('database.ts: init database .....');
						return executeSqlFile('drop.sql')
						.then(() => {
							return executeSqlFile('create.sql');
						})
						.then(() => {
							console.error('database.ts: init database ok');
							window.localStorage.setItem('cloudempiere.services.database.init', 'true');
						})
						.catch((err) => {
							console.error('database.ts: init database failed');
							window.localStorage.setItem('cloudempiere.services.database.init', 'true');
							console.error('Database.schemaInit: failed');
							console.dir(err);
							logger.error('Database.schemaInit: failed', err, {event: 'SQL'});
							//return promiseReject(err);
							return promiseResolve();
						});
					}
				} else {
					return promiseResolve();
				}
			});
		};

		this.execute = (sql, binding) : Promise<any> => {
			if (settings.settings.isDebug && settings.settings.isDebugDatabase) {
				console.debug('Database.execute: '  + self.usedDatabaseImplemntation);
				console.debug('Database.execute: ' + sql);
			}
			return this.schemaInit().then(() => {
				return new Promise<any>((resolve, reject) => {
					db.transaction((tx) => {
						tx.executeSql(sql, binding, (tx, results) => {
							resolve(results);
						}, (tx, err) => {
							console.error('Database.execute: tx.executeSql: ' + err);
							console.dir(err);
							logger.error('Database.execute: tx.executeSql: ' + err, err, {event: 'SQL'});
							reject(err);
						});
					}, (err) => {
						console.error('Database.execute: transaction: ' + err);
						console.dir(err);
						logger.error('Database.execute: transaction: ' + err, err, {event: 'SQL'});
					}, () => {
					});
				});
			});
		};

		this.getDb = () : Promise<any> => {
			// init handle to db instance
			return this.schemaInit().then(() => {
				return db;
			})
		}

		gDb = this.getDb();
	}
}

function fetchFile (url): Promise<any> {

	return new Promise<any>((resolve, reject) => {
		var xhttp: any = new XMLHttpRequest();
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
			console.error('database.ts: fetchFille(): timeout');
			logger.error('database.ts: fetchFille(): timeout');
			var err = new Error('database.ts: fetchFille(): timeout');
			return reject(err);
		};

		xhttp.error = (err) => {
			console.error('database.ts: fetchFille() failed:');
			console.dir(err);
			logger.error('atabase.ts: fetchFille() failed:', err);
			return reject(err);
		};
	});
}

export function getDatabase (): Promise<any> {
	return waitFor(function () {return gDb;}); 
}

export var database: Database = new Database();
