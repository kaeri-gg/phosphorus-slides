import fs from 'fs';

const rawText = fs.readFileSync('public/conference.md', 'utf-8');

// Minimal DOM simulation using regex or JSDOM/browser
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Import StepParser
const { StepParser } = await import('./src/core/StepParser.js');

const steps = StepParser.parse(rawText);

console.log('Total steps parsed:', steps.length);
steps.forEach((s, idx) => {
    console.log(`\nStep [${idx + 1}] ID: ${s.id}`);
    console.log(`  Layout: ${s.layout}`);
    console.log(`  Timeline:`, s.timeline ? `activeIndex: ${s.timeline.activeIndex}` : null);
    console.log(`  Nodes count: ${s.nodes.size}`);
    console.log(`  Nodes keys:`, Array.from(s.nodes.keys()));
});
