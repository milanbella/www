import { v1 as uuidV1 } from 'uuid';

import { cdDbObject, cdDocument } from '../types';

export interface PosOrder extends cdDocument {
	DB_TableName: string; // CouchDBFiltering
	AD_Org_ID: number;
	M_Warehouse_ID: number;
	C_Order_ID?: number;
	Return_C_Order_UU?: string;
	uuid: string;
	DocumentNo: string;
	Payed: boolean;
	C_BPartner_ID: number;
	C_BPartner_Location_ID: number;
	Bill_Location_ID: number;
	// Bill_BPartner_ID: number;
	SalesRep_ID: number;
	C_DocType_ID: number;
	C_POS_ID: number;
	M_PriceList_ID: number;
	Created: Date;
	PaymentRule: string;
	posOrderLines: PosOrderLine[];
	posOrderTax: PosOrderTax[];
	C_POSPayment: C_POSPayment[];
	DocSubType: string;
	Description: string;
	IsRMA: boolean;
	PrintCount?: number;
}

export interface PosOrderLine extends cdDbObject {
	uuid: string;
	Return_C_OrderLine_UU?: string;
	M_Product_ID: number;
	C_UOM_ID: number;
	M_Product_C_UOM_ID: number;
	QtyEntered: number;
	QtyOrdered: number;
	PriceList: number;
	PriceStd: number;
	PriceLimit: number;
	Discount: number;
	WasteRecyclingFee: number;
	Rate: number;
	IsTaxIncluded: boolean;
	isReadOnly?: boolean;
}

export interface PosOrderTax {
	uuid: string;
	Rate: number;
	// c_tax_id: number;
	TaxAmt: number;
	TaxBaseAmt: number;
}

export interface C_POSPayment {
	uuid: string;
	C_POSTenderType_ID: number;
	PayAmt: number;
}

export class MPOSOrder {
	static newPosOrder(posOrderCpyFrom?: PosOrder, copyReturnUUID?: boolean): PosOrder {
		const newPosOrder: PosOrder = {
			modifiedDate: new Date().toISOString(),
			uuid: uuidV1(),
			DocumentNo: '',
			AD_Org_ID: 0,
			M_Warehouse_ID: 0,
			Payed: false,
			C_BPartner_ID: 0,
			C_BPartner_Location_ID: 0,
			Bill_Location_ID: 0,
			SalesRep_ID: 0,
			C_DocType_ID: 0,
			DocSubType: '',
			C_POS_ID: 0,
			M_PriceList_ID: 0,
			DB_TableName: 'C_Order',
			Created: new Date(),
			PaymentRule: 'C',
			Description: '',
			IsRMA: false,
			PrintCount: 0,
			posOrderLines: [],
			posOrderTax: [],
			C_POSPayment: [],
			documentProcessingStatus: 'new',
			AD_PInstance_ID: null,
		};

		if (posOrderCpyFrom) {
			newPosOrder.C_BPartner_ID = posOrderCpyFrom.C_BPartner_ID;
			newPosOrder.C_BPartner_Location_ID = posOrderCpyFrom.C_BPartner_Location_ID;
			newPosOrder.Bill_Location_ID = posOrderCpyFrom.Bill_Location_ID;
			newPosOrder.SalesRep_ID = posOrderCpyFrom.SalesRep_ID;
			newPosOrder.C_DocType_ID = posOrderCpyFrom.C_DocType_ID;
			newPosOrder.DocSubType = posOrderCpyFrom.DocSubType;
			newPosOrder.C_POS_ID = posOrderCpyFrom.C_POS_ID;
			newPosOrder.M_PriceList_ID = posOrderCpyFrom.M_PriceList_ID;
			newPosOrder.DB_TableName = posOrderCpyFrom.DB_TableName;
			newPosOrder.PaymentRule = posOrderCpyFrom.PaymentRule;
			newPosOrder.AD_Org_ID = posOrderCpyFrom.AD_Org_ID;
			newPosOrder.M_Warehouse_ID = posOrderCpyFrom.M_Warehouse_ID;
			// isRMA
			newPosOrder.IsRMA = posOrderCpyFrom.IsRMA;

			if (copyReturnUUID) {
				// newPosOrder.Created = posOrderCpyFrom.Created;	// Copy Date from Original SO
				newPosOrder.Return_C_Order_UU = posOrderCpyFrom.uuid;
			}
		}
		return newPosOrder;
	}
}

/**
 * @todo HARDCODED Rate
 */
export class MPOSOrderLine {
	static newPosOrderLine(posOrderLineCpyFrom?: PosOrderLine, copyReturnUUID?: boolean): PosOrderLine {
		const newPosOrderLine: PosOrderLine = {
			uuid: uuidV1(),
			M_Product_ID: 0,
			QtyEntered: 0,
			QtyOrdered: 0,
			C_UOM_ID: 0,
			M_Product_C_UOM_ID: 0,
			PriceList: 0,
			PriceStd: 0,
			PriceLimit: 0,
			Discount: 0,
			WasteRecyclingFee: 0,
			Rate: 20,
			IsTaxIncluded: false,
		};

		if (posOrderLineCpyFrom) {
			newPosOrderLine.M_Product_ID = posOrderLineCpyFrom.M_Product_ID;
			newPosOrderLine.QtyEntered = posOrderLineCpyFrom.QtyEntered;
			newPosOrderLine.QtyOrdered = posOrderLineCpyFrom.QtyOrdered;
			newPosOrderLine.C_UOM_ID = posOrderLineCpyFrom.C_UOM_ID;
			newPosOrderLine.M_Product_C_UOM_ID = posOrderLineCpyFrom.M_Product_C_UOM_ID;
			newPosOrderLine.PriceList = posOrderLineCpyFrom.PriceList;
			newPosOrderLine.PriceStd = posOrderLineCpyFrom.PriceStd;
			newPosOrderLine.PriceLimit = posOrderLineCpyFrom.PriceLimit;
			newPosOrderLine.Discount = posOrderLineCpyFrom.Discount;
			newPosOrderLine.WasteRecyclingFee = posOrderLineCpyFrom.WasteRecyclingFee;
			newPosOrderLine.Rate = posOrderLineCpyFrom.Rate;
			newPosOrderLine.IsTaxIncluded = posOrderLineCpyFrom.IsTaxIncluded;

			if (copyReturnUUID) {
				newPosOrderLine.Return_C_OrderLine_UU = posOrderLineCpyFrom.uuid;
			}
			// We Do not copy Lines
		}
		return newPosOrderLine;
	}
}

export class MPOSPayment {
	static newPosPayment(): C_POSPayment {
		return {
			uuid: uuidV1(),
			C_POSTenderType_ID: 0,
			PayAmt: 0,
		};
	}
}

export class MPosOrderTax {
	static newPosOrderTax(): PosOrderTax {
		return {
			uuid: uuidV1(),
			Rate: 20,
			TaxAmt: 0,
			TaxBaseAmt: 0,
		};
	}
}
