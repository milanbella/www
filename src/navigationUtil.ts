import { settings } from './settings';
import { setNavigationParameter } from './navigationParameters';

const defaultUrl: string = '/apps';

/**
 * Main Class for Authenticated Root Urls
 * Get Root Url based on Default Application, or DefaultUrl '/apps'
 * TODO check Auth Application Privileges Do not Allow open App, when user do not have permission for that app.
 * Possible refactor, use this class when navigating to Root Pages (Auth - (Apps/DefaultApp) or NonAuth - Login)
 */
class NavigationUtil {
	/**
	 * Get Default PageUrl
	 * @returns url String
	 */
	public getRootPageUrl(): string {
		if (settings && settings.settings && settings.settings.defaultApplication) {
			// TODO Check if Application is Supported
			if (settings.settings.defaultApplication === '1000021') {
				// Command Console
				setNavigationParameter('ScanConsolePage', {
					isDefaultApplication: true,
				});
				return '/apps/command-console';
			} else if (settings.settings.defaultApplication === '1000018') {
				setNavigationParameter('POSPage', {
					isDefaultApplication: true,
				});
				// POS
				return '/apps/pos';
			}
		}
		return defaultUrl;
	}
}

export let navigationUtil: NavigationUtil = new NavigationUtil();
