import { localUrl, encodeArray } from './utils/fetch.js';
import { createGridElement } from './utils/dom.js';
import { Tooltip } from '../lib/bootstrap/js/index.esm.js';

async function getData(task, model, sentence_a, sentence_b) {
    const query = {
        sentence_a: encodeArray(sentence_a),
        sentence_b: encodeArray(sentence_b),
    };
    let url = '/run/' + task;
    if (model != null) {
        url += '/' + model;
    }
    const response = await fetch(localUrl(url, query), {
        method: 'GET',
    });
    const data = await response.json();
    return data;
}

function compareDistanceInner(first, second, lastiterI = 0, lastiterJ = 0) {
    const distances = [[]];
    for (let j = 0; j <= second.length; j++) {
        distances[0].push(j);
    }
    for (let i = 1; i <= first.length; i++) {
        distances.push(Array(second.length + 1).fill(0));
        distances[i][0] = i;
    }

    for (let i = 1; i <= first.length; i++) {
        for (let j = 1; j <= second.length; j++) {
            if (first[i - 1] == second[j - 1]) {
                distances[i][j] = distances[i - 1][j - 1];
            } else {
                distances[i][j] =
                    1 +
                    Math.min(
                        distances[i - 1][j],
                        distances[i][j - 1],
                        distances[i - 1][j - 1]
                    );
            }
        }
    }

    let i = first.length;
    let j = second.length;
    let result = [];

    while (i > 0 || j > 0) {
        if (i == 0 || distances[i][j] == distances[i][j - 1] + 1) {
            result.push([
                'i',
                lastiterI + i - 1,
                lastiterJ + j - 1,
                second[j - 1],
            ]);
            j--;
        } else if (j == 0 || distances[i][j] == distances[i - 1][j] + 1) {
            result.push([
                'd',
                lastiterI + i - 1,
                lastiterJ + j - 1,
                first[i - 1],
            ]);
            i--;
        } else if (distances[i][j] == distances[i - 1][j - 1] + 1) {
            result.push([
                'c',
                lastiterI + i - 1,
                lastiterJ + j - 1,
                first[i - 1],
                second[j - 1],
            ]);
            i--;
            j--;
        } else if (distances[i][j] == distances[i - 1][j - 1]) {
            result.push([
                'n',
                lastiterI + i - 1,
                lastiterJ + j - 1,
                first[i - 1],
            ]);
            i--;
            j--;
        }
    }

    return result.reverse();
}

function compareDistance(oldfirst, oldsecond) {
    let first = oldfirst.filter(function (x) {
        return x != '[PAD]';
    });
    let second = oldsecond.filter(function (x) {
        return x != '[PAD]';
    });

    const firstSplit = first.indexOf('[SEP]');
    const secondSplit = second.indexOf('[SEP]');

    first = [[first[0]]].concat(
        [first.slice(1, firstSplit)],
        [[first[firstSplit]]],
        [first.slice(firstSplit + 1, first.length - 1)],
        [[first[first.length - 1]]]
    );
    second = [[second[0]]].concat(
        [second.slice(1, secondSplit)],
        [[second[secondSplit]]],
        [second.slice(secondSplit + 1, second.length - 1)],
        [[second[second.length - 1]]]
    );

    let result = [];
    let lastiterI = 0;
    let lastiterJ = 0;
    for (let i = 0; i < 5; i++) {
        result = result.concat(
            compareDistanceInner(first[i], second[i], lastiterI, lastiterJ)
        );
        lastiterI = result[result.length - 1][1] + 1;
        lastiterJ = result[result.length - 1][2] + 1;
    }

    return result;
}

function createPrediction(task, predictions) {
    let labels;
    if (task == 'ari') {
        labels = ['support', 'attack', 'none'];
    } else if (task == 'fv') {
        labels = ['supports', 'attacks', 'not enough info'];
    } else {
        labels = ['entailment', 'contradiction', 'neutral'];
    }

    console.log(predictions);
    const positiveLabel = labels[0];
    const negativeLabel = labels[1];
    const neutralLabel = labels[2];

    const prediction = document.createElement('div');
    prediction.classList.add('attention-visualizer-prediction');
    prediction.classList.add('container');

    const best = document.createElement('div');
    best.classList.add('prediction-best');
    if (
        predictions[positiveLabel] > predictions[neutralLabel] &&
        predictions[positiveLabel] > predictions[negativeLabel]
    ) {
        best.innerHTML = positiveLabel;
        best.classList.add('prediction-best-positive');
    } else if (
        predictions[neutralLabel] > predictions[positiveLabel] &&
        predictions[neutralLabel] > predictions[negativeLabel]
    ) {
        best.innerHTML = neutralLabel;
        best.classList.add('prediction-best-neutral');
    } else {
        best.innerHTML = negativeLabel;
        best.classList.add('prediction-best-negative');
    }
    prediction.appendChild(best);

    const predictionBar = document.createElement('div');
    predictionBar.classList.add('attention-visualizer-prediction-bar');
    prediction.appendChild(predictionBar);

    const entailment = document.createElement('div');
    entailment.classList.add('prediction-entailment');
    entailment.style.flexGrow = predictions[positiveLabel] * 100;
    entailment.innerHTML = (predictions[positiveLabel] * 100).toFixed(1) + '%';
    predictionBar.appendChild(entailment);

    const neutral = document.createElement('div');
    neutral.classList.add('prediction-neutral');
    neutral.style.flexGrow = predictions[neutralLabel] * 100;
    neutral.innerHTML = (predictions[neutralLabel] * 100).toFixed(1) + '%';
    predictionBar.appendChild(neutral);

    const contradiction = document.createElement('div');
    contradiction.classList.add('prediction-contradiction');
    contradiction.style.flexGrow = predictions[negativeLabel] * 100;
    contradiction.innerHTML =
        (predictions[negativeLabel] * 100).toFixed(1) + '%';
    predictionBar.appendChild(contradiction);

    return prediction;
}

class AttentionVisualizer {
    constructor(
        task,
        visualizer,
        labels,
        attentions,
        predictions,
        compareVec = null
    ) {
        this.labels = labels;
        this.attentions = attentions;
        this.compareVec = compareVec;
        this.predictions = predictions;
        this.selected = [];

        this.visualizer = visualizer;

        this.task = task;

        let i = 0;
        while (i < this.attentions[0].length) {
            const compare = compareVec != null && compareVec[i];
            const selected = [0, 0];
            this.selected.push(selected);
            if (compare) {
                this.selected.push(selected);
            }

            this.visualizer.appendChild(this.createPrediction(i));
            const visualizerGraph = document.createElement('div');
            visualizerGraph.classList.add('attention-visualizer-graph');
            if (compare) {
                this.selected.push([0, 0]);
                visualizerGraph.appendChild(
                    this.createCompareHeatmap(i, i + 1)
                );
                this.visualizer.appendChild(this.createPrediction(i + 1));
                visualizerGraph.appendChild(this.createSubHeatmap(i, i + 1));
                visualizerGraph.appendChild(this.createSubHeatmapLegend(i));
            } else {
                visualizerGraph.appendChild(this.createHeatmap(i));
            }
            visualizerGraph.appendChild(this.createHeatmapLegend(i));

            visualizerGraph.appendChild(this.createButtons(i, compare));
            this.visualizer.appendChild(visualizerGraph);

            this.setSelected(i, this.selected[i][0], this.selected[i][1]);
            i += compare ? 2 : 1;
        }
    }

    getSelectedAttentionMatrix(batch) {
        const layer = this.selected[batch][0];
        const head = this.selected[batch][1];
        return this.attentions[layer][batch][head];
    }

    getCellColor(cell) {
        const r = (1 - cell) * 255;
        const g = (1 - cell * 0.7) * 255;
        const b = (1 - cell * 0.2) * 255;
        return `rgb(${r}, ${g}, ${b})`;
    }

    getCellSubColor(cell) {
        if (cell >= 0) {
            const r = (1 - cell * 0.8) * 255;
            const g = (1 - cell * 0.3) * 255;
            const b = (1 - cell * 0.9) * 255;
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            const r = (1 + cell * 0.15) * 255;
            const g = (1 + cell) * 255;
            const b = (1 + cell) * 255;
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    createPrediction(batch) {
        return createPrediction(this.task, this.predictions[batch]);
    }

    createHeatmap(batch) {
        const matrix = this.getSelectedAttentionMatrix(batch);
        const xaxis = this.labels[batch];
        const yaxis = this.labels[batch];
        const numColumns = xaxis.length;
        const numRows = yaxis.length;

        const heatmap = document.createElement('div');
        heatmap.classList.add('heatmap');
        const CELL_SIZE = '1em';
        heatmap.style.gridTemplateColumns = `auto repeat(${numColumns}, ${CELL_SIZE})`;
        heatmap.style.gridTemplateRows = `auto repeat(${numRows}, ${CELL_SIZE})`;

        xaxis.forEach((label, idx) => {
            if (label[3] != '[PAD]') {
                const labelElement = createGridElement(idx + 1, 0);
                labelElement.classList.add('label', 'xaxis');
                labelElement.innerText = label;
                heatmap.appendChild(labelElement);
            }
        });

        yaxis.forEach((label, idx) => {
            if (label[3] != '[PAD]') {
                const labelElement = createGridElement(0, idx + 1);
                labelElement.classList.add('label', 'yaxis');
                labelElement.innerText = label;
                heatmap.appendChild(labelElement);
            }
        });

        matrix.forEach((row, i) => {
            row.forEach((cell, j) => {
                if (yaxis[i][3] != '[PAD]' && xaxis[j][3] != '[PAD]') {
                    const cellElement = createGridElement(j + 1, i + 1);
                    cellElement.id = `attention-visualizer-graph-${batch}-cell-${j}-${i}`;
                    cellElement.classList.add('cell');
                    cellElement.style.backgroundColor = this.getCellColor(cell);
                    heatmap.appendChild(cellElement);
                }
            });
        });

        return heatmap;
    }

    createSubHeatmap(batch1, batch2) {
        const matrix1 = this.getSelectedAttentionMatrix(batch1);
        const matrix2 = this.getSelectedAttentionMatrix(batch2);

        const labels = compareDistance(
            this.labels[batch1],
            this.labels[batch2]
        );

        const numColumns = labels.length;
        const numRows = labels.length;

        const heatmap = document.createElement('div');
        heatmap.id = `attention-visualizer-graph-diff-heatmap-${batch1}`;
        heatmap.classList.add('heatmap');
        const CELL_SIZE = '1em';
        heatmap.style.gridTemplateColumns = `auto repeat(${numColumns}, ${CELL_SIZE})`;
        heatmap.style.gridTemplateRows = `auto repeat(${numRows}, ${CELL_SIZE})`;

        labels.forEach((label, idx) => {
            if (label[3] != '[PAD]') {
                const xaxisLabelElement = createGridElement(idx + 1, 0);
                xaxisLabelElement.classList.add('label', 'xaxis');
                if (label[0] == 'c') {
                    xaxisLabelElement.innerText = `${label[3]} / ${label[4]}`;
                } else {
                    xaxisLabelElement.innerText = label[3];
                }

                heatmap.appendChild(xaxisLabelElement);

                const yaxisLabelElement = createGridElement(0, idx + 1);
                yaxisLabelElement.classList.add('label', 'yaxis');
                if (label[0] == 'c') {
                    yaxisLabelElement.innerText = `${label[3]} / ${label[4]}`;
                } else {
                    yaxisLabelElement.innerText = label[3];
                }
                heatmap.appendChild(yaxisLabelElement);
            }
        });

        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numColumns; j++) {
                if (labels[i][3] == '[PAD]' || labels[j][3] == '[PAD]') {
                    continue;
                }
                const rowLabel = labels[i];
                const colLabel = labels[j];
                let color1 = 0;
                let color2 = 0;

                const cellElement = createGridElement(j + 1, i + 1);
                cellElement.id = `attention-visualizer-graph-sub-${batch1}-cell-${j}-${i}`;
                cellElement.classList.add('cell');

                if (rowLabel[0] != 'i' && colLabel[0] != 'i') {
                    color1 = matrix1[rowLabel[1]][colLabel[1]];
                }

                if (rowLabel[0] != 'd' && colLabel[0] != 'd') {
                    color2 = matrix2[rowLabel[2]][colLabel[2]];
                }

                cellElement.style.backgroundColor = this.getCellSubColor(
                    color2 - color1
                );
                heatmap.appendChild(cellElement);
            }
        }

        heatmap.classList.add('d-none');

        return heatmap;
    }

    createCompareHeatmap(batch1, batch2) {
        const matrix1 = this.getSelectedAttentionMatrix(batch1);
        const matrix2 = this.getSelectedAttentionMatrix(batch2);

        const labels = compareDistance(
            this.labels[batch1],
            this.labels[batch2]
        );

        const numColumns = labels.length;
        const numRows = labels.length;

        const heatmap = document.createElement('div');
        heatmap.id = `attention-visualizer-graph-compare-heatmap-${batch1}`;
        heatmap.classList.add('heatmap');
        const CELL_SIZE = 1;
        heatmap.style.gridTemplateColumns = `auto repeat(${numColumns * 2}, ${
            CELL_SIZE / 2
        }em)`;
        heatmap.style.gridTemplateRows = `auto repeat(${numRows}, ${CELL_SIZE}em)`;

        labels.forEach((label, idx) => {
            if (label[3] != '[PAD]') {
                const xaxisLabelElement = createGridElement(
                    idx * 2 + 1,
                    0,
                    2,
                    1
                );
                xaxisLabelElement.classList.add('label', 'xaxis');
                if (label[0] == 'c') {
                    xaxisLabelElement.innerText = `${label[3]} / ${label[4]}`;
                } else {
                    xaxisLabelElement.innerText = label[3];
                }

                heatmap.appendChild(xaxisLabelElement);

                const yaxisLabelElement = createGridElement(0, idx + 1);
                yaxisLabelElement.classList.add('label', 'yaxis');
                if (label[0] == 'c') {
                    yaxisLabelElement.innerText = `${label[3]} / ${label[4]}`;
                } else {
                    yaxisLabelElement.innerText = label[3];
                }
                heatmap.appendChild(yaxisLabelElement);
            }
        });

        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numColumns; j++) {
                if (labels[i][3] == '[PAD]' || labels[j][3] == '[PAD]') {
                    continue;
                }
                const rowLabel = labels[i];
                const colLabel = labels[j];

                const leftCellElement = createGridElement(j * 2 + 1, i + 1);
                leftCellElement.id = `attention-visualizer-graph-${batch1}-cell-${j}-${i}`;
                leftCellElement.classList.add('cell', 'cell-left-half');
                if (rowLabel[0] != 'i' && colLabel[0] != 'i') {
                    leftCellElement.style.backgroundColor = this.getCellColor(
                        matrix1[rowLabel[1]][colLabel[1]]
                    );
                } else {
                    leftCellElement.classList.add('blank-cell');
                }
                heatmap.appendChild(leftCellElement);

                const rightCellElement = createGridElement(j * 2 + 2, i + 1);
                rightCellElement.id = `attention-visualizer-graph-${batch2}-cell-${j}-${i}`;
                rightCellElement.classList.add('cell', 'cell-right-half');
                if (rowLabel[0] != 'd' && colLabel[0] != 'd') {
                    rightCellElement.style.backgroundColor = this.getCellColor(
                        matrix2[rowLabel[2]][colLabel[2]]
                    );
                } else {
                    rightCellElement.classList.add('blank-cell');
                }
                heatmap.appendChild(rightCellElement);
            }
        }

        return heatmap;
    }

    createHeatmapLegend(batch) {
        const legend = document.createElement('div');
        legend.id = `attention-visualizer-graph-compare-heatmap-legend-${batch}`;
        legend.classList.add('attention-visualizer-legend');
        for (let i = 0; i <= 10; i++) {
            const legendElement = createGridElement(0, 40 - 4 * i, 1, 2);
            legendElement.classList.add('legend-label');
            legendElement.innerText = `${i * 10}% -`;
            legend.appendChild(legendElement);
        }
        const legendGradient = createGridElement(1, 1, 1, 40);
        legendGradient.classList.add('legend-gradient');
        legend.appendChild(legendGradient);
        return legend;
    }

    createSubHeatmapLegend(batch) {
        const legend = document.createElement('div');
        legend.id = `attention-visualizer-graph-diff-heatmap-legend-${batch}`;
        legend.classList.add('attention-visualizer-legend');
        for (let i = 0; i <= 10; i++) {
            const legendElement = createGridElement(0, 20 - 2 * i, 1, 2);
            legendElement.classList.add('legend-label');
            legendElement.innerText = `${i * 10}% -`;
            legend.appendChild(legendElement);
        }
        for (let i = 1; i <= 10; i++) {
            const legendElement = createGridElement(0, 20 + 2 * i, 1, 2);
            legendElement.classList.add('legend-label');
            legendElement.innerText = `-${i * 10}% -`;
            legend.appendChild(legendElement);
        }
        const legendGradient = createGridElement(1, 1, 1, 40);
        legendGradient.classList.add(
            'legend-gradient',
            'legend-gradient-signed'
        );
        legend.appendChild(legendGradient);
        legend.classList.add('d-none');
        return legend;
    }

    createButtons(batch, compare) {
        const numLayers = this.attentions.length;
        const numHeads = this.attentions[0][batch].length;
        const BUTTON_SIZE = '2.25em';

        const controlPanel = document.createElement('div');
        controlPanel.classList.add('attention-visualizer-control-panel');
        if (compare) {
            const radios = document.createElement('div');
            radios.classList.add('attention-visualizer-heatmap-selector');

            const compareRadio = document.createElement('div');
            compareRadio.classList.add('form-check', 'form-check-inline');
            const compareRadioInput = document.createElement('input');
            compareRadioInput.classList.add('form-check-input');
            compareRadioInput.type = 'radio';
            compareRadioInput.name = 'heatmap-type';
            compareRadioInput.value = 'compare';
            compareRadioInput.id = `attention-visualizer-compare-radio-${batch}`;
            compareRadioInput.checked = true;
            compareRadioInput.addEventListener('change', () => {
                document
                    .getElementById(
                        `attention-visualizer-graph-compare-heatmap-${batch}`
                    )
                    .classList.remove('d-none');
                document
                    .getElementById(
                        `attention-visualizer-graph-compare-heatmap-legend-${batch}`
                    )
                    .classList.remove('d-none');
                document
                    .getElementById(
                        `attention-visualizer-graph-diff-heatmap-${batch}`
                    )
                    .classList.add('d-none');
                document
                    .getElementById(
                        `attention-visualizer-graph-diff-heatmap-legend-${batch}`
                    )
                    .classList.add('d-none');
            });
            compareRadio.appendChild(compareRadioInput);

            const compareRadioLabel = document.createElement('label');
            compareRadioLabel.classList.add('form-check-label');
            compareRadioLabel.innerText = 'Compare heatmap';
            compareRadioLabel.setAttribute('for', compareRadioInput.id);
            compareRadio.appendChild(compareRadioLabel);

            radios.appendChild(compareRadio);

            const subRadio = document.createElement('div');
            subRadio.classList.add('form-check', 'form-check-inline');
            const subRadioInput = document.createElement('input');
            subRadioInput.classList.add('form-check-input');
            subRadioInput.type = 'radio';
            subRadioInput.name = 'heatmap-type';
            subRadioInput.value = 'difference';
            subRadioInput.id = `attention-visualizer-diff-radio-${batch}`;
            subRadioInput.addEventListener('change', () => {
                document
                    .getElementById(
                        `attention-visualizer-graph-compare-heatmap-${batch}`
                    )
                    .classList.add('d-none');
                document
                    .getElementById(
                        `attention-visualizer-graph-compare-heatmap-legend-${batch}`
                    )
                    .classList.add('d-none');
                document
                    .getElementById(
                        `attention-visualizer-graph-diff-heatmap-${batch}`
                    )
                    .classList.remove('d-none');
                document
                    .getElementById(
                        `attention-visualizer-graph-diff-heatmap-legend-${batch}`
                    )
                    .classList.remove('d-none');
            });
            subRadio.appendChild(subRadioInput);

            const subRadioLabel = document.createElement('label');
            subRadioLabel.classList.add('form-check-label');
            subRadioLabel.innerText = 'Difference heatmap';
            subRadioLabel.setAttribute('for', subRadioInput.id);
            subRadio.appendChild(subRadioLabel);

            radios.appendChild(subRadio);
            controlPanel.appendChild(radios);
        }

        const buttons = document.createElement('div');
        buttons.id = `attention-visualizer-buttons-batch-${batch}`;
        buttons.classList.add('attention-visualizer-buttons');
        buttons.style.gridTemplateColumns = `auto auto repeat(${numHeads}, ${BUTTON_SIZE})`;
        buttons.style.gridTemplateRows = `repeat(${numLayers}, ${BUTTON_SIZE}) auto auto`;
        for (let layer = numLayers - 1; layer >= 0; layer--) {
            for (let head = 0; head < numHeads; head++) {
                const button = document.createElement('button');
                button.id = `attention-visualizer-graph-${batch}-button-layer-${layer}-head-${head}`;
                button.addEventListener('click', () => {
                    this.setSelected(batch, layer, head);
                });
                button.addEventListener('mouseover', () => {
                    this.setShown(batch, layer, head);
                    this.setHovered(batch, layer, head);
                });
                button.addEventListener('mouseout', () => {
                    this.setSelected(
                        batch,
                        this.selected[batch][0],
                        this.selected[batch][1]
                    );
                });
                buttons.appendChild(button);
            }
        }
        const legendLayers = createGridElement(0, 0, 1, numLayers);
        legendLayers.classList.add('label', 'yaxis', 'legend-title');
        legendLayers.innerText = 'layer';
        buttons.appendChild(legendLayers);
        for (let layer = 0; layer < numLayers; layer++) {
            const labelElement = createGridElement(1, numLayers - layer - 1);
            labelElement.addEventListener('click', () => {
                this.setSelected(batch, layer, 'all');
            });
            labelElement.addEventListener('mouseover', () => {
                this.setShown(batch, layer, 'all');
                this.setHovered(batch, layer, 'all');
            });
            labelElement.addEventListener('mouseout', () => {
                this.setSelected(
                    batch,
                    this.selected[batch][0],
                    this.selected[batch][1]
                );
            });
            labelElement.id = `attention-visualizer-graph-${batch}-label-layer-${layer}`;
            labelElement.classList.add('label', 'selectable-label', 'yaxis');
            labelElement.innerText = 1 + layer;
            buttons.appendChild(labelElement);
        }

        const legendHeads = createGridElement(2, numLayers + 1, numHeads, 1);
        legendHeads.classList.add('label', 'xaxis', 'legend-title');
        legendHeads.innerText = 'head';
        buttons.appendChild(legendHeads);
        for (let head = 0; head < numHeads; head++) {
            const labelElement = createGridElement(head + 2, numLayers);
            labelElement.addEventListener('click', () => {
                this.setSelected(batch, 'all', head);
            });
            labelElement.addEventListener('mouseover', () => {
                this.setShown(batch, 'all', head);
                this.setHovered(batch, 'all', head);
            });
            labelElement.addEventListener('mouseout', () => {
                this.setSelected(
                    batch,
                    this.selected[batch][0],
                    this.selected[batch][1]
                );
            });
            labelElement.id = `attention-visualizer-graph-${batch}-label-head-${head}`;
            labelElement.classList.add('label', 'selectable-label', 'xaxis');
            labelElement.innerText = 1 + head;
            buttons.appendChild(labelElement);
        }

        const labelElement = createGridElement(1, numLayers);
        labelElement.addEventListener('click', () => {
            this.setSelected(batch, 'all', 'all');
        });
        labelElement.addEventListener('mouseover', () => {
            this.setShown(batch, 'all', 'all');
            this.setHovered(batch, 'all', 'all');
        });
        labelElement.addEventListener('mouseout', () => {
            this.setSelected(
                batch,
                this.selected[batch][0],
                this.selected[batch][1]
            );
        });
        labelElement.id = `attention-visualizer-graph-${batch}-label-all`;
        labelElement.classList.add('label-all', 'label', 'selectable-label');
        buttons.appendChild(labelElement);

        controlPanel.appendChild(buttons);
        return controlPanel;
    }

    getCellElement(batch, x, y) {
        return document.getElementById(
            `attention-visualizer-graph-${batch}-cell-${x}-${y}`
        );
    }

    getSubCellElement(batch, x, y) {
        return document.getElementById(
            `attention-visualizer-graph-sub-${batch}-cell-${x}-${y}`
        );
    }

    getButtonElement(batch, layer, head) {
        return document.getElementById(
            `attention-visualizer-graph-${batch}-button-layer-${layer}-head-${head}`
        );
    }

    getMatrix(batch, layer, head) {
        if (layer == 'all' && head == 'all') {
            let matrix = this.attentions[0][batch][0].map((row) => row.slice());
            for (let i = 0; i < this.attentions.length; i++) {
                for (let j = 0; j < this.attentions[i][batch].length; j++) {
                    if (i == 0 && j == 0) continue;
                    matrix = matrix.map((row, index) => {
                        return row.map((cell, index2) => {
                            return (
                                cell +
                                this.attentions[i][batch][j][index][index2]
                            );
                        });
                    });
                }
            }
            for (let j = 0; j < matrix.length; j++) {
                for (let k = 0; k < matrix[j].length; k++) {
                    matrix[j][k] /=
                        this.attentions.length *
                        this.attentions[0][batch].length;
                }
            }
            return matrix;
        } else if (layer == 'all') {
            let matrix = this.attentions[0][batch][head].map((row) =>
                row.slice()
            );
            for (let i = 1; i < this.attentions.length; i++) {
                for (let j = 0; j < matrix.length; j++) {
                    for (let k = 0; k < matrix[j].length; k++) {
                        matrix[j][k] += this.attentions[i][batch][head][j][k];
                    }
                }
            }
            for (let j = 0; j < matrix.length; j++) {
                for (let k = 0; k < matrix[j].length; k++) {
                    matrix[j][k] /= this.attentions.length;
                }
            }
            return matrix;
        } else if (head == 'all') {
            let matrix = this.attentions[layer][batch][0].map((row) =>
                row.slice()
            );
            for (let i = 1; i < this.attentions.length; i++) {
                for (let j = 0; j < matrix.length; j++) {
                    for (let k = 0; k < matrix[j].length; k++) {
                        matrix[j][k] += this.attentions[layer][batch][i][j][k];
                    }
                }
            }
            for (let j = 0; j < matrix.length; j++) {
                for (let k = 0; k < matrix[j].length; k++) {
                    matrix[j][k] /= this.attentions[layer][batch].length;
                }
            }

            return matrix;
        } else {
            return this.attentions[layer][batch][head];
        }
    }

    setHovered(batch, layer, head) {
        if (layer == 'all' && head == 'all') {
            for (let i = 0; i < this.attentions.length; i++) {
                for (let j = 0; j < this.attentions[i][batch].length; j++) {
                    const newButton = this.getButtonElement(batch, i, j);
                    newButton.classList.add('hover');
                }
            }
        } else if (layer == 'all') {
            document
                .getElementById(
                    `attention-visualizer-graph-${batch}-label-head-${head}`
                )
                .classList.add('selected');
            for (let i = 0; i < this.attentions.length; i++) {
                const newButton = this.getButtonElement(batch, i, head);
                newButton.classList.add('hover');
            }
        } else if (head == 'all') {
            document
                .getElementById(
                    `attention-visualizer-graph-${batch}-label-layer-${layer}`
                )
                .classList.add('selected');
            for (let i = 0; i < this.attentions[layer][batch].length; i++) {
                const newButton = this.getButtonElement(batch, layer, i);
                newButton.classList.add('hover');
            }
        } else {
            const newButton = this.getButtonElement(batch, layer, head);
            newButton.classList.add('hover');
        }
    }

    setShown(batch, layer, head) {
        if (!this.compareVec[batch]) {
            const matrix = this.getMatrix(batch, layer, head);
            const xaxis = this.labels[batch];
            const yaxis = this.labels[batch];

            matrix.forEach((row, i) => {
                row.forEach((cell, j) => {
                    if (yaxis[i][3] != '[PAD]' && xaxis[j][3] != '[PAD]') {
                        const cellElement = this.getCellElement(batch, j, i);
                        cellElement.style.backgroundColor =
                            this.getCellColor(cell);
                    }
                });
            });
        } else {
            const batch1 = batch;
            const batch2 = batch + 1;
            const matrix1 = this.getMatrix(batch1, layer, head);
            const matrix2 = this.getMatrix(batch2, layer, head);

            const labels = compareDistance(
                this.labels[batch1],
                this.labels[batch2]
            );

            const numColumns = labels.length;
            const numRows = labels.length;

            for (let i = 0; i < numRows; i++) {
                for (let j = 0; j < numColumns; j++) {
                    if (labels[i][3] == '[PAD]' || labels[j][3] == '[PAD]') {
                        continue;
                    }

                    const rowLabel = labels[i];
                    const colLabel = labels[j];

                    const leftCellElement = this.getCellElement(batch1, j, i);
                    if (!leftCellElement.classList.contains('blank-cell')) {
                        leftCellElement.style.backgroundColor =
                            this.getCellColor(
                                matrix1[rowLabel[1]][colLabel[1]]
                            );
                    }

                    const rightCellElement = this.getCellElement(batch2, j, i);
                    if (!rightCellElement.classList.contains('blank-cell')) {
                        rightCellElement.style.backgroundColor =
                            this.getCellColor(
                                matrix2[rowLabel[2]][colLabel[2]]
                            );
                    }

                    const subCellElement = this.getSubCellElement(batch1, j, i);

                    let color1 = 0;
                    let color2 = 0;

                    if (rowLabel[0] != 'i' && colLabel[0] != 'i') {
                        color1 = matrix1[rowLabel[1]][colLabel[1]];
                    }

                    if (rowLabel[0] != 'd' && colLabel[0] != 'd') {
                        color2 = matrix2[rowLabel[2]][colLabel[2]];
                    }

                    subCellElement.style.backgroundColor = this.getCellSubColor(
                        color2 - color1
                    );
                }
            }
        }
    }

    setSelected(batch, layer, head) {
        const buttons = document.getElementById(
            `attention-visualizer-buttons-batch-${batch}`
        ).children;
        for (let button of buttons) {
            button.classList.remove('hover');
            button.classList.remove('selected');
        }

        if (layer == 'all' && head == 'all') {
            for (let i = 0; i < this.attentions.length; i++) {
                for (let j = 0; j < this.attentions[i][batch].length; j++) {
                    const newButton = this.getButtonElement(batch, i, j);
                    newButton.classList.add('selected');
                }
            }
        } else if (layer == 'all') {
            document
                .getElementById(
                    `attention-visualizer-graph-${batch}-label-head-${head}`
                )
                .classList.add('selected');
            for (let i = 0; i < this.attentions.length; i++) {
                const newButton = this.getButtonElement(batch, i, head);
                newButton.classList.add('selected');
            }
        } else if (head == 'all') {
            document
                .getElementById(
                    `attention-visualizer-graph-${batch}-label-layer-${layer}`
                )
                .classList.add('selected');
            for (let i = 0; i < this.attentions[layer][batch].length; i++) {
                const newButton = this.getButtonElement(batch, layer, i);
                newButton.classList.add('selected');
            }
        } else {
            const newButton = this.getButtonElement(batch, layer, head);
            newButton.classList.add('selected');
        }

        this.selected[batch] = [layer, head];
        this.setShown(batch, layer, head);
    }
}

const NLI_FORM_STATE = {
    sentence_a: 'Text',
    sentence_b: 'Hypothesis',
    model_selector_class: 'form-select-nli',
    description:
        'Natural Language Inference (NLI), also known as Recognizing Textual Entailment (RTE), is the task of determining the inference relation between a text and an hypothesis: entailment, contradiction, or neutral [MacCartney and Manning, 2008].',
};
const ARI_FORM_STATE = {
    sentence_a: 'Source ADU',
    sentence_b: 'Target ADU',
    model_selector_class: 'form-select-ari',
    description:
        'Argumentative Relation Identification (ARI) is a subtask of Argument Mining (AM) and aims at classifying if a given source Argumentative Discourse Unit (ADU) supports, attacks, or is unrelated to a second ADU [Cunha, 2020] [Peldszus and Stede, 2015].',
};
const FV_FORM_STATE = {
    sentence_a: 'Claim',
    sentence_b: 'Evidence',
    model_selector_class: 'form-select-fv',
    description:
        'Fact Verification (FV) is a subtask of Fact Extraction and VERification (FEVER) and can be formulated as whether the relationship of given claim and evidence is refute, support, or not enough information [Du et al., 2021] [Thorne et al., 2018].',
};
function setTask(form, task) {
    let task_state = null;
    if (task == 'nli') {
        task_state = NLI_FORM_STATE;
    } else if (task == 'ari') {
        task_state = ARI_FORM_STATE;
    } else if (task == 'fv') {
        task_state = FV_FORM_STATE;
    } else {
        task_state = NLI_FORM_STATE;
    }
    form.querySelectorAll('.form-select-nli').forEach((select) => {
        select.classList.add('d-none');
    });
    form.querySelectorAll('.form-select-ari').forEach((select) => {
        select.classList.add('d-none');
    });
    form.querySelectorAll('.form-select-fv').forEach((select) => {
        select.classList.add('d-none');
    });
    form.querySelectorAll(`.${task_state['model_selector_class']}`).forEach(
        (select) => {
            updateModelHelpTooltip(form, select);
            select.classList.remove('d-none');
        }
    );
    form.querySelectorAll('label[for="sentence_a"]').forEach((text) => {
        text.innerText = `${task_state['sentence_a']}:`;
    });
    form.querySelectorAll('label[for="sentence_b"]').forEach((text) => {
        text.innerText = `${task_state['sentence_b']}:`;
    });
    form.querySelectorAll('label[for="sentence_a1"]').forEach((text) => {
        text.innerText = `${task_state['sentence_a']}:`;
    });
    form.querySelectorAll('label[for="sentence_b1"]').forEach((text) => {
        text.innerText = `${task_state['sentence_b']}:`;
    });
    form.querySelectorAll('label[for="sentence_a2"]').forEach((text) => {
        text.innerText = `${task_state['sentence_a']}:`;
    });
    form.querySelectorAll('label[for="sentence_b2"]').forEach((text) => {
        text.innerText = `${task_state['sentence_b']}:`;
    });
    form.querySelectorAll('.help-tooltip-task').forEach((input) => {
        input.setAttribute('title', `${task_state['description']}`);
        const tooltip = Tooltip.getOrCreateInstance(input);
        tooltip.hide();
        tooltip._fixTitle();
    });
}

async function setModel(task, model) {
    const table = document.getElementById('pregen-attacks-table');

    if (table) {
        const tableElement = document.getElementById('pregen-attacks-table');
        const warningElement = document.getElementById(
            'pregen-attacks-warning'
        );
        const loadingSpinner = document.getElementById(
            'pregen-attacks-loading-spinner'
        );
        const bodyElement = document.getElementById(
            'pregen-attacks-table-body'
        );

        tableElement.classList.add('d-none');
        warningElement.classList.add('d-none');
        loadingSpinner.classList.remove('d-none');

        let url;
        if (model != null) {
            url = `/adversarial-attacks/${task}/${model}/pregenerated`;
        } else {
            url = `/adversarial-attacks/${task}/pregenerated`;
        }
        const response = await fetch(localUrl(url), { method: 'GET' });

        const attacks = (await response.json())['attacks'];

        loadingSpinner.classList.add('d-none');
        if (attacks.length == 0) {
            warningElement.classList.remove('d-none');
        } else {
            while (bodyElement.firstChild) {
                bodyElement.removeChild(bodyElement.firstChild);
            }

            for (let i = 0; i < attacks.length; i++) {
                const attack = attacks[i];
                const prediction1 = createPrediction(
                    task.value,
                    attack['original']['prediction']
                );
                const prediction2 = createPrediction(
                    task.value,
                    attack['attacked']['prediction']
                );

                const href = localUrl('/visualize/attention-weights/compare', {
                    sentence_a: encodeArray([
                        attack['original']['sentence_1'],
                        attack['attacked']['sentence_1'],
                    ]),
                    sentence_b: encodeArray([
                        attack['original']['sentence_2'],
                        attack['attacked']['sentence_2'],
                    ]),
                    task: task,
                    model: model == null || model.length == 0 ? '0' : model,
                });

                const element1 = document.createElement('tr');
                element1.classList.add('continue-row');
                const e1col1 = document.createElement('td');
                e1col1.innerText = attack['original']['sentence_1'];
                const e1col2 = document.createElement('td');
                e1col2.innerText = attack['original']['sentence_2'];
                const e1col3 = document.createElement('td');
                e1col3.rowSpan = 2;
                e1col3.classList.add('no-continue');
                e1col3.innerText = attack['attack'];
                const e1col4 = document.createElement('td');
                e1col4.appendChild(prediction1);
                const e1col5 = document.createElement('td');
                e1col5.rowSpan = 2;
                e1col5.classList.add('no-continue');
                const e1col5a = document.createElement('a');
                e1col5a.href = href;
                e1col5a.classList.add('btn');
                e1col5a.classList.add('btn-primary');
                e1col5a.type = 'button';
                e1col5a.innerHTML = 'Compare<br>Attentions';
                e1col5.appendChild(e1col5a);
                element1.appendChild(e1col1);
                element1.appendChild(e1col2);
                element1.appendChild(e1col3);
                element1.appendChild(e1col4);
                element1.appendChild(e1col5);

                const element2 = document.createElement('tr');
                const e2col1 = document.createElement('td');
                e2col1.innerText = attack['attacked']['sentence_1'];
                const e2col2 = document.createElement('td');
                e2col2.innerText = attack['attacked']['sentence_2'];
                const e2col3 = document.createElement('td');
                e2col3.appendChild(prediction2);
                element2.appendChild(e2col1);
                element2.appendChild(e2col2);
                element2.appendChild(e2col3);

                bodyElement.appendChild(element1);
                bodyElement.appendChild(element2);
            }
            tableElement.classList.remove('d-none');
        }
    }
}

function updateAttackHelpTooltip(form, select) {
    form.querySelectorAll('.help-tooltip-attack').forEach((input) => {
        input.setAttribute(
            'title',
            select.options[select.selectedIndex].getAttribute(
                'data-abert-description'
            )
        );
        const tooltip = Tooltip.getOrCreateInstance(input);
        tooltip.hide();
        tooltip._fixTitle();
    });
}

function updateModelHelpTooltip(form, select) {
    form.querySelectorAll('.help-tooltip-model').forEach((input) => {
        input.setAttribute(
            'title',
            select.options[select.selectedIndex].getAttribute(
                'data-abert-description'
            )
        );
        const tooltip = Tooltip.getOrCreateInstance(input);
        tooltip.hide();
        tooltip._fixTitle();
    });
}

export async function bindVisualizers() {
    const visualizeSingleForms = document.querySelectorAll(
        '.visualize-single-form'
    );
    visualizeSingleForms.forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const submitButton = form.querySelector('button[type="submit"]');

            submitButton.disabled = true;
            form['sentence_a'].disabled = true;
            form['sentence_b'].disabled = true;
            const loading = document.getElementById('loading-spinner');
            if (loading) {
                loading.classList.remove('d-none');
            }

            const data = await getData(
                formData.get('task'),
                formData.get('model'),
                [formData.get('sentence_a')],
                [formData.get('sentence_b')]
            );
            const attentionVisualizerDiv = document.getElementById(
                'attention-visualizer'
            );
            if (attentionVisualizerDiv) {
                while (attentionVisualizerDiv.firstChild) {
                    attentionVisualizerDiv.removeChild(
                        attentionVisualizerDiv.firstChild
                    );
                }
                const attentionVisualizer = new AttentionVisualizer(
                    formData.get('task').value,
                    attentionVisualizerDiv,
                    data.token_labels,
                    data.attentions,
                    data.predictions,
                    [false]
                );
            }

            submitButton.disabled = false;
            form['sentence_a'].disabled = false;
            form['sentence_b'].disabled = false;
            if (loading) {
                loading.classList.add('d-none');
            }
        });
    });

    const visualizeCompareForms = document.querySelectorAll(
        '.visualize-compare-form'
    );

    let attentionVisualizer = null;
    visualizeCompareForms.forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const submitButton = form.querySelector('button[type="submit"]');
            const randAttackButton = form.querySelector(
                'button.rand-adv-attack'
            );

            submitButton.disabled = true;
            randAttackButton.disabled = true;
            form['sentence_a1'].disabled = true;
            form['sentence_b1'].disabled = true;
            form['sentence_a2'].disabled = true;
            form['sentence_b2'].disabled = true;
            const loading = document.getElementById('loading-spinner');
            if (loading) {
                loading.classList.remove('d-none');
            }

            const data = await getData(
                formData.get('task'),
                formData.get('model'),
                [formData.get('sentence_a1'), formData.get('sentence_a2')],
                [formData.get('sentence_b1'), formData.get('sentence_b2')]
            );
            const attentionVisualizerDiv = document.getElementById(
                'attention-visualizer'
            );
            if (attentionVisualizerDiv) {
                while (attentionVisualizerDiv.firstChild) {
                    attentionVisualizerDiv.removeChild(
                        attentionVisualizerDiv.firstChild
                    );
                }
                const attentionVisualizer = new AttentionVisualizer(
                    formData.get('task').value,
                    attentionVisualizerDiv,
                    data.token_labels,
                    data.attentions,
                    data.predictions,
                    [true, false]
                );
            }

            submitButton.disabled = false;
            randAttackButton.disabled = false;
            form['sentence_a1'].disabled = false;
            form['sentence_b1'].disabled = false;
            form['sentence_a2'].disabled = false;
            form['sentence_b2'].disabled = false;
            if (loading) {
                loading.classList.add('d-none');
            }
        });

        form.querySelectorAll('.rand-adv-attack').forEach((button) => {
            button.addEventListener('click', async () => {
                const submitButton = form.querySelector(
                    'button[type="submit"]'
                );
                const randAttackButton = form.querySelector(
                    'button.rand-adv-attack'
                );

                submitButton.disabled = true;
                randAttackButton.disabled = true;
                form['sentence_a1'].disabled = true;
                form['sentence_b1'].disabled = true;
                form['sentence_a2'].disabled = true;
                form['sentence_b2'].disabled = true;
                const loading = document.getElementById('loading-spinner');
                if (loading) {
                    loading.classList.remove('d-none');
                }

                const formData = new FormData(form);

                const task = formData.get('task');
                const model = formData.get('model');
                let url;

                if (model != null) {
                    url = `/adversarial-attacks/${task}/${model}/random`;
                } else {
                    url = `/adversarial-attacks/${task}/random`;
                }

                const response = await fetch(localUrl(url), {
                    method: 'GET',
                });
                const data = await response.json();

                form['sentence_a1'].value = data['original']['sentence_1'];
                form['sentence_a2'].value = data['attacked']['sentence_1'];
                form['sentence_b1'].value = data['original']['sentence_2'];
                form['sentence_b2'].value = data['attacked']['sentence_2'];

                submitButton.disabled = false;
                randAttackButton.disabled = false;
                form['sentence_a1'].disabled = false;
                form['sentence_b1'].disabled = false;
                form['sentence_a2'].disabled = false;
                form['sentence_b2'].disabled = false;
                if (loading) {
                    loading.classList.add('d-none');
                }
            });
        });

        form.querySelectorAll('.gen-adv-attack').forEach((button) => {
            button.addEventListener('click', async () => {
                const formData = new FormData(form);

                button.disabled = true;
                form['sentence_a1'].disabled = true;
                form['sentence_b1'].disabled = true;
                form['sentence_a2'].classList.add('d-none');
                form['sentence_b2'].classList.add('d-none');

                document.getElementById('error-alert').classList.add('d-none');
                form.querySelectorAll('label[for="sentence_a2"]').forEach(
                    (text) => {
                        text.classList.add('d-none');
                    }
                );
                form.querySelectorAll('label[for="sentence_b2"]').forEach(
                    (text) => {
                        text.classList.add('d-none');
                    }
                );
                form.querySelectorAll('label.for-sentence2').forEach((text) => {
                    text.classList.add('d-none');
                });
                const loading = document.getElementById('loading-spinner');
                if (loading) {
                    loading.classList.remove('d-none');
                }

                const query = {
                    sentence_a: encodeArray([formData.get('sentence_a1')]),
                    sentence_b: encodeArray([formData.get('sentence_b1')]),
                };
                let url;
                if (formData.get('model') != null) {
                    url = `/adversarial-attacks/${formData.get(
                        'task'
                    )}/${formData.get('model')}/${formData.get(
                        'attack'
                    )}/generate`;
                } else {
                    url = `/adversarial-attacks/${formData.get(
                        'task'
                    )}/${formData.get('attack')}/generate`;
                }
                const response = await fetch(localUrl(url, query), {
                    method: 'GET',
                });
                const data = await response.json();

                if (loading) {
                    loading.classList.add('d-none');
                }

                button.disabled = false;
                form['sentence_a1'].disabled = false;
                form['sentence_b1'].disabled = false;

                if (!('perturbed_sentence_a' in data)) {
                    document
                        .getElementById('error-alert')
                        .classList.remove('d-none');
                    return;
                }

                form['sentence_a2'].value = data['perturbed_sentence_a'];
                form['sentence_b2'].value = data['perturbed_sentence_b'];
                form['sentence_a2'].classList.remove('d-none');
                form['sentence_b2'].classList.remove('d-none');
                form.querySelectorAll('label[for="sentence_a2"]').forEach(
                    (text) => {
                        text.classList.remove('d-none');
                    }
                );
                form.querySelectorAll('label[for="sentence_b2"]').forEach(
                    (text) => {
                        text.classList.remove('d-none');
                    }
                );
                form.querySelectorAll('label.for-sentence2').forEach((text) => {
                    text.classList.remove('d-none');
                });

                const attentionVisualizerDiv = document.getElementById(
                    'attention-visualizer'
                );
                if (attentionVisualizerDiv) {
                    while (attentionVisualizerDiv.firstChild) {
                        attentionVisualizerDiv.removeChild(
                            attentionVisualizerDiv.firstChild
                        );
                    }
                    const attentionVisualizer = new AttentionVisualizer(
                        formData.get('task').value,
                        attentionVisualizerDiv,
                        data.token_labels,
                        data.attentions,
                        data.predictions,
                        [true, false]
                    );
                }
            });
        });
    });

    const visualizeForms = document.querySelectorAll('.visualize-form');
    visualizeForms.forEach((form) => {
        form.elements['task'].addEventListener('change', () => {
            const task = form.elements['task'].value;
            setTask(form, task);
        });
        form.querySelectorAll('.form-select-model').forEach((select) => {
            select.addEventListener('change', () => {
                updateModelHelpTooltip(form, select);
                const model = form.elements['model'];
                const task = form.elements['task'].value;
                setModel(task, model == null ? null : model.value);
            });
        });
        form.querySelectorAll('.form-select-attack').forEach((select) => {
            select.addEventListener('change', () => {
                updateAttackHelpTooltip(form, select);
            });
            updateAttackHelpTooltip(form, select);
        });
        const model = form.elements['model'];
        const task = form.elements['task'].value;
        setTask(form, task);
        setModel(task, model == null ? null : model.value);
    });
}
