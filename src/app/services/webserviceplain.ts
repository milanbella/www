import 'whatwg-fetch';
import 'url-search-params-polyfill';

import { promiseReject } from '../common/utils';
import { Logger, getLogger } from './logger';
import { pingHttp } from './pinghttp';
import { _ } from 'underscore';

var logger: Logger = getLogger('webserviceplain');

export class WebServicePlain {
	public webservice_url = 'https://apiv1.cloudempiere.com/alpha/';

	getAccessTokenByBasic (email, password) : Promise<any> {

		var search = new URLSearchParams();
		search.append('EMail', email);
		search.append('Password', password);

		var request = new Request(this.webservice_url + 'cognauth' + '?' + search.toString(), {method: 'GET'});

		return pingHttp()
		.then(_.noop, () => {
				console.error('getAccessTokenByBasic(): no internet access');
				var err = new Error('getAccessTokenByBasic(): no internet access');
				logger.error('getAccessTokenByBasic(): no internet access', err);
				return promiseReject('getAccessTokenByBasic(): no internet access');
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

		var device = window['device'];
		var err;
		if (!device) {
			console.error('getAccessTokenByOAuth2(): no device');
			err = new Error('getAccessTokenByOAuth2(): no device');
			logger.error('getAccessTokenByOAuth2(): no device', err);
			throw err;
		}
		if (!device.platform) {
			console.error('getAccessTokenByOAuth2(): no device platform');
			err = new Error('getAccessTokenByOAuth2(): no device platform');
			logger.error('getAccessTokenByOAuth2(): no device', err);
			throw err;
		}

		var search = new URLSearchParams();
		search.append('grant_type', 'password');
		search.append('username', email);
		search.append('password', password);
		search.append('uuid', device.uuid);
		search.append('model', device.model);
		search.append('platform', device.platform);
		var body = search.toString();

		var headers = new Headers({
			'Content-Type': 'application/x-www-form-urlencoded'
		});

		var request = new Request(this.webservice_url + 'token', {method: 'POST', headers: headers, body: body});

		return pingHttp()
		.then(_.noop, () => {
			console.error('getAccessTokenByOAuth2(): no internet access');
			var err = new Error('getAccessTokenByOAuth2(): no internet access');
			logger.error('getAccessTokenByOAuth2(): no internet access', err);
			return promiseReject('getAccessTokenByOAuth2(): no internet access');
		})
		.then(() => {
			return fetch(request).then(function(response) {

				return response.json().then((data) => {
					if(typeof data.access_token === 'undefined') {
						console.error('getAccessTokenByOAuth2(): no access token');
						var err = new Error('getAccessTokenByOAuth2(): no access token');
						logger.error('getAccessTokenByOAuth2(): no access token', err);
						return promiseReject('getAccessTokenByOAuth2(): no access token');
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
			console.error('getAccessTokenByOAuth2byRefreshToken(): no internet access');
			err = new Error('getAccessTokenByOAuth2byRefreshToken(): no internet access');
			logger.error('getAccessTokenByOAuth2byRefreshToken(): no internet access', err);
			return promiseReject('getAccessTokenByOAuth2byRefreshToken(): no internet access');
		})
		.then(() => {
			return fetch(request).then(function(response) {
				return response.json().then((data) => {
					if(!(data && data.access_token))
					{
						console.error('getAccessTokenByOAuth2byRefreshToken(): no access token');
						var err = new Error('getAccessTokenByOAuth2byRefreshToken(): no access token');
						logger.error('getAccessTokenByOAuth2byRefreshToken(): no access token', err);
						return promiseReject('getAccessTokenByOAuth2byRefreshToken(): no access token');
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
