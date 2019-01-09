import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EventSource } from './eventSource';

class Settings {

	public settings: any;

	public settingsChangeEventSource: EventSource = new EventSource();

	constructor () {

		var settingsStr;

		// Read saved properties from local storage only if running in main thread. Worker threads 
		// will be sent settings by event handler in eventSource.ts 'settingsChangeEventSource' registered in services/worker.ts.

		if (self.localStorage) {
			settingsStr = self.localStorage.getItem('cloudempiere.services.settings');
		}

        if (settingsStr) {                                                                                                                                                   
            this.settings = JSON.parse(settingsStr);                                                                                                                         
        } else {                                                                                                                                                             
            this.settings = {};                                                                                                                                              
        }

		var needSave;
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
			this.settings.defaultApplication = 1000020;
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

		if (!this.settings.hasOwnProperty('httpPingTimeout')) { // in millisecons
			this.settings.httpPingTimeout = 10000;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('httpPingInterval')) { // in millisecons
			this.settings.httpPingInterval = 5000;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebug')) {
			//this.settings.isDebug = false;
			this.settings.isDebug = true;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugDatabase')) {
			this.settings.isDebugDatabase = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugSQS')) {
			//this.settings.isDebugSQS = false;
			this.settings.isDebugSQS = true;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('sqsDebugLevel')) {
			this.settings.sqsDebugLevel = 1;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugSQSparsing')) {
			this.settings.isDebugSQSparsing = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isDebugPouchDb')) {
			this.settings.isDebugPouchDb = false;
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

		if (!this.settings.hasOwnProperty('isOffline')) {
			this.settings.isOffline = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isSQS')) {
			this.settings.isSQS = true;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('deviceId')) {
			if(self['device'])
			{
				this.settings.deviceId = self['device'].uuid;
			}
			else {
				this.settings.deviceId = 'Browser1';
			}
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('c_pos_id')) {
			this.settings.c_pos_id = 0;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('sqsMode')) {
			this.settings.sqsMode = 'continuous';
			needSave = true;
		}
		
		if (!this.settings.hasOwnProperty('isAutoPOST')) {
			this.settings.isAutoPOST = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('isAutoPOST')) {
			this.settings.isAutoPOST = false;
			needSave = true;
		}

		if (!this.settings.hasOwnProperty('physInvCountListFilter')) {
			this.settings.physInvCountListFilter = {
				Ownership: 1
			}
		}

		if (needSave && self.localStorage) {
			this.save();
		}
	}

	save () {
        var settingsStr = JSON.stringify(this.settings);                                                                                                                     
		if (self.localStorage) {
			self.localStorage.setItem('cloudempiere.services.settings', settingsStr);
		} else {
			throw new Error('settings: save() is not allowed to call from worker thread!')
		}
		EventSource.settingsChangeEventSource.generateEvent(this.settings)
	}

	setPhysInvCountListFilter (filter) {
		this.settings.physInvCountListFilter = filter;
		this.save();
	}

}

export var settings: Settings = new Settings();
