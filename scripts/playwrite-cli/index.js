#!/usr/bin/env node
import { spawn } from 'node:child_process';

const child = spawn('npx', ['playwright', ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
