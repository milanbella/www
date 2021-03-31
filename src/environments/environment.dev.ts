// Variable 'environment' contains implicit values, which may not work for library consumer.
//
// Library consumer shall override these values, e.g:
/**

let defuaultEnvironment = getEnvironment();
defuaultEnvironment.OAUTH_CLIENT_ID = 'xyz'
setEnvironment(defuaultEnvironment)

Therefore never export variable 'environment' directly, consumer should use getEnvironment() function instead, e.g.
let  OAUTH_CLIENT_ID = getEnvironment().OAUTH_CLIENT_ID

*/

import { EnvironmentBase } from '../types';

import * as R from 'ramda';

let environment: EnvironmentBase = {
	name: 'dev',
	production: true,
	versionCode: 20102,

	applicationName: 'unknownApp',
	applicationVersion: '2.1.2',
	applicationPlatform: 'mobile',

	customerName: 'unknown',

	cubejsApiUrl: 'https://cubesapi.cloudempiere.com/cubejs-api/v1',

	couchDbIsTest: false,
	couchDbNameTestSuffix: '_test',
	couchDbAdminDocName: 'database_admin_document_v1',

	apiHost: null,
	apiPathRest: null,
	apiPathAuth: null,
	apiPathStatus: null,

	/* Endpoint URL for REST API backend calls */
	backendRestApiUrl: 'https://apiv1.cloudempiere.com/alpha',

	backendModelRestApiUrl: 'https://system.cloudempiere.com/api/v1',

	/* Endpoint URL for CouchDB Mobile */
	backendCouchDbApiUrl: 'https://couch.cloudempiere.com',

	/* Endpoint URL for Logging */
	backendLoggingApiUrl: 'https://apiv1.cloudempiere.com/alpha/logs/send',

	/* Endpoint URL for Stompf Broker */
	backendStompfBrokerUrl: 'wss://stomp.cloudempiere.com:61614',

	/* IndexedDB main DB Name */
	indexedDbMainDbName: 'cloudempiere',

	/* IndexedDB logs DB Name */
	indexedDbLogsDbName: 'logs',

	/* Oauth Settings */
	oauthServerUrl: 'https://auth.cloudempiere.com/auth',
	oauthClientId: 'd47bee45-bc7a-4fa2-aaf5-7128b27e0618',
	oauthTokenStorage: 'indexdb',

	backendMockEndpointURL: '/api',

	deactivateMobileDeviceInitWizard: false,
};

export function getEnvironment(): EnvironmentBase {
	return R.clone(environment);
}

export function setEnvironment(_environment: EnvironmentBase) {
	environment = R.mergeRight(environment, _environment);
}
