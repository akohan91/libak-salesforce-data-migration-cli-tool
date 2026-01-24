import { readFileSync, existsSync, mkdirSync } from 'fs';

import { initArguments, connectToOrgs, getArgs } from './cli.js'
import { MigrateService } from './services/migrate-service.js';
import { handleCliError, displayGenericError } from './services/salesforce-error-handler.js';

(async () => {
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

		if (!existsSync('_output')) {
			mkdirSync('_output', { recursive: true });
			console.log('📁 Created output directory: _output\n');
		}

		await new MigrateService(
			exportConfig.treeConfig,
			exportConfig.nonTreeConfig
		).migrateData();
		console.log('\n✅ Migration completed successfully!\n');
	} catch (error) {
		const { handled } = handleCliError(error);
		
		if (handled) {
			console.error('\n❌ Migration failed (see details above)\n');
		} else {
			displayGenericError(error);
		}
		
		process.exit(1);
	}
})();