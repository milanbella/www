import { cdDocument } from '../types';

// import * as models from './models';
import { v1 as uuidV1 } from 'uuid';

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

	DB_Processed: boolean;
	DocStatus: string;
	DocAction: string;
	MovementDate: Date;
	AD_Org_ID: number;
	SalesRep_ID: number;
}

export class MProductPriceWorksheet {
	static newProductPriceWorksheet(): M_ProductPrice_Worksheet {
		return {
			modifiedDate: new Date().toISOString(),
			M_ProductPrice_Worksheet_UU: uuidV1(),
			DB_TableName: 'M_ProductPrice_Worksheet',
			C_BPartner_ID: 0,
			M_Product_ID: 0,
			PriceList: 0,
			Discount: 0,
			PriceStd: 0,
			Created: new Date(),
			CreatedBy: '',

			DB_Processed: false,
			DocStatus: 'DR',
			DocAction: 'PR',
			MovementDate: new Date(),
			AD_Org_ID: 0,
			SalesRep_ID: 0,
			C_DocType_ID: 0,
			AD_PInstance_ID: null,
			documentProcessingStatus: 'new',
		};
	}
}
