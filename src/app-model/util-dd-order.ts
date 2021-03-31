import { DD_Order } from './dd-order';
import { DD_OrderLine } from './dd-order-line';

import { v1 as uuidV1 } from 'uuid';

export function newDDOrder(): DD_Order {
	return {
		modifiedDate: new Date().toISOString(),
		AD_PInstance_ID: 0,
		AD_Org_ID: 0,
		C_DocType_ID: 0,
		SalesRep_ID: 0,
		documentProcessingStatus: 'new',
		DD_Order_UU: uuidV1(),
		DB_TableName: 'DD_Order',
		DB_Processed: false,
		DD_Order_ID: 0,
		Created: new Date(),
		DateOrdered: new Date(),
		DocumentNo: '',
		C_BPartner_ID: 0,
		DD_OrderLine: [],
	};
}

export function newDDOrderLine(ddOrder?: DD_Order): DD_OrderLine {
	const newDDOrderLine: DD_OrderLine = {
		DD_OrderLine_UU: uuidV1(),
		Lot: '',
		M_Product_ID: 0,
		M_Locator_ID: 0,
		M_LocatorTo_ID: 0,
		DD_OrderLine_ID: 0,
		Line: 10,
		Qty: 1,
		ConfirmedQty: 0,
		ScrappedQty: 0,
		QtyOrdered: 0,
		Description: null,
	};
	if (ddOrder) {
		// Load Line
		if (ddOrder.DD_OrderLine.slice(-1)[0]) {
			newDDOrderLine.Line = ddOrder.DD_OrderLine.slice(-1)[0].Line + 10;
		}
	}
	return newDDOrderLine;
}
