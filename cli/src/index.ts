import { Command } from 'commander';
import { registerRegressCommand } from './commands/regress';
import { registerAnalyzeCommand } from './commands/analyze';
import { registerCompareCommand } from './commands/compare';
import { registerIncidentCommand } from './commands/incident';
import { registerBatchCommand } from './commands/batch';
import { registerValidateCommand } from './commands/validate';
import { registerHistoricalCommand } from './commands/historical';

const program = new Command();

program
  .name('vitals')
  .description('VITALS CLI - Performance decision engine for CI/CD')
  .version('0.4.0');

// Register commands
registerRegressCommand(program);
registerAnalyzeCommand(program);
registerCompareCommand(program);
registerIncidentCommand(program);
registerBatchCommand(program);
registerValidateCommand(program);
registerHistoricalCommand(program);

program.parse(process.argv);
