import { initBootstrap } from './bootstrap-wrapper.js';
import './anchors.js';
import { bindVisualizers } from './attention-weights-visualizer.js';

async function main() {
    initBootstrap();
    bindVisualizers();
}

main();
