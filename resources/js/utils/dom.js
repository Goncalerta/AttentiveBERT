export function createGridElement(
    x,
    y,
    width = 1,
    height = 1,
    className = 'div'
) {
    const element = document.createElement(className);
    element.style.gridArea = `${y + 1} / ${
        x + 1
    } / span ${height} / span ${width}`;
    return element;
}
