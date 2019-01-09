import { Injectable } from '@angular/core';

import { Platform } from '@ionic/angular';

import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { NavigationBar } from '@ionic-native/navigation-bar/ngx';
import { AppVersion } from '@ionic-native/app-version/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { PowerManagement } from '@ionic-native/power-management/ngx';

import { Logger, getLogger } from './logger';
import { Scanner1 } from './scanner1';
import { TestService } from '../../test/testService';
import { settings } from './settings';

var logger = getLogger('nativePlatform');

@Injectable()
export class NativePlatform {
	constructor(
		private platform: Platform,
		private splashScreen: SplashScreen,
		private statusBar: StatusBar,
		private navigationBar: NavigationBar,
		private appVersion: AppVersion,
		private backgroundMode: BackgroundMode,
		private powerManagement: PowerManagement,
		private scanner: Scanner1,
		private testService: TestService
	) {
		window['cloudempiere'] = {};
		window['cloudempiere'].environment = 'dev';
		window['cloudempiere'].runTests = () => {
			this.testService.runTests();
		}
		window['cloudempiere'].test = {
			forceSQSreceiveFailure: false,
		};
	}

	async init () {
			await this.platform.ready(); // must wait till cordova initialtt
			console.log('platforms: ', this.platform.platforms());


			this.statusBar.styleDefault();
			this.splashScreen.hide();

			this.scanner.registerScannerStaticCallback();

			//Background Mode https://ionicframework.com/docs/native/background-mode/
			this.backgroundMode.enable();

			try {
				//Power Managment https://github.com/Viras-/cordova-plugin-powermanagement
				await this.powerManagement.acquire()
				console.log('power management: wakelock acquired');
			} catch (err) {
				if (err && err.toString && (err.toString().search(/cordova_not_available/) > -1)) {
					console.warn('init(): powerManagement.acquire(): cordova_not_available ', err);
				} else {
					console.error('error: ', err);
					logger.error('error: ', err);
					throw err;
				}
			}

			this.statusBar.styleDefault();
			this.statusBar.hide();

			var autoHide: boolean = true;
			this.navigationBar.setUp(autoHide);


			// When cordova device info plugin cannot get device data then we set deviceID from settings
			if(!window['device']) {
				window['device'] = {
					uuid: settings.settings.deviceId,
					platform: 'browser',
					model: settings.settings.deviceId
				};
			}

	}

	async getAppVersionNumber (): Promise<any> { 
		try {
			var version = await this.appVersion.getVersionNumber();
		} catch (err) {
			if (err && err.toString && (err.toString().search(/cordova_not_available/) > -1)) {
				console.warn('getAppVersionNumber(): cordova_not_available: app version is unknown ', err);
				return 'unknown';
			} else {
				console.error('error: ', err);
				logger.error('error: ', err);
				throw err;
			}
		}
	}
}
