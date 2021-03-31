import { cdDocument } from '../types';
import { DD_OrderLine } from './dd-order-line';

export interface DD_Order extends cdDocument {
	DD_Order_UU: string;
	DB_TableName: string;
	DB_Processed: boolean;
	DD_Order_ID: number;
	DD_OrderLine: Array<DD_OrderLine>;
	AD_Org_ID: number;
	SalesRep_ID: number;
	C_BPartner_ID?: number;
	DocumentNo: string;
	DateOrdered: Date;
	Created: Date;
}
