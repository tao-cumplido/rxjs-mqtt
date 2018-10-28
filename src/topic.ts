export function validate(topic: string) {
    return !!topic && /^(#|([^+#/]*|\+)(\/([^+#/]*|\+))*(\/+|\/#)?)$/.test(topic);
}

export function toFilter(topic: string) {
    const filter = topic
        .replace(/\[|\\|\^|\$|\.|\||\?|\*|\(|\)/g, (c) => `\\${c}`)
        .replace('+', '[^/]*')
        .replace('#', '.*');

    return new RegExp(`^${filter}$`);
}