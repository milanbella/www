import { cdDocument } from '../types';

export interface M_ProductPrice_Worksheet extends cdDocument {
	M_ProductPrice_Worksheet_UU: string;
	DB_TableName: string;
	C_BPartner_ID: number;
	M_Product_ID: number;
	PriceList: number;
	Discount: number;
	PriceStd: number;
	Created: Date;
	CreatedBy: string;

	AD_Org_ID: number;
	SalesRep_ID: number;
}
