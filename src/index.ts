import { readFileSync } from 'fs';

import { initArguments, connectToOrgs, getArg, getTargetDb } from './cli.ts'
import { MigrateService } from './services/migrate-service.ts';
import { ReferenceAnalyzerService } from './services/reference-analyzer-service.ts';
import { CliArgName } from './types/types.ts';


try {
	console.log('\n🚀 Salesforce Data Migration Tool\n');

	initArguments();

	console.log('📡 Connecting to Salesforce orgs...');
	connectToOrgs();
	console.log('\t✅ Successfully connected to source and target orgs\n');

	console.log('📄 Loading export configuration...');
	const exportConfig = JSON.parse(
		readFileSync(getArg(CliArgName.exportConfig), 'utf-8')
	);
	console.log(`\t✅ Configuration loaded: ${getArg(CliArgName.exportConfig)}\n`);

	if (getArg(CliArgName.analyzeReferences)) {
		await new ReferenceAnalyzerService(
			exportConfig.treeConfig,
			exportConfig.skipSobjectDependencies,
		).analyzeReferences();
	} else {
		await new MigrateService(
			exportConfig.treeConfig,
			exportConfig.dependencyConfig
		).migrateData();
	}
} catch (error) {
	console.error(error);
	await getTargetDb().doRollback();
	process.exit(1);
}