declare module "aladin-lite" {
  interface AladinGlobal {
    init: Promise<void>;
    aladin: (
      containerId: string,
      options: Record<string, unknown>
    ) => import("@/components/space-canvas/SpaceCanvas.client").AladinInstance;
  }
  const A: AladinGlobal;
  export default A;
}
