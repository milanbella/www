
// 'timeout' - timeout in millisecons
export function pingHttp (timeout?): Promise<any> {
	return new Promise<any>((resolve, reject) => {
		if (!timeout) {
			timeout = 5000;
		}

		return new Promise<any>((resolve, reject) => {
			var xhttp: any = new XMLHttpRequest();
			xhttp.timeout = timeout;
			xhttp.onreadystatechange = () => {
				if (xhttp.readyState === 4) {
					if (xhttp.status === 200) {
						resolve();
					} else {
						reject();
					}
				}
			};
			xhttp.open("OPTIONS", "https://apiv1.cloudempiere.com/alpha/status", true);
			xhttp.send();

			xhttp.ontimeout = () => {
				return reject();
			};

			xhttp.error = (err) => {
				return reject();
			};
		}).then(resolve, reject);
	});
}
