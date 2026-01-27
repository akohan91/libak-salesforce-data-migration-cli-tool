import { readFileSync, existsSync, mkdirSync } from 'fs';

import { initArguments, connectToOrgs, getArgs } from './cli.js'
import { MigrateService } from './services/migrate-service.js';
import { handleCliError, displayGenericError } from './services/salesforce-error-handler.js';
import { ReferenceAnalyzerService } from './services/reference-analyzer-service.js';


try {
	console.log('\n🚀 Salesforce Data Migration Tool\n');

	initArguments();

	console.log('📡 Connecting to Salesforce orgs...');
	connectToOrgs();
	console.log('\t✅ Successfully connected to source and target orgs\n');

	console.log('📄 Loading export configuration...');
	const exportConfig = JSON.parse(
		readFileSync(getArgs().exportConfig, 'utf-8')
	);
	console.log(`\t✅ Configuration loaded: ${getArgs().exportConfig}\n`);

	if (getArgs().analyzeReferences) {
		await new ReferenceAnalyzerService(exportConfig.treeConfig)
			.analyzeReferences();
	} else {
		await new MigrateService(exportConfig.treeConfig, exportConfig.dependencyConfig)
			.migrateData();
	}
} catch (error) {
	const { handled } = handleCliError(error);
	
	if (handled) {
		console.error('\n❌ Migration failed (see details above)\n');
	} else {
		displayGenericError(error);
	}
	getArgs().debug && console.log(error);
	
	process.exit(1);
}