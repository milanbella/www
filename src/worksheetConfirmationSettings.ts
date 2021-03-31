class WorksheetConfirmationSettings {
	public settings: any;

	constructor() {
		let settingsStr;

		// Read saved properties from local storage only if running in main thread. Worker threads
		// will be sent settings by event handler in eventSource.ts 'settingsChangeEventSource' registered in services/worker.ts.

		if (self.localStorage) {
			settingsStr = self.localStorage.getItem('cloudempiere.services.worksheetconfirmationsettings');
		}

		if (settingsStr) {
			this.settings = JSON.parse(settingsStr);
		} else {
			this.settings = {};
		}

		let needSave;

		// Check Storage Level before Save Inv Move Line
		if (!this.settings.hasOwnProperty('isConfirmationWizardDefault')) {
			this.settings.isConfirmationWizardDefault = true;
			needSave = true;
		}

		if (needSave && self.localStorage) {
			this.save();
		}
	}

	save() {
		let settingsStr = JSON.stringify(this.settings);
		if (self.localStorage) {
			self.localStorage.setItem('cloudempiere.services.worksheetconfirmationsettings', settingsStr);
		} else {
			throw new Error('worksheetconfirmationsettings: save() is not allowed to call from worker thread!');
		}
	}
}

export let worksheetConfirmationSettings: WorksheetConfirmationSettings = new WorksheetConfirmationSettings();
