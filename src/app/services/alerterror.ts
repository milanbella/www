import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';


@Injectable()
export class AlertError {

	constructor (private alertController: AlertController) {
	}

	async show (message: string, title?, onBtnOkFn?: any) {

		var wasClosed = new Promise<any>((resolve, reject) => {

			var opt = {
				title: 'Error', //TODO: i18n
				message: message,
				buttons: [
					{
						text: 'Ok', //TODO: i18n
						role: 'cancel',
						handler: () => {
							if (onBtnOkFn) {
								onBtnOkFn();
							}
							resolve();
						}
					}
				],
				enableBackdropDismiss: false
			};

			if (title !== undefined) {
				if (title) {
					opt.title = title;
				} else {
					delete opt.title;
				}
			}

			this.alertController.create(opt).then((alert) => {
				alert.present();
			})

		});

		await wasClosed;
	}
}
