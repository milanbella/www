import { status_url } from './environment';
import { settings } from './settings';
import { getExecutionContext } from './executionContext';

// 'timeout' - timeout in millisecons
export function pingHttp(): Promise<any> {
	let executionContext = getExecutionContext();
	if (executionContext.isServerSide === true) {
		return Promise.resolve();
	} else {
		let timeout = settings.settings.httpPingTimeout || 200;
		return new Promise<any>((resolve, reject) => {
			return new Promise<any>((resolve, reject) => {
				let xhttp: any = new XMLHttpRequest();
				xhttp.timeout = timeout;
				xhttp.onreadystatechange = () => {
					if (xhttp.readyState === 4) {
						if (xhttp.status === 200) {
							resolve(undefined);
						} else {
							reject();
						}
					}
				};
				xhttp.open('OPTIONS', status_url(), true);
				xhttp.send();

				xhttp.ontimeout = () => {
					reject();
				};

				xhttp.error = () => {
					reject();
				};
			}).then(resolve, reject);
		});
	}
}
