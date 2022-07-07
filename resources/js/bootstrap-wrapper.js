import { Tooltip } from '../lib/bootstrap/js/index.esm.js';

window.Tooltip = Tooltip;

function initTooltips() {
    const tooltipTriggerList = [].slice.call(
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new Tooltip(tooltipTriggerEl);
    });
}

export function initBootstrap() {
    initTooltips();
}
