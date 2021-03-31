import { PROJECT_NAME } from './consts';
import { oauth_url, oauth_client_id } from './environment';
import { DeviceInfo } from './types';
import { getLogger } from './logger';
import { pingHttp } from './pinghttp';
import { fetch, newRequest, newHeaders } from './fetch';

import * as _ from 'underscore';

let logger = getLogger(PROJECT_NAME, 'webserviceplain.ts');

function myFetch(request): Promise<any> {
	const FUNC = 'myFetch()';
	return (fetch(request) as Promise<any>).then((response) => {
		if (response.ok) {
			return response;
		} else {
			let errs = `fetch(): http status: ${response.status}: ${request.url} ${request.method}`;
			logger.error(FUNC, errs, errs);
			return Promise.reject(response);
		}
	});
}

export class WebServicePlain {
	getAccessTokenByOAuth2RefreshToken(refresh_token): Promise<any> {
		const FUNC = '';
		let search = new URLSearchParams();
		search.append('grant_type', 'refresh_token');
		search.append('refresh_token', refresh_token);
		search.append('client_id', oauth_client_id());
		let body = search.toString();

		let headers = newHeaders({
			'Content-Type': 'application/x-www-form-urlencoded',
		});

		let request = newRequest(oauth_url() + '/token', {
			method: 'POST',
			headers: headers,
			body: body,
		});

		return pingHttp()
			.then(_.noop, (err) => {
				logger.error(FUNC, `no internet access`);
				err = new Error(`no internet access`);
				return Promise.reject(err);
			})
			.then(() => {
				return myFetch(request).then(function (response) {
					return response.json().then((data) => {
						if (!(data && data.access_token)) {
							logger.error(FUNC, `no access token`);
							let err = new Error(`no access token`);
							return Promise.reject(err);
						}

						return {
							accessToken: data.access_token,
							refreshToken: data.refresh_token,
							cubejsToken: data.cubejs_token,
						} as any;
					});
				});
			});
	}

	getAccessTokenByOAuth2PasswordGrant(username, password): Promise<any> {
		const FUNC = 'getAccessTokenByOAuth2PasswordGrant()';
		let search = new URLSearchParams();
		search.append('grant_type', 'password');
		search.append('username', username);
		search.append('password', password);
		search.append('client_id', oauth_client_id());
		let body = search.toString();

		let hdrs = {
			'Content-Type': 'application/x-www-form-urlencoded',
			//'Authorization': makeBasicAuthHeaderValue('d47bee45-bc7a-4fa2-aaf5-7128b27e0618', '?????'),
		};

		let headers = newHeaders(hdrs);

		let request = newRequest(oauth_url() + '/token', {
			method: 'POST',
			headers: headers,
			body: body,
			//mode: 'no-cors',
		});

		return pingHttp()
			.then(_.noop, () => {
				logger.error(FUNC, `no internet access`);
				let err = new Error(`no internet access`);
				return Promise.reject(err);
			})
			.then(() => {
				return myFetch(request).then(function (response) {
					return response.json().then((data) => {
						if (typeof data.access_token === 'undefined') {
							logger.error(FUNC, `no access token`);
							let err = new Error(`no access token`);
							return Promise.reject(err);
						}

						return data;
					});
				});
			});
	}

	sessionGetToken() {
		const FUNC = 'sessionGetToken()';

		let request = newRequest(oauth_url() + '/session/getToken', {
			method: 'GET',
		});

		return pingHttp()
			.then(_.noop, () => {
				logger.error(FUNC, `no internet access`);
				let err = new Error(`no internet access`);
				return Promise.reject(err);
			})
			.then(() => {
				return myFetch(request).then(function (response) {
					return response.json().then((data) => {
						logger.error(FUNC, `not implemented`);
						throw new Error(`not implemented`);
						return data;
					});
				});
			});
	}

	logout() {
		const FUNC = 'logout()';

		let request = newRequest(oauth_url() + '/logout', {
			method: 'GET',
		});

		return pingHttp()
			.then(_.noop, () => {
				logger.error(FUNC, `no internet access`);
				let err = new Error(`no internet access`);
				return Promise.reject(err);
			})
			.then(() => {
				return myFetch(request).then(function (response) {
					return response.json().then((data) => {
						logger.error(FUNC, `not implemented`);
						throw new Error(`not implemented`);
						return data;
					});
				});
			});
	}
}

export let webServicePlain: WebServicePlain = new WebServicePlain();
