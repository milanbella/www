import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastController } from '@ionic/angular';


import { promiseResolve } from './common/utils';
import { NativePlatform } from './services/nativePlatform';
import { EventSource } from './services/eventSource';
import { net } from './services/net';
import { settings } from './services/settings';
import { init as initInvertedIndex} from './services/invertedIndex';
import { Logger, getLogger } from './services/logger';
import { translate } from './services/translate';
import { sendAppVersion as workerSendAppVersion } from './services/worker';
import { sendEnvironment as workerSendEnvironment } from './services/worker';

import  { _ } from 'underscore';

var logger = getLogger('app.component');

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html'
})
export class AppComponent {
	constructor(
		private nativePlatform: NativePlatform,
		private translate: TranslateService,
		private toastCtrl: ToastController,
	) {
		this.initApp();
	}

	async initApp ()  {
		await this.nativePlatform.init(); 

		// set default language
		this.translate.setDefaultLang(settings.settings.defaultLanguage);
		translate.setLanguage(settings.settings.defaultLanguage);

		// Subscribe to network status events
		EventSource.offlineEventSource.source
		.throttleTime(5000)
		.distinctUntilChanged()
		.subscribe((isOffline) => {
			this.showNetworkToast('bottom', isOffline);
		});

		await this.initWorkers();
		initInvertedIndex();

		this.getStorageQuota().then((quota) => {
			var msg = `storage: usage ${quota.usageInMib} MB, quota ${quota.quotaInMib} MB, used ${quota.percentUsed}%`;
			console.info(msg);
			logger.info(msg);
		});
	}

	async initWorkers () {
		var appVersion = await this.nativePlatform.getAppVersionNumber();
		workerSendAppVersion(appVersion);
		workerSendEnvironment(window['cloudempiere'] && window['cloudempiere'].environment || 'unknown');
	}

	showNetworkToast (position: "top" | "middle" | "bottom", isOffline:boolean) {

		if (!net.networkIndicationToasterActive) {
			return;
		}

		var msg, cls;
		if (isOffline) {
			msg = 'NetworkWentOffline',
			cls = 'network-toast-offline'
		} else {
			msg = 'NetworkWentOnline',
			cls = 'network-toast-online'
		}
		
		this.translate.get(msg).subscribe((msgTranslated) => {
			this.toastCtrl.create({
				message: msgTranslated,
				duration: 2000,
				position: position,
				cssClass: cls
			}).then((toast) => {
				toast.present();
			});
		});
	}

	async getStorageQuota (): Promise<any> {

		function makeQuota (usage?, quota?) {
			if (!usage || !quota) {
				return {
					percentUsed: undefined,
					usageInMib: undefined,
					quotaInMib: undefined,
				};
			}
			return {
				percentUsed: Math.round(usage / quota * 100),
				usageInMib: Math.round(usage / (1024 * 1024)),
				quotaInMib: Math.round(quota / (1024 * 1024)),
			};
		}

		if(window.navigator && window.navigator['storage']) {
			return window.navigator['storage'].estimate().then((resp)=> {
				var {usage, quota} = resp;
				return makeQuota(usage, quota);
			});
		} else if(window.navigator && window.navigator['webkitTemporaryStorage']) { 
			return window.navigator['webkitTemporaryStorage'].queryUsageAndQuota((usage, quota)=> {
				return makeQuota(usage, quota);
			});
		} else {
			console.warn('cannot estimate storage usage quota');
			return promiseResolve(makeQuota());
		}
	}
}
