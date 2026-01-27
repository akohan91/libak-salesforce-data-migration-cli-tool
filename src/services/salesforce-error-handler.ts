import type { SaveError, SaveResult } from "jsforce";
import type { DatabaseUnifiedResult } from "../types/types.ts";

export const handleCliError = (error: any) => {
	console.error(error);
}

export const formatDatabaseErrors = (results: SaveResult[]): DatabaseUnifiedResult => {
	const successCount = results.filter(ret => ret.success).length;
	const successIds = results.map(ret => ret.id);
	const errorCount = results.length - successCount;
	
	const summary: DatabaseUnifiedResult = {
		successCount,
		successIds,
		errorCount,
		errors: []
	};

	if (errorCount > 0) {
		for (const ret of results) {
			if (!ret.success) {
				const errors: SaveError[] = ret.errors;
				errors.forEach((error: SaveError) => {
					summary.errors?.push({
						statusCode: error.errorCode,
						message: error.message,
						fields: error.fields || []
					});
				});
			}
		}
	}

	return summary;
}

export const displayDatabaseResults = (
	actionName: string,
	summary: DatabaseUnifiedResult,
	sObjectApiName: string
): void => {
	if (summary.successCount > 0) {
		console.log(`\t✅ ${actionName}ed ${summary.successCount} ${sObjectApiName} record${summary.successCount !== 1 ? 's' : ''}: ${summary.successIds.join(', ')}`);
	}
	
	if (summary.errorCount > 0) {
		console.log(`\t⚠️  Failed to ${actionName} ${summary.errorCount} ${sObjectApiName} record${summary.errorCount !== 1 ? 's' : ''}:`);
		
		summary.errors?.forEach(error => {
			console.log(`\t   • ${error.message} (${error.statusCode})`);
		});
	}
}
