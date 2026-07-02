// Allow global stylesheet side-effect imports (e.g. `import "./globals.css"`)
// to type-check under raw `tsc` (Next generates equivalent typings at build).
declare module "*.css";
