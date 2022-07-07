const LOCAL_BASE_URL = new URL(window.location.origin);

export function localUrl(resource, query = null) {
    const url = new URL(resource, LOCAL_BASE_URL);
    if (query != null) {
        url.search = new URLSearchParams(query).toString();
    }
    return url;
}

export function encodeArray(array) {
    return array
        .map((text) => text.replaceAll('\\', '\\\\'))
        .map((text) => text.replaceAll(',', '\\,'))
        .join(',');
}
