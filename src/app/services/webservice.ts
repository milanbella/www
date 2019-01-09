import { promiseReject } from '../common/utils';
import { Whttp } from './whttp';
import { Order } from '../rest-model/Order';
import * as models from  '../rest-model/models';
import { logger } from './logger';
import { whttp } from './whttp';


export class WebService {

	webservice_url: string = 'https://apiv1.cloudempiere.com/alpha/';

	getApiUrl () {
		return this.webservice_url;
	};

	delay (time): Promise<any> {
		return new Promise((resolve) => {
				setTimeout(resolve, time);
		});
	};

	checkAsyncJob (lastResponse, timeWait?, timeout?): Promise<any> {
		timeWait = timeWait || 30000;


		/** Get Data from Response String
			TODO Change Response message in backend?
			*/
		var responseMsg = lastResponse.Data.Response;
		var AD_PInstance_ID = responseMsg.split("AD_PInstance_ID = ")[1];
		return 	this.getJobStatus(AD_PInstance_ID).then((PInstance) => {
				if(PInstance.IsProcessing == 'N') {
					if(PInstance.Result === 1) {
						return PInstance.ErrorMsg;
					}
					else {
						return Promise.reject(PInstance.ErrorMsg);
					}
				} else {
					return this.delay(timeWait).then(() => {	//Time sleep
						if (timeout) {
							if (timeout < 0) {
								console.error('checkAsyncJob(): timeout');
								console.dir(PInstance);
								var err = new Error('checkAsyncJob(): timeout');
								logger.error('checkAsyncJob: timeout', err);
								return promiseReject('checkAsyncJob(): timeout');
							}
							timeout -= timeWait
						}
						return this.checkAsyncJob(lastResponse, timeWait, timeout);
					});
				}
			});
	};

	getLotInfo (lot_id): Promise<any> {

		var search = new URLSearchParams();
		search.append('LotSearchKey', lot_id);

		var request = new Request(this.webservice_url + 'infolot' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getLotInfo()', err);
			logger.error('getLotInfo()', err);
			return promiseReject(err);			
		});
	};


	getDDOrder (order_id, replicationStrategy): Promise<any> {
		var search = new URLSearchParams();
		search.append('AD_ReplicationStrategy_ID', replicationStrategy);
		search.append('AD_Table_ID', '53037');
		search.append('Record_ID', order_id);

		var request = new Request(this.webservice_url + 'replication' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getDDOrder()', err);
			logger.error('getDDOrder()', err);
			return promiseReject(err);			
		});
	};

	getRecordReplication (ad_table_id, record_id, replicationStrategy): Promise<any> {
		var search = new URLSearchParams();
		search.append('AD_ReplicationStrategy_ID', replicationStrategy);
		search.append('AD_Table_ID', ad_table_id);
		search.append('Record_ID', record_id);

		var request = new Request(this.webservice_url + 'replication' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getRecordReplication()', err);
			logger.error('getRecordReplication()', err);
			return promiseReject(err);			
		});
	};

	init (queueId, v_AD_ReplicationStrategy_ID_INIT): Promise<any> {

		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({                                                                                                              
				'AD_ReplicationStrategy_ID': v_AD_ReplicationStrategy_ID_INIT,                                                                                               
				'AD_Queue_ID': queueId,                                                                                                                                      
				'MaxQueryRecords' : 0                                                                                                                                        
			})
		}

		var request = new Request(this.webservice_url + 'device/init', options);

		return whttp.send(request)
		.then((response) => {
			return response.json().then((rep) => {
				// call async handler to check finnished Process
				return this.checkAsyncJob(rep, 30000).then((responseAsync) => {
					//Response should be JSON
					return responseAsync;
				});
			});
		}).catch((err) => {			
			console.error('init()', err);
			logger.error('init()', err);
			return promiseReject(err);			
		});

	};

	getHUInfo (hu_id): Promise<any> {

		var search = new URLSearchParams();
		search.append('HuSearchKey', hu_id);

		var request = new Request(this.webservice_url + 'infohu' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getHUInfo()', err);
			logger.error('getHUInfo()', err);
			return promiseReject(err);			
		});
	};

	confirmDDO (orderlines): Promise<any> {

		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				'DD_Orderlines': orderlines
			})
		}

		var request = new Request(this.webservice_url + 'confirmddo', options);

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('confirmDDO()', err);
			logger.error('confirmDDO()', err);
			return promiseReject(err);			
		});
	};

	createShipmentFromHU (org_id, loc_id, docType_id, huitems): Promise<any> {

		var handlingUnits = [];
		for(var _hui in huitems) handlingUnits.push({'HuSearchKey': huitems[_hui]});

		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				'C_DocType_ID': docType_id,
				'AD_Org_ID': org_id,
				'M_Locator_ID': loc_id,
				'HandlingUnits': handlingUnits,
				'isRunAsJob': 'Y'	// Async Call
			})
		};

		var request = new Request(this.webservice_url + 'shipment/createfromhu', options);

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
					// call async handler to check finnished Process
					return this.checkAsyncJob(response.json(), 5000).then((responseAsync) => {
					//Response should be JSON
					return responseAsync;
				});
			});
		}).catch((err) => {			
			console.error('createShipmentFromHU()', err);
			logger.error('createShipmentFromHU()', err);
			return promiseReject(err);			
		});
	};

	getDeviceSettings (deviceUuid): Promise<any> {

		var search = new URLSearchParams();
		search.append('Device_UUID', deviceUuid);

		var request = new Request(this.webservice_url + 'device/settings' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getDeviceSettings()', err);
			logger.error('getDeviceSettings()', err);
			return promiseReject(err);			
		});
	};


	noteAcknowledge (boradcastId, applicationId): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				BroadcastMessage_ID: boradcastId,
				EX_System_App_ID: applicationId
			})
		}
		var request = new Request(this.webservice_url + 'notice/ack', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('noteAcknowledge()', err);
			logger.error('noteAcknowledge()', err);
			return promiseReject(err);			
		});
	};

	getJobStatus (p_AD_PInstance_ID): Promise<any> {

		var search = new URLSearchParams();
		search.append('AD_PInstance_ID', p_AD_PInstance_ID);

		var request = new Request(this.webservice_url + 'jobstatus' + '?' + search.toString(), {method: 'GET'});

		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getJobStatus()', err);
			logger.error('getJobStatus()', err);
			return promiseReject(err);			
		});
	};


	putOrder (p_order: Order): Promise<any> {
		var options = {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_order)
		}
		var request = new Request(this.webservice_url + 'order', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('putOrder()', err);
			logger.error('putOrder()', err);
			return promiseReject(err);			
		});
	};

	postPhysCounts (p_PhysCount: models.PhysCountsPOSTRequest): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_PhysCount)
		}
		var request = new Request(this.webservice_url + 'physcounts', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('postPhysCounts()', err);
			logger.error('postPhysCounts()', err);
			return promiseReject(err);			
		});
	};

	postInvMoves (p_PhysCount: models.MovementsPOSTRequest): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_PhysCount)
		};
		var request = new Request(this.webservice_url + 'movements', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('postInvMoves()', err);
			logger.error('postInvMoves()', err);
			return promiseReject(err);			
		});
	};

	postReturnAuthorisations (p_rma: models.RMAsPOSTRequest): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_rma)
		};
		var request = new Request(this.webservice_url + 'returnauthorisations', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('postReturnAuthorisations()', err);
			logger.error('postReturnAuthorisations()', err);
			return promiseReject(err);			
		});
	};

	postInvMovesStockKeeper (p_req: models.MovementsStockKeeperPOSTRequest): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_req)
		};
		var request = new Request(this.webservice_url + 'movements/stockkeeper', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {
			console.error('postInvMovesStockKeeper()', err);
			logger.error('postInvMovesStockKeeper()', err);
			return promiseReject(err);			
		});
	};

	postLabelPrint (p_req: models.LabelPrintPOSTRequest): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_req)
		};
		var request = new Request(this.webservice_url + 'labelprint', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('postLabelPrint()', err);
			logger.error('postLabelPrint()', err);
			return promiseReject(err);			
		});
	};

	postPackageGenerate (p_req: models.PackagesGeneratePostRequest): Promise<any> {
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_req)
		};
		var request = new Request(this.webservice_url + 'packages/generate', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('postPackageGenerate()', err);
			logger.error('postPackageGenerate()', err);
			return promiseReject(err);			
		});;
	};

	getPackageByMovement (p_M_Movement_ID: number): Promise<any> {

		var search = new URLSearchParams();
		search.append('M_Movement_ID', p_M_Movement_ID.toString());

		var request = new Request(this.webservice_url + 'packages' + '?' + search.toString(), {method: 'GET'});
		
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getPackageByMovement()', err);
			logger.error('getPackageByMovement()', err);
			return promiseReject(err);			
		});
	};

	postProductAssignEAN (p_req: any): Promise<any> {		
		var options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(p_req)
		};
		var request = new Request(this.webservice_url + 'products/ean', options);
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('postProductAssignEAN()', err);
			logger.error('postProductAssignEAN()', err);
			return promiseReject(err);			
		});
	};

	getStorageAllocations (p_M_Product_ID: number) : Promise<any> {

		var search = new URLSearchParams();
		search.append('M_Product_ID', p_M_Product_ID.toString());

		var request = new Request(this.webservice_url + 'storageallocations' + '?' + search.toString(), {method: 'GET'});
		
		return whttp.send(request).then((response) => {
			return response.json().then((rep) => {
				return rep;
			});
		}).catch((err) => {			
			console.error('getStorageAllocations()', err);
			logger.error('getStorageAllocations()', err);
			return promiseReject(err);			
		});
	};

	deleteMovementLines (p_M_MovementLine_ID: number) : Promise<any> {

		var search = new URLSearchParams();
		search.append('M_MovementLine_ID', p_M_MovementLine_ID.toString());

		var request = new Request(this.webservice_url + 'movementlines' + '?' + search.toString(), {method: 'DELETE'});
		
		return whttp.send(request).then((response) => {
			return response.json().then(function (rep) {
				return rep;
			});
		}).catch((err)=> {			
			console.error('deleteMovementLines()', err);
			logger.error('deleteMovementLines()', err);
			return promiseReject(err);			
		});
	};

    getStorageOnHands (p_M_Product_ID: number, p_M_Locator_ID:number, p_M_AttributeSetInstance_ID: number) : Promise<any> {                                                  
                                                                                                                                                                             
        var search = new URLSearchParams();                                                                                                                                  
        if(p_M_Product_ID > 0)                                                                                                                                               
            search.append('M_Product_ID', p_M_Product_ID.toString());                                                                                                        
        if(p_M_Locator_ID > 0)                                                                                                                                               
            search.append('M_Locator_ID', p_M_Locator_ID.toString());                                                                                                        
        if(p_M_AttributeSetInstance_ID > 0)                                                                                                                                  
            search.append('M_AttributeSetInstance_ID', p_M_AttributeSetInstance_ID.toString());                                                                              
                                                                                                                                                                             
        var request = new Request(this.webservice_url + 'storageonhands/qtyonhand' + '?' + search.toString(), {method: 'GET'});                                              
                                                                                                                                                                             
        return whttp.send(request).then((response) => {                                                                                                                      
            return response.json().then(function (rep) {                                                                                                                     
                return rep;                                                                                                                                                  
            });                                                                                                                                                              
        }).catch((err)=> {                                                                                                                                                   
            console.error('getStorageOnHands()', err);                                                                                                                       
            logger.error('getStorageOnHands()', err);                                                                                                                        
            return promiseReject(err);                                                                                                                                       
        });                                                                                                                                                                  
    };
}

export var webService: WebService = new WebService();
