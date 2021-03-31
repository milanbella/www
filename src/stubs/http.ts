import { PROJECT_NAME } from '../consts';
import { IHttp } from '@cloudempiere/clde-types/dist/stubs';

import { restapi_url } from '../environment';
import { whttp } from '../whttp';
import { getLogger } from '../logger';
import { newRequest, newHeaders } from '../fetch';

const FILE = 'stubs/http.ts';
const logger = getLogger(PROJECT_NAME, 'stubs/http.ts');

interface tHeaders {
	[key: string]: string;
}

function readHeaders(headers): any {
	let m = {};
	for (let key of headers.keys()) {
		m[key] = headers.get(key);
	}
	return m;
}

export async function httpGet(path: string, headers?: tHeaders): Promise<{ headers: tHeaders; payload: any }> {
	const FUNC = 'httpGet()';
	let url, response;
	try {
		let hdrs;
		if (headers) {
			hdrs = newHeaders(headers);
		} else {
			hdrs = newHeaders({});
		}

		url = `${restapi_url()}${path}`;

		let request = newRequest(url, { method: 'GET', headers: hdrs });
		response = await whttp.send(request);
		if (!response.headers.has('Content-Type')) {
			let oHeaders = readHeaders(response.headers);
			return {
				headers: oHeaders,
				payload: null,
			};
		} else {
			let oHeaders = readHeaders(response.headers);
			let json = await response.json();
			return {
				headers: oHeaders,
				payload: json,
			};
		}
	} catch (err) {
		logger.error(FUNC, `call '${url}'`, err);
		throw err;
	}
}

export async function httpGetArrayBuffer(path: string, headers?: tHeaders): Promise<{ headers: tHeaders; payload: ArrayBuffer }> {
	const FUNC = 'httpGetArrayBuffer()';
	let url, response;
	try {
		let hdrs;
		if (headers) {
			hdrs = newHeaders(headers);
		} else {
			hdrs = newHeaders({});
		}

		url = `${restapi_url()}${path}`;

		let request = newRequest(url, { method: 'GET', headers: hdrs });
		response = await whttp.send(request);
		let oHeaders = readHeaders(response.headers);
		let arrayBuffer = await response.arrayBuffer();
		return {
			headers: oHeaders,
			payload: arrayBuffer,
		};
	} catch (err) {
		logger.error(FUNC, `call '${url}'`, err);
		throw err;
	}
}

async function httpPost(path, body: any, headers?: tHeaders): Promise<{ headers: tHeaders; payload: any }> {
	const FUNC = 'httpPost()';
	let url, response;
	try {
		let hdrs;
		if (headers) {
			hdrs = newHeaders(headers);
			if (!hdrs.has('Content-Type')) {
				hdrs.set('Content-Type', 'application/json');
			}
		} else {
			hdrs = newHeaders({});
		}

		url = `${restapi_url()}${path}`;

		let request = newRequest(url, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
		response = await whttp.send(request);
		if (!response.headers.has('Content-Type')) {
			let oHeaders = readHeaders(response.headers);
			return {
				headers: oHeaders,
				payload: null,
			};
		} else {
			let oHeaders = readHeaders(response.headers);
			let json = await response.json();
			return {
				headers: oHeaders,
				payload: json,
			};
		}
	} catch (err) {
		logger.error(FUNC, `call '${url}'`, err);
		throw err;
	}
}

async function httpPut(path, body: any, headers?: tHeaders): Promise<{ headers: tHeaders; payload: any }> {
	const FUNC = 'httpPut()';
	let url, response;
	try {
		let hdrs;
		if (headers) {
			hdrs = newHeaders(headers);
			if (!hdrs.has('Content-Type')) {
				hdrs.set('Content-Type', 'application/json');
			}
		} else {
			hdrs = newHeaders({});
		}

		url = `${restapi_url()}${path}`;

		let request = newRequest(url, { method: 'PUT', headers: hdrs, body: JSON.stringify(body) });
		response = await whttp.send(request);
		if (!response.headers.has('Content-Type')) {
			let oHeaders = readHeaders(response.headers);
			return {
				headers: oHeaders,
				payload: null,
			};
		} else {
			let oHeaders = readHeaders(response.headers);
			let json = await response.json();
			return {
				headers: oHeaders,
				payload: json,
			};
		}
	} catch (err) {
		logger.error(FUNC, `call '${url}'`, err);
		throw err;
	}
}

async function httpDelete(path, headers?: tHeaders): Promise<{ headers: tHeaders; payload: any }> {
	const FUNC = 'httpDelete()';
	let url, response;
	try {
		let hdrs;
		if (headers) {
			hdrs = newHeaders(headers);
		} else {
			hdrs = newHeaders({});
		}

		url = `${restapi_url()}${path}`;

		let request = newRequest(url, { method: 'DELETE', headers: hdrs });
		response = await whttp.send(request);
		if (!response.headers.has('Content-Type')) {
			let oHeaders = readHeaders(response.headers);
			return {
				headers: oHeaders,
				payload: null,
			};
		} else {
			let oHeaders = readHeaders(response.headers);
			let json = await response.json();
			return {
				headers: oHeaders,
				payload: json,
			};
		}
	} catch (err) {
		logger.error(FUNC, `call '${url}'`, err);
		throw err;
	}
}

export let http: IHttp = {
	httpGet: httpGet,
	httpGetArrayBuffer: httpGetArrayBuffer,
	httpPost: httpPost,
	httpPut: httpPut,
	httpDelete: httpDelete,
};
