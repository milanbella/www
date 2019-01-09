import { promiseReject, waitFor } from '../common/utils';

export class Translate {
	private translations: any = null;

	setLanguage (lang: string) : Promise<any> {
		var url: string = 'assets/i18n/' + lang + '.json';
		var request = new Request(url, {method: 'GET'});

		return fetch(request).then((response) => {
			return response.json().then((json) => {
				this.translations = json;
			});
		}, (err) => {
			console.error('Translate.setLanguage(): cannot fetch translations: ' + url, err);
			return promiseReject(err);
		})
	}

	get (tag: string): Promise<any> {
		return waitFor(() => {
			return this.translations !== null;
		}).then(() => {
			return this.translations[tag];
		});
	}
}

export var translate: Translate = new Translate();
