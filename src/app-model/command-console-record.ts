import { cdDocument } from '../types';

export interface CommandConsoleRecord extends cdDocument {
	DB_TableName: string;
	uuid: string;
	noPackages: number;
	command: number;
	isPrinted: boolean;
	data: any;
	AD_Table_ID: number;
	Record_ID: number;
	printCopy: number;
	M_Shipper_ID: number;
	AD_PrintLabel_ID: number;
	AD_LabelPrinter_ID: number;
	SalesRep_ID: number;
	Created: Date;
	DocumentNo?: string;
	C_DocType_ID: number;
}
