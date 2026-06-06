#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { scanRepo } from './scanner';
import { generateClaudeMd } from './generator';

const program = new Command();

program
  .name('anchorfile')
  .description('Generate a CLAUDE.md context file for AI coding agents.')
  .version('0.1.0');

program
  .command('init')
  .description('Scan the current repository and generate a CLAUDE.md file.')
  .option('--output <path>', 'Output file path', './CLAUDE.md')
  .option('--verbose', 'Log what is being scanned', false)
  .action(async (options: { output: string; verbose: boolean }) => {
    const rootPath = process.cwd();
    const outputPath = path.resolve(options.output);

    try {
      if (options.verbose) {
        console.log(`Scanning repository at ${rootPath}...`);
      }

      const context = await scanRepo(rootPath, options.verbose);
      const content = generateClaudeMd(context);

      fs.writeFileSync(outputPath, content, 'utf-8');
      console.log(`✓ CLAUDE.md generated at ${outputPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
