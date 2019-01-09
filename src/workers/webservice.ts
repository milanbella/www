import { whttp } from './whttp';

class WebService {

	private  webservice_url = 'https://apiv1.cloudempiere.com/alpha/';

	getDeviceSettings (deviceUuid) : Promise<any> {

		var search = new URLSearchParams();
		search.append('Device_UUID', deviceUuid);

		var request = new Request(this.webservice_url + 'device/settings' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then(function(response) {
			return response.json();
		});
	};
}

export var webService: WebService = new WebService();
