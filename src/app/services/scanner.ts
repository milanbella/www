import { Injectable } from '@angular/core';

import { settings } from './settings';
import { logger } from './logger';

@Injectable()
export class Scanner {

	private isDebug: boolean;
	private datawedgeStarted: boolean;
	private	scannerCallBacksFn:	any[];
	public isEnabledScannerEvents: boolean;
	private caribeEventFn = () => {
			//console.debug(data);
			var data = window['cordova']['plugins']['laser_scanner_plugin'].barCode;
			var result = {
				type: data[1],
				barcode: data[0]
			};

			// Barcode Validation
			result.barcode = this.barcoodeValidation(result.barcode);

			if(this.isEnabledScannerEvents && this.scannerCallBacksFn && this.scannerCallBacksFn.length > 0 )	{
				let callbackFn = this.scannerCallBacksFn[this.scannerCallBacksFn.length-1];
				callbackFn(result);
				return;
			}
			return;
	}
	private scanKeyFn = (e) => {
		//console.log("KeyPress: " + e.key);

		if (e.keyCode === 17) {
			// Start of barcode (Control)
			this.readingBarcodeCtrl = true;
			e.preventDefault();
			return;
		}

		if (this.readingBarcodeCtrl && e.keyCode === 65) {
			// Start of barcode B
			this.readingBarcodeCtrl = false;
			this.readingBarcode = true;
			e.preventDefault();
			return;
		}
		else {
			this.readingBarcodeCtrl = false;
		}
	
		if (this.readingBarcode) {
			e.preventDefault();
	
	
			if (e.keyCode === 13) { // Enter
				this.readingBarcode = false;
				console.log(this.barcodeRead);

				var result = {
					type: 'LABEL-TYPE-EAN128',
					barcode: this.barcodeRead
				};

				// Barcode Validation	
				result.barcode = this.barcoodeValidation(result.barcode);

				if(this.isEnabledScannerEvents && this.scannerCallBacksFn && this.scannerCallBacksFn.length > 0 )	{
					this.scannerCallBacksFn[this.scannerCallBacksFn.length-1](result);
				}				
				this.barcodeRead = '';
				return;
			}
	
			// Append the next key to the end of the list
			//console.log("ReadingBarcode: " + e.key);
			this.barcodeRead += e.key;
		}
	}
	private barcodeRead: string;
	private readingBarcode = false;
	private readingBarcodeCtrl = false;


	constructor () {
		this.scannerCallBacksFn = [];
		this.isEnabledScannerEvents = true;
		this.barcodeRead = '';
		this.isDebug = settings.settings.isDebug === true;
		//init caribe eventListener
		document.addEventListener('barcode', this.caribeEventFn);
		document.addEventListener('keydown', this.scanKeyFn);
	}

	private getScannerType = () => {
		var scannerType = 'auto';
		if (settings.settings.scannerType) {
			scannerType = settings.settings.scannerType;
		}

		function chooseType () {

			if (window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['laser_scanner_plugin']) {
				return 'caribe';
			}
			if (window['datawedge']) {
				return 'datawedge';
			}
			if (window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['barcodeScanner']) {
				return 'camera';
			}
			return 'browser';
		}

		if ((scannerType === 'auto') || (scannerType === 'camera') || (scannerType === 'datawedge') || (scannerType === 'browser') || (scannerType === 'caribe') || (scannerType === 'keyboard'))  {
			if (scannerType === 'auto') {
				return chooseType();
			} else {
				return scannerType;
			}
		} else {
			var errMsg = 'scanner: unsupported scanner type: ' + scannerType;
			console.error(errMsg);
			var err = new Error(errMsg);
			logger.error('scanner: unsupported scanner type: ' + scannerType, err);
			throw err;
		}
	}

	refresh	=	(scanDataCallbackFn) => {
		// Init ScanBack Function
		this.scannerCallBacksFn.push(scanDataCallbackFn);

		var scannerType = this.getScannerType();
		console.info('active scanner type:'+ scannerType);
		if (scannerType === 'datawedge') {
			if (!window['datawedge']) {
				console.error('scanner: no datawedge plugin installed');
				if (this.isDebug) {
					console.debug('scanner: refresh result');
					console.dir(undefined);
				}

				scanDataCallbackFn();
				return;
			}

			if (this.isDebug) {
				console.debug('scanner: refresh result');
				console.dir(undefined);
			}

			if (!this.datawedgeStarted) {
				if (this.isDebug) {
					console.error('scanner: starting datawedge plugin ...');
				}
				window['datawedge'].start();
				this.datawedgeStarted = true;
			}

			//TODO Set in INIT??
			window['datawedge'].registerForBarcode((data) => {
				var result = {
					type: data.type,
					barcode: data.barcode
				};
				
				// Barcode Validation
				result.barcode = this.barcoodeValidation(result.barcode);

				if(this.isEnabledScannerEvents && this.scannerCallBacksFn && this.scannerCallBacksFn.length > 0 )	{
					this.scannerCallBacksFn[this.scannerCallBacksFn.length-1](result);
					
				}				
				return;
			});
		}
		else if(scannerType === 'caribe') {
			console.log('caribe scanner type');
			if (!window['cordova'] || !window['cordova']['plugins'] || !window['cordova']['plugins']['laser_scanner_plugin']) {
				console.error('scanner: no caribe plugin installed');

				scanDataCallbackFn();
				return;
			}
		}
	}

	revokeHardwareScan(scanDataCallbackFn) {
		//Find Scanner
		let index = this.scannerCallBacksFn.findIndex((scannerCallBackFn)=>{
			return scannerCallBackFn === scanDataCallbackFn;
		});

		if(index >= 0) {
			this.scannerCallBacksFn.splice(index,1);
		}		
		else {
			console.warn("Cannot Revoke different function");
			logger.warn("Cannot Revoke different function");
		}
	}



	scan = (scanDataCallbackFn) => {
		var scannerType = this.getScannerType();
		if (scannerType === 'camera') {
			this.scanByCamera(scanDataCallbackFn);
		} else if (scannerType === 'datawedge') {
			this.scanByDatawedge(scanDataCallbackFn);
		} else if (scannerType === 'browser') {
			this.scanByBrowser(scanDataCallbackFn);
		} else {
			var errMsg = 'scanner: unsupported scanner type: ' + scannerType;
			console.error(errMsg);
			var err = new Error(errMsg);
			logger.error(errMsg, err);
			throw err;
		}
	}

	scanByBrowser = (scanDataCallbackFn) => {
		if (this.isDebug) {
			console.debug('scanner: scan by browser');
		}
		var barcodeType = prompt('Barcode TYPE (EAN128/CODE128/CODE39/QRCODE)', 'EAN128');
		if (!barcodeType) {
			if (this.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		var barcodeValue = prompt('Barcode VALUE', '');
		if (!barcodeValue) {
			if (this.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		var result = {
			type: 'LABEL-TYPE-' + barcodeType.toUpperCase(),
			barcode: barcodeValue.toUpperCase()
		};

		// Barcode Validation
		result.barcode = this.barcoodeValidation(result.barcode);

		if (this.isDebug) {
			console.debug('scanner: scan result');
			console.dir(result);
		}
		scanDataCallbackFn(result);
	}

	scanByCamera = (scanDataCallbackFn) => {
		if (this.isDebug) {
			console.debug('scanner: scan by camera');
		}

		if (!(window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['barcodeScanner'])) {
			console.error('scanner: no camera barcode scanner plugin installed');
			if (this.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		var scan = window['cordova']['plugins']['barcodeScanner'].scan;
		scan ((res) => {
			if (res.cancelled) {
				if (this.isDebug) {
					console.debug('scanner: scan result');
					console.dir(undefined);
				}
				scanDataCallbackFn();
				return;
			}

			var result = {
				type: 'LABEL-TYPE-' + res.format.replace('-', '').replace('_', ''),
				barcode: res.text
			};

			// Barcode Validation
			result.barcode = this.barcoodeValidation(result.barcode);

			if (this.isDebug) {
				console.debug('scanner: scan result');
				console.dir(result);
			}
			scanDataCallbackFn(result);
		});
	}

	public scanByDatawedge = (scanDataCallbackFn) => {
		if (this.isDebug) {
			console.debug('scanner: scan by datawedge');
		}
		if (!window['datawedge']) {
			console.error('scanner: no datawedge plugin installed');
			var err = new Error('scanner: no datawedge plugin installed')
			logger.error('scanner: no datawedge plugin installed', err);
			if (this.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		if (!this.datawedgeStarted) {
			if (this.isDebug) {
				console.error('scanner: starting datawedge plugin ...');
			}
			window['datawedge'].start();
			this.datawedgeStarted = true;
		}

		window['datawedge'].startScanner();
	}

	// public scanByCoriba = (scanDataCallbackFn) => {
	// 	if (this.isDebug) {
	// 		console.debug('scanner: scan by coriba');
	// 	}
	// 	if (!window['cordova'] || !window['cordova'].plugins || !window['cordova'].plugins.LaserScannerPlugin) {
	// 		console.error('scanner: no coriba plugin installed');
	// 		if (this.isDebug) {
	// 			console.debug('scanner: scan result');
	// 			console.dir(undefined);
	// 		}
	// 		scanDataCallbackFn();
	// 		return;
	// 	}
	//
	// 	if (!window['cordova'].plugins.LaserScannerPlugin.isScanOpened()) {
	// 		if (this.isDebug) {
	// 			console.error('scanner: starting coriba plugin ...');
	// 		}
	// 		window['datawedge'].start();
	// 		this.datawedgeStarted = true;
	// 	}
	//
	// 	window['datawedge'].openScan();
	// }

	barcoodeValidation(barcode: string): string {

		// Check UPC and transfer it to EAN 13
		var reg = new RegExp('^[0-9]+$');
		if(reg.test(barcode) && barcode.length == 12) {
			barcode = '0' + barcode;
		}	

		return barcode;	
	}

}
