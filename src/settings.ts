import { EventSource } from './eventSource';
import { getExecutionContext } from './executionContext';
import { getGlobalThis } from './globalThis';

import * as R from 'ramda';

class Settings {
	public settings: any;

	public settingsChangeEventSource: EventSource = new EventSource();

	constructor() {
		let settingsStr;

		// Read saved properties from local storage only if running in main thread. Worker threads
		// will be sent settings by event handler in eventSource.ts 'settingsChangeEventSource' registered in services/worker.ts.

		if (getGlobalThis().localStorage) {
			settingsStr = getGlobalThis().localStorage.getItem('cloudempiere.services.settings');
		}

		if (settingsStr) {
			this.settings = JSON.parse(settingsStr);

			// Normalise some attributes

			if (this.settings.physInvCountListFilter) {
				if (this.settings.physInvCountListFilter.MovementDate) {
					let millisecons = Date.parse(this.settings.physInvCountListFilter.MovementDate);
					if (isNaN(millisecons)) {
						throw new Error('cannot parse date');
					}
					this.settings.physInvCountListFilter.MovementDate = new Date(millisecons);
				}
			}
		} else {
			this.settings = {};
		}

		let needSave;
		if (!this.settings.hasOwnProperty('preferredLogin')) {
			this.settings.preferredLogin = 'email';
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('scannerType')) {
			this.settings.scannerType = 'auto';
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('defaultLanguage')) {
			this.settings.defaultLanguage = 'en';
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('defaultApplication')) {
			this.settings.defaultApplication = '1000020';
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('autoRefresh')) {
			this.settings.autoRefresh = 30;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('idleLogout')) {
			this.settings.idleLogout = 60;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('httpPingTimeout')) {
			// in millisecons
			this.settings.httpPingTimeout = 200;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('httpPingInterval')) {
			// in millisecons
			this.settings.httpPingInterval = 500;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isOffline')) {
			this.settings.isOffline = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isSQS')) {
			this.settings.isSQS = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isStomp')) {
			this.settings.isStomp = true;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('deviceId')) {
			this.settings.deviceId = '';
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('c_pos_id')) {
			this.settings.c_pos_id = 0;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isAutoPOST')) {
			this.settings.isAutoPOST = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('stompMessageRateIndicationWindowMilliseconds')) {
			this.settings.stompMessageRateIndicationWindowMilliseconds = 2000;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('stompMessageRateIndicationLimitCount')) {
			this.settings.stompMessageRateIndicationLimitCount = 50;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('pouchMessageRateIndicationWindowMilliseconds')) {
			this.settings.pouchMessageRateIndicationWindowMilliseconds = 2000;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('pouchMessageRateIndicationLimitCount')) {
			this.settings.pouchMessageRateIndicationLimitCount = 50;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('physInvCountListFilter')) {
			this.settings.physInvCountListFilter = {
				Ownership: 1,
			};
		}

		if (!this.settings.hasOwnProperty('posOrderListFilter')) {
			this.settings.posOrderListFilter = {
				Ownership: 1,
			};
		}

		if (!this.settings.hasOwnProperty('worksheetConfirmationsFilter')) {
			this.settings.worksheetConfirmationsFilter = {
				Ownership: 1,
			};
		}

		if (!this.settings.hasOwnProperty('isMProductPriceWorksheet')) {
			this.settings.isMProductPriceWorksheet = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebug')) {
			this.settings.isDebug = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugDatabase')) {
			this.settings.isDebugDatabase = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugMessages')) {
			this.settings.isDebugMessages = true;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('messagesDebugLevel')) {
			this.settings.messagesDebugLevel = 1;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugMessageParsing')) {
			this.settings.isDebugMessageParsing = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugMessageGroups')) {
			this.settings.isDebugMessageGroups = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('messageGroupsDebugLevel')) {
			this.settings.messageGroupsDebugLevel = 1;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugPouchDb')) {
			this.settings.isDebugPouchDb = false;
			needSave = true;
		}
		if (!this.settings.hasOwnProperty('pouchDbDebugLevel')) {
			this.settings.pouchDbDebugLevel = 0;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugDocuments')) {
			this.settings.isDebugDocuments = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugProcesses')) {
			this.settings.isDebugProcesses = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugLoggingWorker')) {
			this.settings.isDebugLoggingWorker = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugNet')) {
			this.settings.isDebugNet = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isStorageLevelsOnline')) {
			this.settings.isStorageLevelsOnline = true;
			needSave = true;
		}

		if (needSave && getGlobalThis().localStorage) {
			this.save();
		}
	}

	save() {
		let executionContext = getExecutionContext();
		this.settings = this.initForTestining(this.settings);
		if (executionContext.isServerSide === false) {
			let settingsStr = JSON.stringify(this.settings);
			if (getGlobalThis().localStorage) {
				getGlobalThis().localStorage.setItem('cloudempiere.services.settings', settingsStr);
			} else {
				throw new Error('settings: save() is not allowed to call from worker thread!');
			}
		}
		EventSource.settingsChangeEventSource.generateEvent(this.settings);
	}

	initForTestining(settings) {
		settings = R.clone(settings);
		if (false) {
			settings.isDebug = true;
			settings.isDebugMessageGroups = true;
			settings.messageGroupsDebugLevel = 1;
			return settings;
		} else {
			return settings;
		}
	}

	setPhysInvCountListFilter(filter) {
		this.settings.physInvCountListFilter = filter;
		this.save();
	}

	setPosOrderListFilter(filter) {
		this.settings.posOrderListFilter = filter;
		this.save();
	}

	setWorksheetConfirmationsFilter(filter) {
		this.settings.worksheetConfirmationsFilter = filter;
		this.save();
	}
}

export let settings: Settings = new Settings();
