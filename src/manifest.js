/**
 * Shared by the bundle and build script; keep the reviewed and executed contracts identical.
 * Aspect and command IDs are listed here once and grow as phases land (docs/PLAN.md).
 */
export const aspectSuffixes = [];
export const commandNames = [];

export const aspectIds = metadata => aspectSuffixes.map(suffix => `${metadata.id}.${suffix}`);
export const commandIds = metadata => commandNames.map(name => `${metadata.id}:${name}`);

export function createPackageManifest(metadata) {
  return {
    id: metadata.id,
    version: metadata.version,
    engine: metadata.engine,
    dependencies: { ...metadata.dependencies },
    optionalDependencies: { ...metadata.optionalDependencies },
    conflicts: [...metadata.conflicts],
    provides: {
      services: [...metadata.provides.services],
      aspects: aspectIds(metadata),
      hsmSlots: [...metadata.provides.hsmSlots],
    },
  };
}
