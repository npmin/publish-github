#!/usr/bin/env node

import module from './node-pre-gyp-publish-github.js';
import program from 'commander';

program
	.command('publish [options]', {isDefault: true})
	.description('publishes the contents of .\\build\\stage\\{version} to the current version\'s GitHub release')
	.option("-r, --release", "publish immediately, do not create draft")
	.option("-s, --silent", "turns verbose messages off")
	.action(function(cmd, options){
		var opts = {},
			x = new module();
		opts.draft = options.release ? false : true;
		opts.verbose = options.silent ? false : true;
		x.publish(opts);
	});

program
	.command('help','',{isDefault: true, noHelp: true})
	.action(function() {
		console.log();
		console.log('Usage: publish-github publish');
		console.log();
		console.log('publishes the contents of .\\build\\stage\\{version} to the current version\'s GitHub release');
	});

program.parse(process.argv);

if (!program.args.length) {
	program.help();
}
