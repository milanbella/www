import { PROJECT_NAME } from './consts';
import { webservice_url, restapi_url } from './environment';
import { whttp } from './whttp';
import { Order } from './rest-model/Order';
import { Principal } from './types';
import { getLogger } from './logger';
import { authPrincipal } from './authprincipal';
import { PhysCountsPOSTRequest } from './rest-model/PhysCountsPOSTRequest';
import { MovementsStockKeeperPOSTRequest } from './rest-model/MovementsStockKeeperPOSTRequest';
import { LabelPrintPOSTRequest } from './rest-model/LabelPrintPOSTRequest';
import { PackagesGeneratePostRequest } from './rest-model/PackagesGeneratePostRequest';
import { newRequest } from './fetch';

import * as R from 'ramda';

let logger = getLogger(PROJECT_NAME, 'webservice.ts');

export class WebService {
	getLotInfo(lot_id): Promise<any> {
		const FUNC = 'getLotInfo()';
		let search = new URLSearchParams();
		search.append('LotSearchKey', lot_id);

		let request = newRequest(webservice_url() + '/' + 'infolot' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getDDOrder(order_id, replicationStrategy): Promise<any> {
		const FUNC = 'getDDOrder()';
		let search = new URLSearchParams();
		search.append('AD_ReplicationStrategy_ID', replicationStrategy);
		search.append('AD_Table_ID', '53037');
		search.append('Record_ID', order_id);

		let request = newRequest(webservice_url() + '/' + 'replication' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getRecordReplication(ad_table_id, record_id, replicationStrategy): Promise<any> {
		const FUNC = 'getRecordReplication()';
		let search = new URLSearchParams();
		search.append('AD_ReplicationStrategy_ID', replicationStrategy);
		search.append('AD_Table_ID', ad_table_id);
		search.append('Record_ID', record_id);

		let request = newRequest(webservice_url() + '/' + 'replication' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getHUInfo(hu_id): Promise<any> {
		const FUNC = 'getHUInfo()';
		let search = new URLSearchParams();
		search.append('HuSearchKey', hu_id);

		let request = newRequest(webservice_url() + '/' + 'infohu' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	confirmDDO(orderlines): Promise<any> {
		const FUNC = 'confirmDDO()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				DD_Orderlines: orderlines,
			}),
		};

		let request = newRequest(webservice_url() + '/' + 'confirmddo', options);

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getDeviceSettings(deviceUuid): Promise<any> {
		const FUNC = 'getDeviceSettings()';
		let search = new URLSearchParams();
		search.append('$filter', `device_uuid eq '${deviceUuid}'`);

		let request = newRequest(restapi_url() + '/models/ws_ad_mobile_device_dataset' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					rep = R.map(R.pick(['key', 'value']), rep);
					return {
						Data: {
							Rows: rep,
						},
					};
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	noteAcknowledge(boradcastId, applicationId): Promise<any> {
		const FUNC = 'noteAcknowledge()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				BroadcastMessage_ID: boradcastId,
				EX_System_App_ID: applicationId,
			}),
		};
		let request = newRequest(webservice_url() + '/' + 'notice/ack', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getJobStatus(p_AD_PInstance_ID): Promise<any> {
		const FUNC = 'getJobStatus()';
		let search = new URLSearchParams();
		search.append('AD_PInstance_ID', p_AD_PInstance_ID);

		let request = newRequest(webservice_url() + '/' + 'jobstatus' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	putOrder(p_order: Order): Promise<any> {
		const FUNC = 'putOrder()';
		let options = {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_order),
		};
		let request = newRequest(webservice_url() + '/' + 'order', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	postPhysCounts(p_PhysCount: PhysCountsPOSTRequest): Promise<any> {
		const FUNC = 'postPhysCounts()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_PhysCount),
		};
		let request = newRequest(webservice_url() + '/' + 'physcounts', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	postInvMovesStockKeeper(p_req: MovementsStockKeeperPOSTRequest): Promise<any> {
		const FUNC = 'postInvMovesStockKeeper()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_req),
		};
		let request = newRequest(webservice_url() + '/' + 'movements/stockkeeper', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	postLabelPrint(p_req: LabelPrintPOSTRequest): Promise<any> {
		const FUNC = 'postLabelPrint()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_req),
		};
		let request = newRequest(webservice_url() + '/' + 'labelprint', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	postPackageGenerate(p_req: PackagesGeneratePostRequest): Promise<any> {
		const FUNC = 'postPackageGenerate()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_req),
		};
		let request = newRequest(webservice_url() + '/' + 'packages/generate', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getPackageByMovement(p_M_Movement_ID: number): Promise<any> {
		const FUNC = 'postPackageGenerate()';
		let search = new URLSearchParams();
		search.append('M_Movement_ID', p_M_Movement_ID.toString());

		let request = newRequest(webservice_url() + '/' + 'packages' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	postProductAssignEAN(p_req: any): Promise<any> {
		const FUNC = 'postProductAssignEAN()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_req),
		};
		let request = newRequest(webservice_url() + '/' + 'products/ean', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getStorageAllocations(p_M_Product_ID: number): Promise<any> {
		const FUNC = 'getStorageAllocations()';
		let search = new URLSearchParams();
		search.append('M_Product_ID', p_M_Product_ID.toString());

		let request = newRequest(webservice_url() + '/' + 'storageallocations' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then((rep) => {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	deleteMovementLines(p_M_MovementLine_ID: number): Promise<any> {
		const FUNC = 'deleteMovementLines()';
		let search = new URLSearchParams();
		search.append('M_MovementLine_ID', p_M_MovementLine_ID.toString());

		let request = newRequest(webservice_url() + '/' + 'movementlines' + '?' + search.toString(), { method: 'DELETE' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then(function (rep) {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	getStorageOnHands(p_M_Product_ID: number, p_M_Locator_ID: number, p_M_AttributeSetInstance_ID: number): Promise<any> {
		const FUNC = 'getStorageOnHands()';
		let search = new URLSearchParams();
		if (p_M_Product_ID > 0) {
			search.append('M_Product_ID', p_M_Product_ID.toString());
		}
		if (p_M_Locator_ID > 0) {
			search.append('M_Locator_ID', p_M_Locator_ID.toString());
		}
		if (p_M_AttributeSetInstance_ID > 0) {
			search.append('M_AttributeSetInstance_ID', p_M_AttributeSetInstance_ID.toString());
		}

		let request = newRequest(webservice_url() + '/' + 'storageonhands/qtyonhand' + '?' + search.toString(), { method: 'GET' });

		return whttp
			.send(request)
			.then((response) => {
				return response.json().then(function (rep) {
					return rep;
				});
			})
			.catch((err) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	}

	postProductAssignLocator = function (p_req: any): Promise<any> {
		const FUNC = 'postProductAssignLocator()';
		let options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(p_req),
		};
		let request = newRequest(webservice_url() + '/' + 'products/locator', options);
		return whttp
			.send(request)
			.then((response) => {
				return response.json();
			})
			.catch((err: Error) => {
				logger.error(FUNC, 'error: ', err);
				return Promise.reject(err);
			});
	};
}

export let webService: WebService = new WebService();

export function testAccessToken() {
	console.log('@@@@@@@@@@@@@@@ testAccessToken():');
	console.log('@@@@@@@@@@@@@@@ testAccessToken(): calling webService.getLotInfo()');
	return webService.getLotInfo(5).then(
		(response) => {
			console.log('@@@@@@@@@@@@@@@ testAccessToken(): success');
			console.dir(response);
		},
		(err) => {
			console.log('@@@@@@@@@@@@@@@ testAccessToken(): error: ' + err);
			console.dir(err);
		}
	);
}
export function testRefreshToken() {
	console.log('@@@@@@@@@@@@@@@ testRefreshToken():');
	return authPrincipal
		.getPrincipal()
		.then((principal: Principal) => {
			principal.accessToken = 'invalid_access_token_test';
			return authPrincipal.setPrincipal(principal);
		})
		.then(() => {
			console.log('@@@@@@@@@@@@@@@ testRefreshToken(): calling webService.getLotInfo() using invalid access token');
			return webService.getLotInfo(5);
		})
		.then(
			(response) => {
				console.log('@@@@@@@@@@@@@@@ testRefreshToken(): success');
				console.dir(response);
			},
			(err) => {
				console.log('@@@@@@@@@@@@@@@ testRefreshToken(): error: ' + err);
				console.dir(err);
			}
		);
}
