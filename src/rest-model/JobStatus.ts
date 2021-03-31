'use strict';

export interface JobStatus {
	/**
	 * Process instance ID.
	 */
	AD_PInstance_ID?: number;

	/**
	 * Time when Process Instance was updated.
	 */
	Updated?: string;

	/**
	 * Backend Process response message
	 */
	ErrorMsg?: string;

	/**
	 * Value describing if process is still running
	 */
	IsProcessing?: string;

	/**
	 * Process response status (1 - OK, else error)
	 */
	Result?: number;
}
