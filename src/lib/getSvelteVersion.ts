export function getSvelteVersion(
    importPath: string,
): { major: number; minor: number; patch: number; label: string } {
    const { version } = require(`${importPath}/package.json`);
    const [major, minor, misc] = version.split('.');
    const [patch, label] = misc.split('-');
    return {
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        label,
    };
}
