import { readFileSync } from 'fs';

import { initArguments, connectToOrgs, getArgs } from './cli.ts'
import { MigrateService } from './services/migrate-service.ts';
import { handleCliError } from './services/salesforce-error-handler.ts';
import { ReferenceAnalyzerService } from './services/reference-analyzer-service.ts';


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
	handleCliError(error);
	process.exit(1);
}