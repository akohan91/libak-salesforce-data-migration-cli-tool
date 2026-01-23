const _parseCliError = (error) => {
	const errorOutput = error.stdout || error.stderr;
	
	if (!errorOutput) {
		return null;
	}
	try {
		const errorResponse = JSON.parse(errorOutput.replace(/\n|\r/g,''));
		const unifiedError = {
			hasErrors: true,
			errorName: errorResponse.name || 'IMPORT_ERROR',
			errorMessage: errorResponse.message,
			status: errorResponse.status
		}

		if (errorResponse.data && Array.isArray(errorResponse.data) && errorResponse.data.length > 0) {
			unifiedError.results = errorResponse.data;
		}
		return unifiedError;
	} catch (parseError) {
		return null;
	}
}

export const displayUnifiedErrors = (unifiedError) => {
	if (!unifiedError || !unifiedError.hasErrors) {
		return;
	}

	console.log(`\n❌ ${unifiedError.errorMessage || 'Import failed'}`);
	
	unifiedError.results?.forEach(result => {
		const refId = result.referenceId || result.refId || 'Unknown';
		const statusCode = result.StatusCode || result.statusCode || 'ERROR';
		const message = result.Message || result.message || 'No error message';
		const fields = result.fields && result.fields !== 'N/A' ? result.fields : null;
		
		console.log(`\t📋 Reference: ${refId}`);
		console.log(`\t• Status Code: ${statusCode}`);
		console.log(`\t• Message: ${message}`);
		
		if (fields) {
			console.log(`\t• Fields: ${fields}`);
		}
	});
}

export const displayGenericError = (error) => {
	console.error('\n❌ Migration failed:', error.message);
	
	if (error.code === 'ENOENT') {
		console.error('   Hint: Make sure the Salesforce CLI is installed and accessible');
	}
}

export const handleCliError = (error) => {
	const unifiedError = _parseCliError(error);

	if (unifiedError) {
		displayUnifiedErrors(unifiedError);
		return {
			handled: true,
			parsedError: unifiedError
		};
	}
	
	return {
		handled: false,
		parsedError: null
	};
}

export const formatUpdateErrors = (results) => {
	const successCount = results.filter(ret => ret.success).length;
	const errorCount = results.length - successCount;
	
	const summary = {
		successCount,
		errorCount,
		errors: []
	};

	if (errorCount > 0) {
		for (const ret of results) {
			if (!ret.success) {
				ret.errors.forEach(error => {
					summary.errors.push({
						statusCode: error.statusCode,
						message: error.message,
						fields: error.fields || []
					});
				});
			}
		}
	}

	return summary;
}

export const displayUpdateResults = (summary, sObjectApiName) => {
	if (summary.successCount > 0) {
		console.log(`\t✅ Updated ${summary.successCount} ${sObjectApiName} record${summary.successCount !== 1 ? 's' : ''}`);
	}
	
	if (summary.errorCount > 0) {
		console.log(`\t⚠️  Failed to update ${summary.errorCount} ${sObjectApiName} record${summary.errorCount !== 1 ? 's' : ''}:`);
		
		summary.errors.forEach(error => {
			console.log(`\t   • ${error.message} (${error.statusCode})`);
		});
	}
}
