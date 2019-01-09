import { settings } from './settings';
import { authPrincipal } from './authprincipal';
import { EventSource } from './eventSource';
import { getLogger, Logger } from './logger';
import { waitFor } from '../common/utils';

import PouchDB from 'pouchdb';
import PouchDBfind from 'pouchdb-find';
import PouchdbDebug from 'pouchdb-debug';
import  { _ } from 'underscore';

PouchDB.plugin(PouchDBfind);
PouchDB.plugin(PouchdbDebug);

var logger = getLogger('Pouch');

var logEvent = {event: 'Pouch'};

class Pouch  {

	private couch: any;
	private db: any;
	private stoped = false;

	hSync: any;

	private syncCompleted: boolean = false;
	
	constructor() {}

	async start () {
		console.info('Pouch.start(): start pouchdb');
		logger.info('Pouch.start(): start pouchdb', null, logEvent);
		
		if (settings.settings.isDebug && settings.settings.isDebugPouchDb) {
			PouchDB.debug.enable('*');
			logger.info('Pouch.start(): debug enabled', null, logEvent);
			console.info('Pouch.start(): debug enabled');
		} else {
			PouchDB.debug.disable();
		}

		var principal = await authPrincipal.getPrincipal();
		if (!principal) {
			logger.error('Pouch.start(): start: pouch not statted: no principal: did you already log in?');
			console.error('Pouch.start(): start: pouch not statted: no principal: did you already log in?');
			return false;
		}
		let x_auth_username = principal.x_auth_username;
			
		this.couch =  new PouchDB('https://couch.cloudempiere.com/tenant_' +  principal.adClientId,  { 
			skip_setup: true, 
				
			fetch: function (url, opts) {
				opts.headers.set('X-Auth-CouchDB-UserName', x_auth_username);
				return PouchDB.fetch(url, opts);
			}
		});		

		this.db = new PouchDB('pouchDB', {
			auto_compaction: true, 
			adapter: 'idb'
		});


		this.syncCompleted = false;
		this.sync();
		return true;
	}

	async stop () {
		logger.info('Pouch.stop(): stop pouchdb', null, logEvent);
		console.info('Pouch.stop(): stop pouchdb');
		this.stoped = true;
		if(this.hSync) {
			this.hSync.cancel();
		}
		this.db = null;
		this.couch = null;
	}

	async getDb () {
		if (!this.db) {
			var ok = await this.start();
		}
		if (!this.db) {
			logger.error('Pouch.getDb(): no db');
			console.error('Pouch.getDb(): no db');
			throw Error('Pouch.getDb(): no db');
		}
		await this.waitForSyncComplete();
		return this.db;
	}

	async getCouch () {
		if (!this.couch) {
			var ok = await this.start();
		}
		if (!this.db) {
			logger.error('Pouch.getCouch(): no db');
			console.error('Pouch.getCouch(): no db');
			throw Error('Pouch.getCouch(): no db');
		}
		await this.waitForSyncComplete();
		return this.couch;
	}

	waitForSyncComplete () : Promise<any> {
		return waitFor(() => {
			return this.syncCompleted === true;
		});

	}

	sync() {
		logger.info('Pouch.sync(): sync pouchdb', null, logEvent);
		console.info('Pouch.sync(): sync pouchdb');

		if (!this.db) {
			logger.error('Pouch.sync(): sync: pouch.db not initialized', null, logEvent);
			console.error('Pouch.sync(): sync: pouch.db not initialized');
			throw new Error('Pouch.sync(): sync: pouch.db not initialized');
		}

		let oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

		let options = {
			live: true,
			retry: true
			// ,
			// filter: 'app/after_date',
			// query_params: { 'afterDate': oneWeekAgo }
		};

		this.hSync = this.db.sync(this.couch, options)
		.on('error',(err) => {
			logger.error('Pouch.sync(): sync: error: ' + err, err, logEvent);
			console.error('Pouch.sync(): sync: error: ' + err);
			if (this.stoped) {
				return;
			}
			if(err.status === 401) {
					logger.info('Pouch.sync(): sync: got status 401 - unauthorised: going to retry sync ...', logEvent);
					logger.info('Pouch.sync(): sync: got status 401 - unauthorised: going to retry sync ...');
					this.sync();
			}
			else if(err.status === 403) {
				logger.info('Pouch.sync(): sync: got status 403 - forbidden: going to retry sync ...', logEvent);
				logger.info('Pouch.sync(): sync: got status 403 - forbidden: going to retry sync ...');
				this.sync();
			}
		}).on('change', (info) => {
			if (settings.settings.isDebug) {
				logger.debug('Pouch.sync(): sync: change:' + info, info, logEvent);
				console.debug('Pouch.sync(): sync: change:' + info);
				console.dir(info);
			}
			if (this.stoped) {
				return;
			}
		}).on('paused', (err) => {
			if (settings.settings.isDebug) {
				logger.debug('Pouch.sync(): sync: paused: ' + err, err, logEvent);
				console.debug('Pouch.sync(): sync: paused: ' + err);
			}
			if (this.stoped) {
				return;
			}
			this.syncCompleted = true;
		}).on('active', () => {
			if (settings.settings.isDebug) {
				logger.debug('Pouch.sync(): sync: active', null, logEvent);
				console.debug('Pouch.sync(): sync: active');
			}
			if (this.stoped) {
				return;
			}
		}).on('denied', (err) => {
			if (settings.settings.isDebug) {
				logger.debug('Pouch.sync(): sync: denied:' + err, err, logEvent);
				console.debug('Pouch.sync(): sync: denied:' + err);
			}
			if (this.stoped) {
				return;
			}
		}).on('complete', (info) => {
			if (settings.settings.isDebug) {
				logger.debug('Pouch.sync(): sync: complete: ' + info, info, logEvent);		
				console.debug('Pouch.sync(): sync: complete: ' + info);	
			}
			if (this.stoped) {
				return;
			}

			this.syncCompleted = true;
		});


	}

	async createDoc (doc :any, id? :string)  {
		if (settings.settings.isDebug) {
			logger.debug('Pouch.createDoc(): createDoc', null, logEvent);
			console.debug('Pouch.createDoc(): createDoc');
		}

		var db = await this.getDb();

		if(id) {
			doc._id = id;

			return db.put(doc);
		} else {
			return db.post(doc);
		}
	
	}

	async updateDoc (doc) {
		if (settings.settings.isDebug) {
			logger.debug('Pouch.updateDoc(): updateDoc', null, logEvent);
			console.debug('Pouch.updateDoc(): updateDoc');
		}

		var db = await this.getDb();

		return db.put(doc);
	}

	async deleteDoc (docOrId: any, rev?: string) {
		if (settings.settings.isDebug) {
			logger.debug('Pouch.deleteDoc(): deleteDoc', null, logEvent);
			console.debug('Pouch.deleteDoc(): deleteDoc');
		}

		var db = await this.getDb();

		if (_.isObject(docOrId)) {
			return db.remove(docOrId);
		} else {
			if (_.isString(docOrId)) {
				return db.remove(docOrId, rev);
			} else {
				logger.error('Pouch.deleteDoc(): docOrId argument must be document or id', null, logEvent);
				console.error('Pouch.deleteDoc(): docOrId argument must be document or id');
				throw new Error('Pouch.deleteDoc(): docOrId argument must be document or id');
			}
		}
	}

	async getDoc (id: string) {
		if (settings.settings.isDebug) {
			logger.debug('Pouch.getDoc(): getDoc:', null, logEvent);
			console.debug('Pouch.getDoc(): getDoc')
		}

		var db = await this.getDb();

		return db.get(id);
	}
}

export var pouch = new Pouch();
