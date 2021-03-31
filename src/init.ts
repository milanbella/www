import 'whatwg-fetch';
import 'url-search-params-polyfill';

import { PROJECT_NAME } from './consts';
import { EnvironmentBase } from './types';
import { setEnvironment } from './environments/environment';
import { startWorkers } from './worker';
import { getExecutionContext, setExecutionContext } from './executionContext';
import { Logger } from './types';
import { getLogger } from './logger';
import { EventSource } from './eventSource';
import { authPrincipal } from './authprincipal';

let logger = getLogger(PROJECT_NAME, 'init.ts');

export function initLibrary(environment: EnvironmentBase, isServerSide = false) {
	const FUNC = 'initLibrary()';

	setEnvironment(environment);

	let executionContext = getExecutionContext();
	executionContext.isServerSide = isServerSide;
	setExecutionContext(executionContext);

	if (executionContext.isServerSide === false) {
		startWorkers();

		authPrincipal.getPrincipal().then(
			function (principal) {
				EventSource.principalChangeEventSource.generateEvent(principal);
			},
			function (err) {
				logger.error(FUNC, `getPrincipal(): error`, err);
			}
		);
	}
}
