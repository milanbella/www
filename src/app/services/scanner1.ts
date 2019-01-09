import { Injectable } from '@angular/core';

import { settings } from './settings';
import { logger } from './logger';

@Injectable()
export class Scanner1 {

	private scanData: any;
	private scanDataListeners = [];

	private caribeStaticCallbackFn: any;
	private extbluetoothStaticCallbackFn: any;

	private barcodeRead: String;
	private readingBarcode = false;

	private datawedgeStarted: boolean;


	constructor () {
		this.registerScannerStaticCallback();
	}

	public getScannerType (): string {
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

		if ((scannerType === 'auto') || (scannerType === 'browser') || (scannerType === 'camera') || (scannerType === 'datawedge') || (scannerType === 'caribe') || (scannerType === 'extbluetooth'))  {
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

	public isHardwareTriggerScanner () {
		var scannerType = this.getScannerType();
		return !(scannerType === 'browser' || scannerType === 'camera')
	}

	private notifyListeners (data) {
		this.scanDataListeners.map((fn) => fn(data));
	}

	private addListener (fn) {
		this.scanDataListeners.push(fn);
	}


	private removeListener (fn) {
		this.scanDataListeners = this.scanDataListeners.reduce((arr, f) => {
			if (f !== fn) {
				arr.push(f);
			}
			return arr;
		}, [])
	}

	// Rgister listener to receive scan data. There may be no more then one listener registered, following registraion unregisters previous listener.
	public registerListener (fn) {
		this.scanDataListeners = [];
		this.scanDataListeners.push(fn);
	}

	// Unregisters scan data listener.
	public unregisterListener () {
		this.scanDataListeners = [];
	}

	public getListener () {
		if (this.scanDataListeners.length > 1) {
			var err = new Error('assertion failed');
			console.error('assertion failed');
			logger.error('assertion failed', err);
			throw err;
		}
		return this.scanDataListeners[0];
	}

	private storedListenerFn: any;

	public suppress () {
		this.storedListenerFn = this.getListener();
		this.unregisterListener();
	}

	public resume ()  {
		if (this.storedListenerFn) {
			this.registerListener(this.storedListenerFn);
		}
	}

	public registerScannerStaticCallback () {
		var scannerType = this.getScannerType();

		if (scannerType === 'datawedge') {
			this.registerScannerStaticCallbackForDatawedge();
			this.unregisterScannerStaticCallbackForCaribe();
			this.unregisterScannerStaticCallbackForExtbluetooth();
		} else if (scannerType === 'caribe') {
			this.unregisterScannerStaticCallbackForDatawedge();
			this.registerScannerStaticCallbackForCaribe();
			this.unregisterScannerStaticCallbackForExtbluetooth();
		} else if (scannerType === 'extbluetooth') {
			this.unregisterScannerStaticCallbackForDatawedge();
			this.unregisterScannerStaticCallbackForCaribe();
			this.registerScannerStaticCallbackForExtbluetooth();
		} 
	}

	private registerScannerStaticCallbackForDatawedge () {
		if (!window['datawedge']) {
			console.error('scanner datawedge: not available');
			logger.error('scanner datawedge: not available');
			return;
		}
		if (settings.settings.isDebug) {
			console.debug('scanner: registerScannerStaticCallbackForDatawedge()');
		}
		if (!this.datawedgeStarted) {
			window['datawedge'].start();
			this.datawedgeStarted = true;
		}
		this.unregisterScannerStaticCallbackForDatawedge();
		window['datawedge'].registerForBarcode((data) => {
			this.scanData = data;
			var result = {
				type: data.type,
				barcode: data.barcode
			};
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(result);
			}
			this.notifyListeners(result);
		})
	}

	private unregisterScannerStaticCallbackForDatawedge () {
		if (!window['datawedge']) {
			return;
		}
		window['datawedge'].unregisterBarcode()
	}

	private registerScannerStaticCallbackForCaribe () {
		if (!(window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['laser_scanner_plugin'])) {
			console.error('scanner caribe: not available');
			logger.error('scanner caribe: not available');
			return;
		}
		if (settings.settings.isDebug) {
			console.debug('scanner: registerScannerStaticCallbackForCaribe()');
		}
		this.unregisterScannerStaticCallbackForCaribe();
		this.caribeStaticCallbackFn = () => {
			if (settings.settings.isDebug) {
				console.debug('scanner: calling caribeStaticCallbackFn()');
			}
			var data = window['cordova']['plugins']['laser_scanner_plugin'].barCode;
			this.scanData = data;
			var result = {
				type: data[1],
				barcode: data[0]
			};
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(result);
			}
			this.notifyListeners(result);
		}
		document.addEventListener('barcode', this.caribeStaticCallbackFn);
	}

	private unregisterScannerStaticCallbackForCaribe () {
		if (!(window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['laser_scanner_plugin'])) {
			return;
		}
		document.removeEventListener('barcode', this.caribeStaticCallbackFn);
	}

	private registerScannerStaticCallbackForExtbluetooth () {
		if (settings.settings.isDebug) {
			console.debug('scanner: registerScannerStaticCallbackForExtbluetooth()');
		}
		var readingBarcode = false, barcodeRead = '';	

		this.unregisterScannerStaticCallbackForExtbluetooth();
		this.extbluetoothStaticCallbackFn = (e) => {
			//console.log("KeyPress: " + e.key);

			if (e.keyCode === 27) {
				// Start of barcode
				readingBarcode = true;
				e.preventDefault();
				return;
			}
		
			if (readingBarcode) {
				e.preventDefault();
		
				if (e.keyCode === 13) { // Enter
					readingBarcode = false;

					var result = {
						type: 'LABEL-TYPE-EAN128',
						barcode: barcodeRead
					};
					this.scanData = result;
					if (settings.settings.isDebug) {
						console.debug('scanner: scan result');
						console.dir(result);
					}
					this.notifyListeners(result);

					barcodeRead = '';
					return;
				}
		
				// Append the next key to the end of the list
				//console.log("ReadingBarcode: " + e.key);
				barcodeRead += e.key;
			}
		}
		document.addEventListener('keydown', this.extbluetoothStaticCallbackFn);
	}

	private unregisterScannerStaticCallbackForExtbluetooth () {
		document.removeEventListener('keydown', this.extbluetoothStaticCallbackFn);
	}


	public scan (scanDataCallbackFn, scannerType?) {
		if (!scannerType) {
			scannerType  = this.getScannerType();
		}
		if (scannerType === 'browser') {
			this.scanByBrowser(scanDataCallbackFn);
		} else if (scannerType === 'camera') {
			this.scanByCamera(scanDataCallbackFn);
		} else if (scannerType === 'datawedge') {
			this.scanByDatawedge(scanDataCallbackFn);
		} else if (scannerType === 'caribe') {
			this.scanByCaribe(scanDataCallbackFn);
		} else if (scannerType === 'extbluetooth') {
			this.scanByExtbluetooth(scanDataCallbackFn);
		} else {
			var errMsg = 'scanner: unsupported scanner type: ' + scannerType;
			console.error(errMsg);
			var err = new Error(errMsg);
			logger.error(errMsg, err);
			throw err;
		}
	}

	private scanByBrowser (scanDataCallbackFn) {
		if (settings.settings.isDebug) {
			console.debug('scanner: scan by browser');
		}
		var barcodeType = prompt('Barcode TYPE (EAN128/CODE128/CODE39/QRCODE)', 'EAN128');
		if (!barcodeType) {
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		var barcodeValue = prompt('Barcode VALUE', '');
		if (!barcodeValue) {
			if (settings.settings.isDebug) {
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
		if (settings.settings.isDebug) {
			console.debug('scanner: scan result');
			console.dir(result);
		}
		this.scanData = result;
		scanDataCallbackFn(result);
	}

	private scanByCamera (scanDataCallbackFn) {
		if (settings.settings.isDebug) {
			console.debug('scanner: scan by camera');
		}

		if (!(window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['barcodeScanner'])) {
			console.error('scanner: no camera barcode scanner plugin installed');
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		var scan = window['cordova']['plugins']['barcodeScanner'].scan;
		scan ((res) => {
			if (res.cancelled) {
				if (settings.settings.isDebug) {
					console.debug('scanner: scan result');
					console.dir(undefined);
				}
				scanDataCallbackFn();
				return;
			}

			this.scanData = res;
			var result = {
				type: 'LABEL-TYPE-' + res.format.replace('-', '').replace('_', ''),
				barcode: res.text
			};
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(result);
			}
			scanDataCallbackFn(result);
		});
	}

	private scanByDatawedge (scanDataCallbackFn) {
		if (settings.settings.isDebug) {
			console.debug('scanner: scan by datawedge');
		}
		if (!window['datawedge']) {
			console.error('scanner: no datawedge plugin installed');
			var err = new Error('scanner: no datawedge plugin installed')
			logger.error('scanner: no datawedge plugin installed', err);
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		}

		if (!this.datawedgeStarted) {
			window['datawedge'].start();
			this.datawedgeStarted = true;
		}

		var _fn = this.getListener();
		var fn = (result) => {
			this.unregisterListener();
			if (_fn) {
				this.registerListener(_fn);
			}
			window['datawedge'].stopScanner()
			scanDataCallbackFn(result);
		}
		this.registerListener(fn);

		window['datawedge'].startScanner();
	}

	private scanByCaribe (scanDataCallbackFn) {
		if (settings.settings.isDebug) {
			console.debug('scanner: scan by caribe');
		}
		if (!(window['cordova'] && window['cordova']['plugins'] && window['cordova']['plugins']['laser_scanner_plugin'])) {
			console.error('scanner: no caribe plugin installed');
			var err = new Error('scanner: no caribe plugin installed')
			logger.error('scanner: no caribe plugin installed', err);
			if (settings.settings.isDebug) {
				console.debug('scanner: scan result');
				console.dir(undefined);
			}
			scanDataCallbackFn();
			return;
		} 

		var _fn = this.getListener();
		var fn = (result) => {
			this.unregisterListener();
			if (_fn) {
				this.registerListener(_fn);
			}
			scanDataCallbackFn(result);
		}
		this.registerListener(fn);
	}

	private scanByExtbluetooth (scanDataCallbackFn) {
		if (settings.settings.isDebug) {
			console.debug('scanner: scan by extbluetooth');
		}

		var _fn = this.getListener();
		var fn = (result) => {
			this.unregisterListener();
			if (_fn) {
				this.registerListener(_fn);
			}
			scanDataCallbackFn(result);
		}
		this.registerListener(fn);
	}
}
