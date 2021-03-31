// nastav si v setting 5mins, ak do 5mins nespravis ziadnu akciiu po 5 mnutach sa zavola callback ktory ta odhlasi, ak spravi nejaku akciu v minute 3, stray 5 min callback sa  zrusi a nastavi sa znova dalsi odhlasovaci callback ktory sa zavola za 5 min.
// pokial robis akcie, vzdy sa stary odlasovaci callbak zrusi a nastavi sa novy, tak vlastne callback sa nikdy nezavola a teb to nikdy neodhlasi

// Poucuva to na mousemove a click, a keydown, kedykolvek nastane takyto event nastavy novy timer
// document.addEventListener('click', startIdleTimer);
// document.addEventListener('mousemove', startIdleTimer);
// document.addEventListener('keypress', startIdleTimer);

import { PROJECT_NAME } from './consts';
import { settings } from './settings';
import { getLogger } from './logger';
import * as _ from 'underscore';
import { getExecutionContext } from './executionContext';
import { getGlobalThis } from './globalThis';

let logger = getLogger(PROJECT_NAME, 'idle.ts');

let timerId;
let onIdleFn;

if (getGlobalThis().document) {
	document.addEventListener('load', startIdleTimer);
	document.addEventListener('click', startIdleTimer);
	document.addEventListener('mousemove', startIdleTimer);
	document.addEventListener('keypress', startIdleTimer);
}

export function startIdleTimer() {
	const FUNC = 'startIdleTimer()';

	let idlePeriod, idleOn;
	if (_.isNumber(settings.settings.idleLogout)) {
		if (settings.settings.idleLogout > 0) {
			idlePeriod = settings.settings.idleLogout;
			idleOn = true;
		} else {
			idlePeriod = 1;
			idleOn = false;
		}
	} else {
		idlePeriod = 1;
		idleOn = false;
	}

	if (timerId) {
		clearTimeout(timerId);
	}

	timerId = setTimeout(() => {
		if (idleOn && onIdleFn) {
			logger.warn(FUNC, `user idle`);
			onIdleFn();
		}
	}, idlePeriod * 60 * 1000);
}

export function registerIdleListener(fn) {
	onIdleFn = fn;
}

export function unregisterIdleListener() {
	onIdleFn = null;
}
