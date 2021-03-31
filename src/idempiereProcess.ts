import { PROJECT_NAME } from './consts';
import { http } from './stubs/http';
import { restapi_url } from './environment';
import { getLogger } from './logger';
import { fetch, newRequest } from './fetch';

let logger = getLogger(PROJECT_NAME, 'idempiereProcess.ts');

export async function callIdempiereProcess(processName: string, parameters: any) {
	const FUNC = 'callProcess()';
	try {
		let res = await http.httpPost(`/processes/${processName}`, parameters, {});
		return res.payload;
	} catch (err) {
		logger.error(FUNC, `process: '${processName}', error: ${err}`, err);
		throw new Error('failed to call idempiere process');
	}
}

export async function registerDevice(accessToken, deviceUuid, deviceModel, devicePlatform) {
	const FUNC = 'registerDevice()';

	try {
		let parameters = {
			Token: accessToken,
			jsondata: JSON.stringify({
				uuid: deviceUuid,
				model: deviceModel,
				platform: devicePlatform,
			}),
		};

		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(parameters),
		};
		let request = newRequest(restapi_url() + '/processes/mobileregister', options);
		let response = await fetch(request);
		if (response.ok) {
			let rep = await response.json();
			rep = JSON.parse(rep.summary);
			return rep;
		} else {
			let responseText = await response.text();
			logger.error(FUNC, `http status ${response.status}: ${request.method} ${request.url}: ${responseText}`);
			throw new Error(`http request failed`);
		}
	} catch (err) {
		logger.error(FUNC, `error: ${err}`, err);
		throw new Error('failed to register device');
	}
}
