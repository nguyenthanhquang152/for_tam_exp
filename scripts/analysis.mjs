import { runPython } from './runtime.mjs';

runPython(['-m', 'shrimp_microbiota', ...process.argv.slice(2)], { stdio: 'inherit' });
