// The build creates this JSON outside source control; runtime validation is in model.ts.
declare module '*.generated.json' {
  const data: unknown;
  export default data;
}
