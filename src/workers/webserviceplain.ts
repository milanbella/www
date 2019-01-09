import 'whatwg-fetch';
import 'url-search-params-polyfill';

import { promiseReject } from '../app/common/utils';
import { logger } from './logger';
import { workerCtx } from './workerCtx';
import { pingHttp } from '../app/services/pinghttp';
import { _ } from 'underscore';


class WebServicePlain {

	public webservice_url = 'https://apiv1.cloudempiere.com/alpha/';

	getAccessTokenByBasic (email, password) : Promise<any> {

		var search = new URLSearchParams();
		search.append('EMail', email);
		search.append('Password', password);

		var request = new Request(this.webservice_url + 'cognauth' + '?' + search.toString(), {method: 'GET'});

		return pingHttp()
		.then(_.noop, () => {
				return promiseReject('worker: no internet access');
		}).then(() => {
			return fetch(request).then((response) => {

				return response.json().then((data) => {

					var Data = data.Data;
					return {
						accessToken: Data.CognitoToken,
						identityId: Data.CognitoId,
						identityPoolId: Data.IdentityPoolID
					};
				});
			});
		});
	};

	getAccessTokenByOAuth2 (email, password) : Promise<any>  {

		var search = new URLSearchParams();
		search.append('grant_type', 'password');
		search.append('username', email);
		search.append('password', password);
		search.append('uuid', workerCtx.device.uuid);
		search.append('model', workerCtx.device.model);
		search.append('platform', workerCtx.device.platform);
		var body = search.toString();

		var headers = new Headers({
			'Content-Type': 'application/x-www-form-urlencoded'
		});

		var request = new Request(this.webservice_url + 'token', {method: 'POST', headers: headers, body: body});

		return pingHttp()
		.then(_.noop, () => {
			return promiseReject('worker: no internet access');
		})
		.then(() => {
			return fetch(request).then(function(response) {

				return response.json().then((data) => {
					if(typeof data.access_token === 'undefined') {
						console.error('worker: no access token');
						var err = new Error('worker: no access token');
						logger.error('worker: no access token', err);
						return promiseReject('worker: no access token');
					}

					return data;
				});
			});
		});
	};

	getAccessTokenByOAuth2byRefreshToken (refresh_token) : Promise<any> {

		var search =  new URLSearchParams();
		search.append('grant_type', 'refresh_token');
		search.append('refresh_token', refresh_token);
		var body = search.toString();

		var headers = new Headers({
			'Content-Type': 'application/x-www-form-urlencoded'
		});

		var request = new Request(this.webservice_url + 'token', {method: 'POST', headers: headers, body: body});

		return pingHttp()
		.then(_.noop, (err) => {
			return promiseReject('worker: no internet access');
		})
		.then(() => {
			return fetch(request).then(function(response) {
				return response.json().then((data) => {
					if(!(data && data.access_token))
					{
						console.error('worker: getAccessTokenByOAuth2byRefreshToken: no access token');
						var err = new Error('worker: getAccessTokenByOAuth2byRefreshToken: no access token');
						logger.error('worker: getAccessTokenByOAuth2byRefreshToken: no access token', err);
						return promiseReject('worker: getAccessTokenByOAuth2byRefreshToken: no access token');
					}

					return {
						accessToken: data.access_token,
						refreshToken: data.refresh_token,
						identityId: data.cognito_id,
						identityPoolId: data.identity_pool_id
					};
				});
			});
		});
	};
}

export var webServicePlain: WebServicePlain = new WebServicePlain();
