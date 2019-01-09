import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LoadingController } from '@ionic/angular';
import { rxPromise, promiseAll } from '../common/utils';

import { logger } from './logger';

// Displays GUI busy indicator untill all added promises resolved.

@Injectable()
export class BusyBox {

	constructor (public loadingController: LoadingController, public translateService: TranslateService) {
	}

	addPromise (p, message?) {

		var show = async (message?) => {

			if (!message) {
				message = await rxPromise(this.translateService.get('PleaseWait'));
			}
			let spinner = await this.loadingController.create({                                                                                                                     
					message: message
			});
			await spinner.present();
			return spinner;
		}

		show(message).then((spinner) => {

			p.catch((err) => {
				logger.error('error: ', err.originalError || err); 
				
				console.error('error: ');
				console.dir(err);
			}).then(() => {
				spinner.dismiss();
			})
		})
	}

	addPromises (ps, message?) {
		this.addPromise(promiseAll(ps));
	};
}
