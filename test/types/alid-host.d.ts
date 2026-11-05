// Test-only modules resolved from a local alid checkout (alid-checkout.js). They are
// typed loosely on purpose: the integration test exercises them at runtime, and this
// package must not compile against a particular unpublished kernel revision.
declare module "@alid/kernel" { const kernel: any; export = kernel }
declare module "alid-host:repository-plugins" { const module: any; export = module }
declare module "alid-host:effective-bounds" { const module: any; export = module }
declare module "alid-host:clipboard" { const module: any; export = module }
declare module "alid-host:core" { const module: any; export = module }
